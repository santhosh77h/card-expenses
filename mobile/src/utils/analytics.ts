import type { PostHog } from 'posthog-react-native';
export { usePostHog } from 'posthog-react-native';
import analytics from '@react-native-firebase/analytics';

// ---------------------------------------------------------------------------
// Event name constants - single source of truth
// ---------------------------------------------------------------------------

export const AnalyticsEvents = {
  // Upload flow
  STATEMENT_UPLOAD_STARTED: 'statement_upload_started',
  STATEMENT_UPLOAD_SUCCESS: 'statement_upload_success',
  STATEMENT_UPLOAD_FAILED: 'statement_upload_failed',
  STATEMENT_PASSWORD_REQUIRED: 'statement_password_required',
  DEMO_STATEMENT_LOADED: 'demo_statement_loaded',

  // Transactions
  TRANSACTION_ADDED: 'transaction_added',

  // Batch upload
  BATCH_UPLOAD_STARTED: 'batch_upload_started',
  BATCH_UPLOAD_COMPLETE: 'batch_upload_complete',

  // Analysis
  TRANSACTIONS_IMPORTED: 'transactions_imported',
  CSV_EXPORTED: 'csv_exported',
  QA_SHARED: 'qa_shared',

  // Profile
  UPGRADE_TAPPED: 'upgrade_tapped',

  // Licensing
  TRIAL_STARTED: 'trial_started',
  TRIAL_USED: 'trial_used',
  SUB_USED: 'sub_used',
  CREDIT_USED: 'credit_used',
  PAYWALL_SHOWN: 'paywall_shown',
  TOPUP_NUDGE_SHOWN: 'topup_nudge_shown',
  TOPUP_PURCHASED: 'topup_purchased',

  // Credit store
  CREDIT_STORE_OPENED: 'credit_store_opened',
  CREDIT_PURCHASE_SUCCESS: 'credit_purchase_success',
  CREDIT_PURCHASE_CANCELLED: 'credit_purchase_cancelled',
} as const;

// ---------------------------------------------------------------------------
// PostHog — imperative client for non-React contexts
// ---------------------------------------------------------------------------

let _client: PostHog | undefined;

export function setPostHogClient(client: PostHog) {
  _client = client;
}

// ---------------------------------------------------------------------------
// Google Analytics — initialization
// ---------------------------------------------------------------------------

let _gaReady = false;

export async function initGoogleAnalytics() {
  try {
    await analytics().setAnalyticsCollectionEnabled(true);
    _gaReady = true;
    if (__DEV__) console.log('[GA4] Analytics collection enabled');
  } catch (e: any) {
    console.warn('[GA4] Failed to initialize:', e?.message);
  }
}

// ---------------------------------------------------------------------------
// Unified capture — dispatches to both PostHog and GA4
// ---------------------------------------------------------------------------

export function capture(event: string, properties?: Record<string, string | number | boolean>) {
  if (__DEV__) {
    console.log('[Analytics] capture:', event, properties ?? '');
  }

  // PostHog
  _client?.capture(event, properties);

  // Google Analytics (GA4)
  if (_gaReady) {
    analytics().logEvent(event, properties).catch((e) => {
      if (__DEV__) console.warn('[GA4] logEvent failed:', e?.message);
    });
  }
}

// ---------------------------------------------------------------------------
// GA4 screen tracking — call from navigation state change
// ---------------------------------------------------------------------------

export async function logScreenView(screenName: string, screenClass?: string) {
  if (_gaReady) {
    try {
      await analytics().logScreenView({ screen_name: screenName, screen_class: screenClass ?? screenName });
    } catch (e: any) {
      if (__DEV__) console.warn('[GA4] logScreenView failed:', e?.message);
    }
  }
}

// ---------------------------------------------------------------------------
// GA4 user properties — call after auth or subscription changes
// ---------------------------------------------------------------------------

export async function setUserProperties(props: Record<string, string | null>) {
  if (_gaReady) {
    try {
      for (const [key, value] of Object.entries(props)) {
        await analytics().setUserProperty(key, value);
      }
    } catch (e: any) {
      if (__DEV__) console.warn('[GA4] setUserProperty failed:', e?.message);
    }
  }
}

export async function setUserId(userId: string | null) {
  if (_gaReady) {
    try {
      await analytics().setUserId(userId);
    } catch (e: any) {
      if (__DEV__) console.warn('[GA4] setUserId failed:', e?.message);
    }
  }
}
