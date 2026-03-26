/**
 * Apple Sign In + backend session management.
 *
 * Orchestrates: Apple auth → backend JWT verification → RevenueCat logIn → session persistence.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

// Lazy-load to prevent crash/hang when native module isn't linked (simulator, Expo Go)
const getAppleAuth = () => require('expo-apple-authentication') as typeof import('expo-apple-authentication');

import { API_URL } from './constants';

// AsyncStorage keys
const KEY_ACCESS_TOKEN = 'vector_access_token';
const KEY_REFRESH_TOKEN = 'vector_refresh_token';
const KEY_APPLE_USER_ID = 'vector_apple_user_id';
const KEY_EXPIRES_AT = 'vector_token_expires_at';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthSession {
	accessToken: string;
	refreshToken: string;
	appleUserId: string;
	expiresAt: number; // Unix timestamp in ms
}

interface AuthResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	user: {
		id: string;
		apple_user_id: string;
		email: string | null;
		subscription: any | null;
	};
}

// ---------------------------------------------------------------------------
// Apple Sign In
// ---------------------------------------------------------------------------

export async function signInWithApple(): Promise<{
	identityToken: string;
	user: string;
}> {
	const AppleAuth = getAppleAuth();
	const credential = await AppleAuth.signInAsync({
		requestedScopes: [
			AppleAuth.AppleAuthenticationScope.EMAIL,
		],
	});

	if (!credential.identityToken) {
		throw new Error('Apple Sign In did not return an identity token');
	}

	return {
		identityToken: credential.identityToken,
		user: credential.user,
	};
}

// ---------------------------------------------------------------------------
// Backend verification
// ---------------------------------------------------------------------------

async function authenticateWithBackend(
	identityToken: string,
	userId: string,
): Promise<AuthResponse> {
	const response = await fetch(`${API_URL}/auth/apple`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			identity_token: identityToken,
			user_id: userId,
		}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.detail || `Auth failed (${response.status})`);
	}

	return response.json();
}

async function refreshWithBackend(refreshToken: string): Promise<AuthResponse> {
	const response = await fetch(`${API_URL}/auth/refresh`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refresh_token: refreshToken }),
	});

	if (!response.ok) {
		throw new Error('Token refresh failed');
	}

	return response.json();
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

async function saveSession(session: AuthSession): Promise<void> {
	await AsyncStorage.multiSet([
		[KEY_ACCESS_TOKEN, session.accessToken],
		[KEY_REFRESH_TOKEN, session.refreshToken],
		[KEY_APPLE_USER_ID, session.appleUserId],
		[KEY_EXPIRES_AT, String(session.expiresAt)],
	]);
}

async function loadSession(): Promise<AuthSession | null> {
	const [[, accessToken], [, refreshToken], [, appleUserId], [, expiresAtStr]] =
		await AsyncStorage.multiGet([
			KEY_ACCESS_TOKEN,
			KEY_REFRESH_TOKEN,
			KEY_APPLE_USER_ID,
			KEY_EXPIRES_AT,
		]);

	if (!accessToken || !refreshToken || !appleUserId) return null;

	return {
		accessToken,
		refreshToken,
		appleUserId,
		expiresAt: Number(expiresAtStr) || 0,
	};
}

async function clearSession(): Promise<void> {
	await AsyncStorage.multiRemove([
		KEY_ACCESS_TOKEN,
		KEY_REFRESH_TOKEN,
		KEY_APPLE_USER_ID,
		KEY_EXPIRES_AT,
	]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full orchestrated flow: Apple auth → backend verify → RC logIn → save session.
 */
export async function signInAndAuthenticate(): Promise<AuthSession> {
	const { identityToken, user } = await signInWithApple();
	const authResponse = await authenticateWithBackend(identityToken, user);

	const session: AuthSession = {
		accessToken: authResponse.access_token,
		refreshToken: authResponse.refresh_token,
		appleUserId: authResponse.user.apple_user_id,
		expiresAt: Date.now() + authResponse.expires_in * 1000,
	};

	// Associate RevenueCat user with Apple user ID
	await Purchases.logIn(session.appleUserId);

	await saveSession(session);
	return session;
}

/**
 * On app boot: load stored session, refresh if expired.
 */
export async function restoreSession(): Promise<AuthSession | null> {
	const session = await loadSession();
	if (!session) return null;

	// If access token is still valid (with 60s buffer), use it
	if (session.expiresAt > Date.now() + 60_000) {
		return session;
	}

	// Try refreshing
	try {
		const authResponse = await refreshWithBackend(session.refreshToken);
		const refreshed: AuthSession = {
			accessToken: authResponse.access_token,
			refreshToken: authResponse.refresh_token,
			appleUserId: authResponse.user.apple_user_id,
			expiresAt: Date.now() + authResponse.expires_in * 1000,
		};
		await saveSession(refreshed);
		return refreshed;
	} catch {
		// Refresh failed — session is dead, clear it
		await clearSession();
		return null;
	}
}

/**
 * Get a valid access token, refreshing automatically if needed.
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
	const session = await loadSession();
	if (!session) return null;

	// Still valid (60s buffer)
	if (session.expiresAt > Date.now() + 60_000) {
		return session.accessToken;
	}

	// Try refresh
	try {
		const authResponse = await refreshWithBackend(session.refreshToken);
		const refreshed: AuthSession = {
			accessToken: authResponse.access_token,
			refreshToken: authResponse.refresh_token,
			appleUserId: authResponse.user.apple_user_id,
			expiresAt: Date.now() + authResponse.expires_in * 1000,
		};
		await saveSession(refreshed);
		return refreshed.accessToken;
	} catch {
		await clearSession();
		return null;
	}
}

/**
 * Check if the user has a stored session (may be expired but refreshable).
 */
export async function isAuthenticated(): Promise<boolean> {
	const session = await loadSession();
	return session !== null;
}

/**
 * Check if Apple Sign In is available on this device.
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
	if (Platform.OS !== 'ios') return false;
	try {
		return await getAppleAuth().isAvailableAsync();
	} catch {
		return false;
	}
}

/**
 * Sign out: clear local session + RevenueCat logOut.
 */
export async function signOut(): Promise<void> {
	// Notify backend (best-effort)
	try {
		const session = await loadSession();
		if (session) {
			await fetch(`${API_URL}/auth/logout`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${session.accessToken}` },
			});
		}
	} catch {
		// Best effort
	}

	await clearSession();

	// Reset RevenueCat to anonymous
	try {
		const isAnon = await Purchases.isAnonymous();
		if (!isAnon) {
			await Purchases.logOut();
		}
	} catch {
		// Non-fatal
	}
}
