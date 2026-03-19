import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// Replace these with your actual RevenueCat API keys
const REVENUECAT_IOS_KEY = 'test_gXkAiXkciTfZanQAXvXMteQcQKx';
const REVENUECAT_ANDROID_KEY = 'test_gXkAiXkciTfZanQAXvXMteQcQKx';

// export const ENTITLEMENT_ID = 'Credit Analytics Pro';
export const ENTITLEMENT_ID = 'Vector Expense';

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

export async function presentPaywall(offering?: PurchasesOffering): Promise<boolean> {
	const paywallResult: PAYWALL_RESULT = offering
		? await RevenueCatUI.presentPaywall({ offering })
		: await RevenueCatUI.presentPaywall();

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
// Credit purchases
// ---------------------------------------------------------------------------

const CREDIT_PRODUCT_MAP: Record<string, number> = {
	'vector_credits_30': 30,
	'vector_credits_70': 70,
};

export async function purchaseCredits(productId: string): Promise<number> {
	await Purchases.purchaseStoreProduct({
		identifier: productId,
	} as any);
	return CREDIT_PRODUCT_MAP[productId] ?? 30;
}

export async function presentPaywallIfNeeded(offering?: PurchasesOffering): Promise<PAYWALL_RESULT> {
	const paywallResult: PAYWALL_RESULT = offering
		? await RevenueCatUI.presentPaywallIfNeeded({
				offering,
				requiredEntitlementIdentifier: ENTITLEMENT_ID,
			})
		: await RevenueCatUI.presentPaywallIfNeeded({
				requiredEntitlementIdentifier: ENTITLEMENT_ID,
			});

	return paywallResult;
}
