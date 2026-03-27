import { getMeta, setMeta, getMetaInt, setMetaInt } from '../db/meta';
import { getSubscriptionInfo } from './revenueCat';
import { getAccessToken } from './appleAuth';
import Purchases from 'react-native-purchases';
import { capture } from './analytics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUB_MONTHLY_PARSES = 4;

// Meta table keys
const META_SUB_ACTIVE = 'sub_active';
const META_SUB_PLAN_TYPE = 'sub_plan_type';
const META_SUB_ALLOWANCE_REMAINING = 'sub_allowance_remaining';
const META_SUB_ALLOWANCE_RESET_DATE = 'sub_allowance_reset_date';
const META_CREDIT_BALANCE = 'credit_balance';

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
  subPlanType: 'monthly' | 'yearly' | 'trial' | null;
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
// getLicenseInfo — synchronous read from meta table (populated by server sync)
// ---------------------------------------------------------------------------

export function getLicenseInfo(): LicenseInfo {
  const subscriptionActive = getMeta(META_SUB_ACTIVE) === '1';
  const subAllowanceRemaining = subscriptionActive ? getMetaInt(META_SUB_ALLOWANCE_REMAINING) : 0;
  const subPlanTypeRaw = getMeta(META_SUB_PLAN_TYPE);
  const subPlanType = (subPlanTypeRaw === 'monthly' || subPlanTypeRaw === 'yearly' || subPlanTypeRaw === 'trial')
    ? subPlanTypeRaw as 'monthly' | 'yearly' | 'trial'
    : null;

  const creditBalance = getMetaInt(META_CREDIT_BALANCE);

  const isTrial = subPlanType === 'trial';
  const trialRemaining = isTrial ? subAllowanceRemaining : 0;
  const trialExpired = isTrial ? subAllowanceRemaining <= 0 : true;

  // Determine active tier
  let tier: Tier = 'none';
  if (isTrial && subAllowanceRemaining > 0) {
    tier = 'trial';
  } else if (subscriptionActive && !isTrial && subAllowanceRemaining > 0) {
    tier = 'subscription';
  } else if (creditBalance > 0) {
    tier = 'credits';
  }

  const totalAvailable = subAllowanceRemaining + creditBalance;

  return {
    tier,
    trialRemaining,
    trialExpired,
    trialExpiryDate: null,
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

  // Trial with remaining parses
  if (info.subPlanType === 'trial' && info.subAllowanceRemaining > 0) {
    return { allowed: true, tier: 'trial' };
  }

  // Active subscription with remaining allowance
  if (info.subscriptionActive && info.subPlanType !== 'trial' && info.subAllowanceRemaining > 0) {
    return { allowed: true, tier: 'subscription' };
  }

  // Credit balance available
  if (info.creditBalance > 0) {
    return { allowed: true, tier: 'credits' };
  }

  // Subscriber but exhausted monthly parses — nudge top-up
  if (info.subscriptionActive && info.subPlanType !== 'trial') {
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
    reason: 'Subscribe or buy credits to continue parsing statements.',
    showPaywall: true,
    showTopUp: false,
  };
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
