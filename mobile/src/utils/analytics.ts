import type { PostHog } from 'posthog-react-native';
export { usePostHog } from 'posthog-react-native';

// ---------------------------------------------------------------------------
// Event name constants — single source of truth
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

  // Profile
  UPGRADE_TAPPED: 'upgrade_tapped',
} as const;

// ---------------------------------------------------------------------------
// Imperative capture for non-React contexts (store actions, utils)
// ---------------------------------------------------------------------------

let _client: PostHog | undefined;

export function setPostHogClient(client: PostHog) {
  _client = client;
}

export function capture(event: string, properties?: Record<string, string | number | boolean>) {
  if (__DEV__) {
    console.log('[PostHog] capture:', event, properties ?? '', _client ? '(client ready)' : '(NO CLIENT)');
  }
  _client?.capture(event, properties);
}
