import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// Replace these with your actual RevenueCat API keys
const REVENUECAT_IOS_KEY = 'test_gXkAiXkciTfZanQAXvXMteQcQKx';
const REVENUECAT_ANDROID_KEY = 'test_gXkAiXkciTfZanQAXvXMteQcQKx';

export const ENTITLEMENT_ID = 'premium';

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
