import { getMeta, setMeta, getMetaInt, setMetaInt } from '../db/meta';
import { getSubscriptionInfo } from './revenueCat';
import { getAccessToken } from './appleAuth';
import Purchases from 'react-native-purchases';
import { capture } from './analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRIAL_DAYS = 15;
export const TRIAL_STATEMENTS = 15;
export const SUB_MONTHLY_PARSES = 4;

// Meta table keys
const META_TRIAL_REMAINING = 'trial_remaining';
const META_TRIAL_EXPIRY = 'trial_expiry';
const META_SUB_ACTIVE = 'sub_active';
const META_SUB_PLAN_TYPE = 'sub_plan_type';
const META_SUB_ALLOWANCE_REMAINING = 'sub_allowance_remaining';
const META_SUB_ALLOWANCE_RESET_DATE = 'sub_allowance_reset_date';
const META_CREDIT_BALANCE = 'credit_balance';

// Lazy-load SecureStore to avoid crash when native module isn't linked (dev client)
const getSecureStore = () => require('expo-secure-store') as typeof import('expo-secure-store');

// SecureStore key (survives reinstall on iOS, persists across app data clear)
const SECURE_TRIAL_GRANTED = 'vector_trial_granted';

// RevenueCat subscriber attribute key for credit balance
const RC_ATTR_CREDIT_BALANCE = 'credit_balance';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tier = 'trial' | 'subscription' | 'credits' | 'none';

export interface LicenseInfo {
  tier: Tier;
  trialRemaining: number;
  trialExpired: boolean;
  trialExpiryDate: string | null;
  subscriptionActive: boolean;
  subAllowanceRemaining: number;
  subPlanType: 'monthly' | 'yearly' | null;
  creditBalance: number;
  totalAvailable: number;
}

export interface CheckResult {
  allowed: boolean;
  tier?: Tier;
  reason?: string;
  showPaywall?: boolean;
  showTopUp?: boolean;
}

// ---------------------------------------------------------------------------
// initTrialIfNeeded — called once on boot
// ---------------------------------------------------------------------------

export async function initTrialIfNeeded(): Promise<void> {
  // Dev bypass — trial always available
  if (__DEV__) return;

  // Check SecureStore first (survives reinstall on iOS)
  const secureFlag = await getSecureStore().getItemAsync(SECURE_TRIAL_GRANTED);
  if (secureFlag === 'true') return; // Already granted in past install

  // Check meta table (current install)
  const existingTrial = getMeta(META_TRIAL_REMAINING);
  if (existingTrial !== null) return; // Already active

  // Grant new trial
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TRIAL_DAYS);

  setMetaInt(META_TRIAL_REMAINING, TRIAL_STATEMENTS);
  setMeta(META_TRIAL_EXPIRY, expiry.toISOString());

  await getSecureStore().setItemAsync(SECURE_TRIAL_GRANTED, 'true');
  capture('trial_started', { statements: TRIAL_STATEMENTS, days: TRIAL_DAYS });
}

// ---------------------------------------------------------------------------
// getLicenseInfo — synchronous read from meta table
// ---------------------------------------------------------------------------

export function getLicenseInfo(): LicenseInfo {
  const trialRemaining = getMetaInt(META_TRIAL_REMAINING);
  const trialExpiryStr = getMeta(META_TRIAL_EXPIRY);
  const trialExpired = trialExpiryStr ? new Date(trialExpiryStr) < new Date() : true;

  const subscriptionActive = getMeta(META_SUB_ACTIVE) === '1';
  const subAllowanceRemaining = subscriptionActive ? getMetaInt(META_SUB_ALLOWANCE_REMAINING) : 0;
  const subPlanTypeRaw = getMeta(META_SUB_PLAN_TYPE);
  const subPlanType = (subPlanTypeRaw === 'monthly' || subPlanTypeRaw === 'yearly')
    ? subPlanTypeRaw
    : null;

  const creditBalance = getMetaInt(META_CREDIT_BALANCE);

  // Determine active tier
  let tier: Tier = 'none';
  const trialActive = trialRemaining > 0 && !trialExpired;
  if (trialActive) {
    tier = 'trial';
  } else if (subscriptionActive && subAllowanceRemaining > 0) {
    tier = 'subscription';
  } else if (creditBalance > 0) {
    tier = 'credits';
  }

  const totalAvailable =
    (trialActive ? trialRemaining : 0) +
    subAllowanceRemaining +
    creditBalance;

  return {
    tier,
    trialRemaining,
    trialExpired,
    trialExpiryDate: trialExpiryStr,
    subscriptionActive,
    subAllowanceRemaining,
    subPlanType,
    creditBalance,
    totalAvailable,
  };
}

// ---------------------------------------------------------------------------
// checkUploadAllowed
// ---------------------------------------------------------------------------

