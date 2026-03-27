import { Alert, Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// Replace these with your actual RevenueCat API keys
const REVENUECAT_IOS_KEY = 'appl_tVgBLeNFrWKjupUIPTbtSmNdvsT';
const REVENUECAT_ANDROID_KEY = 'appl_tVgBLeNFrWKjupUIPTbtSmNdvsT';

export const ENTITLEMENT_ID = 'pro';

export function checkPremium(customerInfo: CustomerInfo): boolean {
	return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export async function initRevenueCat(): Promise<boolean> {
	const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
	Purchases.configure({ apiKey });
	const customerInfo = await Purchases.getCustomerInfo();
	return checkPremium(customerInfo);
}

export function addSubscriptionListener(onUpdate: (isPremium: boolean) => void): () => void {
	const listener = (customerInfo: CustomerInfo) => {
		onUpdate(checkPremium(customerInfo));
	};
	Purchases.addCustomerInfoUpdateListener(listener);
	return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

const OFFERING_ID = 'vector_pro';

export async function presentPaywall(offering?: PurchasesOffering): Promise<boolean> {
	try {
		let resolvedOffering = offering;
		if (!resolvedOffering) {
			try {
				const offerings = await Purchases.getOfferings();
				console.log('[RevenueCat] offerings:', Object.keys(offerings.all), 'current:', offerings.current?.identifier);
				resolvedOffering = offerings.all[OFFERING_ID] ?? offerings.current ?? undefined;
			} catch (e) {
				console.warn('[RevenueCat] getOfferings failed:', e);
			}
		}

		console.log('[RevenueCat] presenting paywall, offering:', resolvedOffering?.identifier ?? 'default');

		const paywallResult: PAYWALL_RESULT = resolvedOffering
			? await RevenueCatUI.presentPaywall({ offering: resolvedOffering })
			: await RevenueCatUI.presentPaywall();

		console.log('[RevenueCat] paywall result:', paywallResult);

		switch (paywallResult) {
			case PAYWALL_RESULT.NOT_PRESENTED:
			case PAYWALL_RESULT.ERROR:
			case PAYWALL_RESULT.CANCELLED:
				return false;
			case PAYWALL_RESULT.PURCHASED:
			case PAYWALL_RESULT.RESTORED:
				return true;
			default:
				return false;
		}
	} catch (error: any) {
		console.error('[RevenueCat] presentPaywall crashed:', error?.message ?? error, error);
		if (__DEV__) {
			Alert.alert('Paywall Error (DEV)', String(error?.message ?? error));
		}
		return false;
	}
}

// ---------------------------------------------------------------------------
// Subscription info for licensing module
// ---------------------------------------------------------------------------

export async function getSubscriptionInfo(): Promise<{
	isActive: boolean;
	planType: 'monthly' | 'yearly' | null;
}> {
	try {
		const customerInfo = await Purchases.getCustomerInfo();
		const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
		if (!entitlement) return { isActive: false, planType: null };

		const productId = entitlement.productIdentifier.toLowerCase();
		const planType = productId.includes('annual') || productId.includes('yearly')
			? 'yearly'
			: 'monthly';
		return { isActive: true, planType };
	} catch {
		return { isActive: false, planType: null };
	}
}

// ---------------------------------------------------------------------------
// Credit purchases via paywall
// ---------------------------------------------------------------------------

const CREDIT_PRODUCT_MAP: Record<string, number> = {
	'vector_credits_10': 10,
	'vector_credits_100': 100,
};

const CREDITS_OFFERING_ID = 'vector_credits';

/** Default credits when product isn't in the map (fallback). */
const DEFAULT_CREDITS = 10;

/**
 * Present the RevenueCat paywall for the `vector_credits` offering.
 * Returns the number of credits purchased (0 if cancelled/failed).
 */
export async function presentCreditPaywall(): Promise<number> {
	try {
		const offerings = await Purchases.getOfferings();
		const creditsOffering = offerings.all[CREDITS_OFFERING_ID];

		console.log('[RevenueCat] credit offerings:', Object.keys(offerings.all), 'target:', CREDITS_OFFERING_ID, 'found:', !!creditsOffering);

		if (!creditsOffering) {
			console.warn('[RevenueCat] Offering not found:', CREDITS_OFFERING_ID);
			return 0;
		}

		const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall({
			offering: creditsOffering,
		});

		console.log('[RevenueCat] credit paywall result:', paywallResult);

		if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
			// Determine credits from the first package in the offering
			const pkg = creditsOffering.availablePackages[0];
			const productId = pkg?.product.identifier ?? '';
			return CREDIT_PRODUCT_MAP[productId] ?? DEFAULT_CREDITS;
		}

		return 0;
	} catch (error: any) {
		console.error('[RevenueCat] presentCreditPaywall crashed:', error?.message ?? error, error);
		if (__DEV__) {
			Alert.alert('Credit Paywall Error (DEV)', String(error?.message ?? error));
		}
		return 0;
	}
}

export async function presentPaywallIfNeeded(offering?: PurchasesOffering): Promise<PAYWALL_RESULT> {
	try {
		let resolvedOffering = offering;
		if (!resolvedOffering) {
			try {
				const offerings = await Purchases.getOfferings();
				resolvedOffering = offerings.all[OFFERING_ID] ?? offerings.current ?? undefined;
			} catch (e) {
				console.warn('[RevenueCat] getOfferings failed in presentPaywallIfNeeded:', e);
			}
		}

		console.log('[RevenueCat] presentPaywallIfNeeded, offering:', resolvedOffering?.identifier ?? 'default');

		const paywallResult: PAYWALL_RESULT = resolvedOffering
			? await RevenueCatUI.presentPaywallIfNeeded({
					offering: resolvedOffering,
					requiredEntitlementIdentifier: ENTITLEMENT_ID,
				})
			: await RevenueCatUI.presentPaywallIfNeeded({
					requiredEntitlementIdentifier: ENTITLEMENT_ID,
				});

		return paywallResult;
	} catch (error: any) {
		console.error('[RevenueCat] presentPaywallIfNeeded crashed:', error?.message ?? error, error);
		if (__DEV__) {
			Alert.alert('Paywall Error (DEV)', String(error?.message ?? error));
		}
		return PAYWALL_RESULT.ERROR;
	}
}

// ---------------------------------------------------------------------------
// Identified user management (Sign in with Apple integration)
// ---------------------------------------------------------------------------

export async function logInToRevenueCat(appleUserId: string): Promise<boolean> {
	const { customerInfo } = await Purchases.logIn(appleUserId);
	return checkPremium(customerInfo);
}

export async function logOutFromRevenueCat(): Promise<void> {
	const isAnon = await Purchases.isAnonymous();
	if (!isAnon) {
		await Purchases.logOut();
	}
}

// ---------------------------------------------------------------------------
// Diagnostics (dev only)
// ---------------------------------------------------------------------------

export async function diagnoseRevenueCat(): Promise<void> {
	try {
		console.log('[RevenueCat:diag] --- START ---');
		const customerInfo = await Purchases.getCustomerInfo();
		console.log('[RevenueCat:diag] Customer ID:', customerInfo.originalAppUserId);
		console.log('[RevenueCat:diag] Active entitlements:', Object.keys(customerInfo.entitlements.active));

		const offerings = await Purchases.getOfferings();
		console.log('[RevenueCat:diag] Current offering:', offerings.current?.identifier ?? 'NONE');
		console.log('[RevenueCat:diag] All offering IDs:', Object.keys(offerings.all));

		const vectorPro = offerings.all[OFFERING_ID];
		if (vectorPro) {
			console.log('[RevenueCat:diag] vector_pro packages:', vectorPro.availablePackages.map(p => ({
				id: p.identifier,
				product: p.product.identifier,
				price: p.product.priceString,
			})));
		} else {
			console.warn('[RevenueCat:diag] WARNING: offering "vector_pro" not found!');
		}
		console.log('[RevenueCat:diag] --- END ---');
	} catch (error: any) {
		console.error('[RevenueCat:diag] Failed:', error?.message ?? error);
	}
}
