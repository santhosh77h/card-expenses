import * as SecureStore from 'expo-secure-store';
import { getMeta, setMeta, getMetaInt, setMetaInt } from '../db/meta';
import { getSubscriptionInfo, purchaseCredits as rcPurchaseCredits } from './revenueCat';
import Purchases from 'react-native-purchases';
import { capture } from './analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TRIAL_DAYS = 15;
export const TRIAL_STATEMENTS = 15;
export const MONTHLY_ALLOWANCE = 8;
export const YEARLY_ALLOWANCE = 12;

// Meta table keys
const META_TRIAL_REMAINING = 'trial_remaining';
const META_TRIAL_EXPIRY = 'trial_expiry';
const META_SUB_ALLOWANCE_REMAINING = 'sub_allowance_remaining';
const META_SUB_ALLOWANCE_RESET_MONTH = 'sub_allowance_reset_month';
const META_SUB_PLAN_TYPE = 'sub_plan_type';
const META_CREDIT_BALANCE = 'credit_balance';

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
  const secureFlag = await SecureStore.getItemAsync(SECURE_TRIAL_GRANTED);
  if (secureFlag === 'true') return; // Already granted in past install

  // Check meta table (current install)
  const existingTrial = getMeta(META_TRIAL_REMAINING);
  if (existingTrial !== null) return; // Already active

  // Grant new trial
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + TRIAL_DAYS);

  setMetaInt(META_TRIAL_REMAINING, TRIAL_STATEMENTS);
  setMeta(META_TRIAL_EXPIRY, expiry.toISOString());

  await SecureStore.setItemAsync(SECURE_TRIAL_GRANTED, 'true');
  capture('trial_started', { statements: TRIAL_STATEMENTS, days: TRIAL_DAYS });
}

// ---------------------------------------------------------------------------
// getLicenseInfo — synchronous read from meta table
// ---------------------------------------------------------------------------

export function getLicenseInfo(): LicenseInfo {
  const trialRemaining = getMetaInt(META_TRIAL_REMAINING);
  const trialExpiryStr = getMeta(META_TRIAL_EXPIRY);
  const trialExpired = trialExpiryStr ? new Date(trialExpiryStr) < new Date() : true;

  const subAllowanceRemaining = getMetaInt(META_SUB_ALLOWANCE_REMAINING);
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
  } else if (subAllowanceRemaining > 0) {
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

  // Subscription allowance available
  if (info.subAllowanceRemaining > 0) {
    return { allowed: true, tier: 'subscription' };
  }

  // Credit balance available
  if (info.creditBalance > 0) {
    return { allowed: true, tier: 'credits' };
  }

  // Nothing available — decide what to show
  if (info.subPlanType) {
    // Has subscription but exhausted monthly allowance
    return {
      allowed: false,
      reason: 'Monthly statement limit reached. Purchase additional credits to continue.',
      showPaywall: false,
      showTopUp: true,
    };
  }

  // No subscription at all
  return {
    allowed: false,
    reason: 'Your trial has ended. Subscribe to continue parsing statements.',
    showPaywall: true,
    showTopUp: false,
  };
}

// ---------------------------------------------------------------------------
// consumeOneStatement — decrement the correct balance
// ---------------------------------------------------------------------------

export function consumeOneStatement(): void {
  if (__DEV__) return;

  const info = getLicenseInfo();

  if (info.trialRemaining > 0 && !info.trialExpired) {
    setMetaInt(META_TRIAL_REMAINING, info.trialRemaining - 1);
    capture('trial_used', { remaining: info.trialRemaining - 1 });
    return;
  }

  if (info.subAllowanceRemaining > 0) {
    setMetaInt(META_SUB_ALLOWANCE_REMAINING, info.subAllowanceRemaining - 1);
    capture('sub_used', { remaining: info.subAllowanceRemaining - 1 });
    return;
  }

  if (info.creditBalance > 0) {
    const newBalance = info.creditBalance - 1;
    setMetaInt(META_CREDIT_BALANCE, newBalance);
    capture('credit_used', { remaining: newBalance });
    // Sync to RevenueCat subscriber attributes
    Purchases.setAttributes({ [RC_ATTR_CREDIT_BALANCE]: String(newBalance) });
  }
}

// ---------------------------------------------------------------------------
// refreshSubscriptionAllowance — reset on month boundary
// ---------------------------------------------------------------------------

export async function refreshSubscriptionAllowance(): Promise<void> {
  if (__DEV__) return;

  const subInfo = await getSubscriptionInfo();
  if (!subInfo.isActive) {
    // No active subscription — clear sub state
    setMeta(META_SUB_PLAN_TYPE, '');
    setMetaInt(META_SUB_ALLOWANCE_REMAINING, 0);
    return;
  }

  const planType = subInfo.planType ?? 'monthly';
  setMeta(META_SUB_PLAN_TYPE, planType);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storedResetMonth = getMeta(META_SUB_ALLOWANCE_RESET_MONTH);

  if (storedResetMonth !== currentMonth) {
    // New month — reset allowance
    const allowance = planType === 'yearly' ? YEARLY_ALLOWANCE : MONTHLY_ALLOWANCE;
    setMetaInt(META_SUB_ALLOWANCE_REMAINING, allowance);
    setMeta(META_SUB_ALLOWANCE_RESET_MONTH, currentMonth);
  }
}

// ---------------------------------------------------------------------------
// buyCredits — purchase credits via RevenueCat
// ---------------------------------------------------------------------------

export async function buyCredits(productId: string): Promise<number> {
  const creditCount = await rcPurchaseCredits(productId);
  const current = getMetaInt(META_CREDIT_BALANCE);
  const newBalance = current + creditCount;
  setMetaInt(META_CREDIT_BALANCE, newBalance);

  // Sync to RevenueCat subscriber attributes for reinstall recovery
  Purchases.setAttributes({ [RC_ATTR_CREDIT_BALANCE]: String(newBalance) });

  capture('topup_purchased', { product: productId, credits: creditCount, new_balance: newBalance });
  return newBalance;
}

// ---------------------------------------------------------------------------
// restoreCreditsFromRC — restore credit balance on reinstall
// ---------------------------------------------------------------------------

export async function restoreCreditsFromRC(): Promise<void> {
  if (__DEV__) return;

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    // subscriberAttributes may exist at runtime even if not in type defs
    const attrs = (customerInfo as any).subscriberAttributes ?? {};
    const rcCredits = attrs[RC_ATTR_CREDIT_BALANCE];
    if (rcCredits?.value) {
      const remoteBalance = parseInt(rcCredits.value, 10);
      if (!isNaN(remoteBalance) && remoteBalance > 0) {
        const localBalance = getMetaInt(META_CREDIT_BALANCE);
        if (localBalance === 0) {
          // Only restore if local is empty (fresh install)
          setMetaInt(META_CREDIT_BALANCE, remoteBalance);
        }
      }
    }
  } catch {
    // Non-fatal — credits will be 0 until next purchase syncs
  }
}