export function checkUploadAllowed(): CheckResult {
  if (__DEV__) return { allowed: true, tier: 'trial' };

  const info = getLicenseInfo();

  // Trial available
  if (info.trialRemaining > 0 && !info.trialExpired) {
    return { allowed: true, tier: 'trial' };
  }

  // Active subscription with remaining allowance
  if (info.subscriptionActive && info.subAllowanceRemaining > 0) {
    return { allowed: true, tier: 'subscription' };
  }

  // Credit balance available
  if (info.creditBalance > 0) {
    return { allowed: true, tier: 'credits' };
  }

  // Subscriber but exhausted monthly parses — nudge top-up
  if (info.subscriptionActive) {
    return {
      allowed: false,
      reason: 'You\u2019ve used all 4 parses this month. Purchase credits to continue.',
      showPaywall: false,
      showTopUp: true,
    };
  }

  // No subscription at all — show paywall
  return {
    allowed: false,
    reason: 'Your trial has ended. Subscribe to continue parsing statements.',
    showPaywall: true,
    showTopUp: false,
  };
}

// ---------------------------------------------------------------------------
// consumeTrialStatement — decrement trial balance (local-only)
// Subscription and credit deductions are handled server-side.
// ---------------------------------------------------------------------------

export function consumeTrialStatement(): void {
  if (__DEV__) return;

  const info = getLicenseInfo();
  if (info.trialRemaining > 0 && !info.trialExpired) {
    setMetaInt(META_TRIAL_REMAINING, info.trialRemaining - 1);
    capture('trial_used', { remaining: info.trialRemaining - 1 });
  }
}

// ---------------------------------------------------------------------------
// syncAfterParse — refresh local state from backend after a successful parse
// ---------------------------------------------------------------------------

export async function syncAfterParse(): Promise<void> {
  await syncLicenseFromServer();
}

// ---------------------------------------------------------------------------
// syncLicenseFromServer — sync from backend when authenticated
// ---------------------------------------------------------------------------

import { signRequest } from './hmac';
import { API_URL, VECTOR_API_KEY } from './constants';

export async function syncLicenseFromServer(): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(`${API_URL}/api/subscription`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Vector-API-Key': VECTOR_API_KEY,
        ...signRequest('/api/subscription'),
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    const { subscription, usage, credits } = data;

    if (subscription?.status === 'active') {
      setMeta(META_SUB_ACTIVE, '1');
      setMeta(META_SUB_PLAN_TYPE, subscription.plan ?? 'monthly');
      const remaining = Math.max(0, (subscription.max_parses ?? 0) - (usage?.parses_used ?? 0));
      setMetaInt(META_SUB_ALLOWANCE_REMAINING, remaining);
    } else {
      setMeta(META_SUB_ACTIVE, '0');
      setMeta(META_SUB_PLAN_TYPE, '');
      setMetaInt(META_SUB_ALLOWANCE_REMAINING, 0);
    }

    // Sync credit balance from server (server is source of truth when authenticated)
    if (credits && typeof credits.balance === 'number') {
      setMetaInt(META_CREDIT_BALANCE, credits.balance);
      Purchases.setAttributes({ [RC_ATTR_CREDIT_BALANCE]: String(credits.balance) });
    }

    return true;
  } catch {
    return false; // Fall back to local state
  }
}

// ---------------------------------------------------------------------------
// refreshSubscriptionStatus — sync subscription state
// ---------------------------------------------------------------------------

export async function refreshSubscriptionStatus(): Promise<void> {
  if (__DEV__) return;

  // Try server sync first if authenticated
  const serverSynced = await syncLicenseFromServer();
  if (serverSynced) return;

  // Fall back to RevenueCat-only sync for anonymous users
  const subInfo = await getSubscriptionInfo();

  if (!subInfo.isActive) {
    setMeta(META_SUB_ACTIVE, '0');
    setMeta(META_SUB_PLAN_TYPE, '');
    setMetaInt(META_SUB_ALLOWANCE_REMAINING, 0);
    return;
  }

  setMeta(META_SUB_ACTIVE, '1');
  setMeta(META_SUB_PLAN_TYPE, subInfo.planType ?? 'monthly');

  // Rolling 30-day allowance reset — fair regardless of when user subscribes
  const resetDateStr = getMeta(META_SUB_ALLOWANCE_RESET_DATE);
  const now = new Date();

  if (!resetDateStr) {
    // First time — grant allowance
    setMetaInt(META_SUB_ALLOWANCE_REMAINING, SUB_MONTHLY_PARSES);
    setMeta(META_SUB_ALLOWANCE_RESET_DATE, now.toISOString());
  } else {
    const resetDate = new Date(resetDateStr);
    const daysSinceReset = (now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReset >= 30) {
      setMetaInt(META_SUB_ALLOWANCE_REMAINING, SUB_MONTHLY_PARSES);
      setMeta(META_SUB_ALLOWANCE_RESET_DATE, now.toISOString());
    }
  }
}

