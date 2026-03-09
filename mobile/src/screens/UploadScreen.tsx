import React, { useState } from 'react';
import {
	View,
	Text,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Modal,
	TextInput,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { colors, spacing, borderRadius, fontSize, CurrencyCode, SUPPORTED_CURRENCIES, CURRENCY_CONFIG } from '../theme';
import { useStore, StatementData, CreditCard } from '../store';
import { parseStatement, parseDemoStatement, CardInfo } from '../utils/api';
import { findByHash, insertFileHash } from '../db/fileHashes';
import { isStatementImported } from '../db/transactions';
import { ENTITLEMENT_ID } from '../utils/revenueCat';
import { Badge, Card, PrimaryButton } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import type { RootStackParamList } from '../navigation';
import { BANK_TO_ISSUER, ISSUERS, NETWORKS, ISSUER_CURRENCY, normalizeNetwork, pickUnusedColor } from '../constants/cards';

const FREE_TIER_UPLOAD_LIMIT = 3;

type UploadState = 'idle' | 'uploading' | 'parsing' | 'error';

export default function UploadScreen() {
	const insets = useSafeAreaInsets();
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const {
		cards,
		activeCardId,
		addStatement,
		addCard,
		updateCard,
		addMonthlyUsage,
		isPremium,
		uploadsThisMonth,
		_refreshUploadCount,
	} = useStore();
	const [state, setState] = useState<UploadState>('idle');
	const [error, setError] = useState<string>('');
	const [selectedCardId, setSelectedCardId] = useState<string>(activeCardId || cards[0]?.id || '');
	const [passwordModalVisible, setPasswordModalVisible] = useState(false);
	const [password, setPassword] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [pendingFile, setPendingFile] = useState<{ uri: string; name: string } | null>(null);
	const [savePasswordChecked, setSavePasswordChecked] = useState(false);

	// Card confirmation modal state
	const [cardConfirmVisible, setCardConfirmVisible] = useState(false);
	const [pendingCardData, setPendingCardData] = useState<CreditCard | null>(null);
	const [pendingParseResult, setPendingParseResult] = useState<{ parsed: any; fileHash?: string; passwordToSave?: string } | null>(null);
	const [confirmNickname, setConfirmNickname] = useState('');
	const [confirmLast4, setConfirmLast4] = useState('');
	const [confirmIssuer, setConfirmIssuer] = useState('');
	const [confirmNetwork, setConfirmNetwork] = useState('');
	const [confirmCreditLimit, setConfirmCreditLimit] = useState('');
	const [confirmCurrency, setConfirmCurrency] = useState<CurrencyCode>('INR');

	const computeFileHash = async (fileUri: string): Promise<string> => {
		const base64 = await FileSystem.readAsStringAsync(fileUri, {
			encoding: FileSystem.EncodingType.Base64,
		});
		return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
	};

	const checkDuplicate = (hash: string): boolean => {
		if (__DEV__) return false;

		const existing = findByHash(hash);
		if (!existing) return false;

		const cardName = cards.find((c) => c.id === existing.cardId)?.nickname ?? 'a card';
		const imported = isStatementImported(existing.statementId);

		let message = `This statement has already been uploaded for ${cardName}.`;
		if (imported) {
			message += '\nTransactions have also been added to your records.';
		}

		Alert.alert('Statement Already Uploaded', message, [{ text: 'OK', onPress: () => setState('idle') }]);
		return true;
	};

	const checkUploadAllowed = async (): Promise<boolean> => {
		if (__DEV__ || isPremium) return true;
		_refreshUploadCount();
		const current = useStore.getState().uploadsThisMonth;
		if (current < FREE_TIER_UPLOAD_LIMIT) return true;
		// Show paywall
		const result = await RevenueCatUI.presentPaywallIfNeeded({
			requiredEntitlementIdentifier: ENTITLEMENT_ID,
		});
		return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
	};

	const handlePick = async () => {
		try {
			const allowed = await checkUploadAllowed();
			if (!allowed) return;

			const result = await DocumentPicker.getDocumentAsync({
				type: 'application/pdf',
				copyToCacheDirectory: true,
			});

			if (result.canceled) return;

			const file = result.assets[0];
			setState('uploading');
			setError('');

			let fileHash: string | undefined;
			try {
				fileHash = await computeFileHash(file.uri);
				if (checkDuplicate(fileHash)) return;

				setState('parsing');
				const parsed = await parseStatement(file.uri, file.name);
				saveAndNavigate(parsed, fileHash);
			} catch (err: any) {
				const respData = err?.response?.data;
				console.log('[Upload] error status:', err?.response?.status);
				console.log('[Upload] error body:', JSON.stringify(respData));
				const errorCode = respData?.error_code || respData?.detail?.error_code;
				console.log('[Upload] resolved errorCode:', errorCode);
				if (errorCode === 'password_required' || errorCode === 'incorrect_password') {
					// Auto-retry with saved password if available
					const selectedCard = cards.find((c) => c.id === selectedCardId);
					if (errorCode === 'password_required' && selectedCard?.pdfPassword) {
						try {
							setState('parsing');
							const parsed = await parseStatement(file.uri, file.name, selectedCard.pdfPassword);
							saveAndNavigate(parsed, fileHash);
							return;
						} catch (retryErr: any) {
							const retryData = retryErr?.response?.data;
							const retryCode = retryData?.error_code || retryData?.detail?.error_code;
							if (retryCode === 'incorrect_password') {
								updateCard(selectedCard.id, { pdfPassword: undefined });
							}
							// Fall through to show password modal
						}
					}
					setPendingFile({ uri: file.uri, name: file.name });
					setPasswordError(errorCode === 'incorrect_password' ? 'Incorrect password. Please try again.' : '');
					setPassword('');
					setSavePasswordChecked(false);
					setPasswordModalVisible(true);
					setState('idle');
					return;
				}
				const msg =
					respData?.message ||
					(typeof respData?.detail === 'string' ? respData.detail : respData?.detail?.message) ||
					err?.message ||
					'Failed to parse statement.';
				setState('error');
				setError(msg);
			}
		} catch {
			setState('error');
			setError('Could not open file picker.');
		}
	};

	const handlePasswordSubmit = async () => {
		if (!pendingFile || !password.trim()) return;
		const usedPwd = password;
		const shouldSave = savePasswordChecked;
		setPasswordModalVisible(false);
		setState('parsing');
		setError('');
		try {
			const fileHash = await computeFileHash(pendingFile.uri);
			if (checkDuplicate(fileHash)) {
				setPendingFile(null);
				setPassword('');
				setPasswordError('');
				setSavePasswordChecked(false);
				return;
			}

			const parsed = await parseStatement(pendingFile.uri, pendingFile.name, usedPwd);
			setPendingFile(null);
			setPassword('');
			setPasswordError('');
			setSavePasswordChecked(false);
			saveAndNavigate(parsed, fileHash, shouldSave ? usedPwd : undefined);
		} catch (err: any) {
			const respData = err?.response?.data;
			const errorCode = respData?.error_code || respData?.detail?.error_code;
			if (errorCode === 'incorrect_password') {
				setPasswordError('Incorrect password. Please try again.');
				setPassword('');
				setPasswordModalVisible(true);
				setState('idle');
			} else {
				setPendingFile(null);
				setPassword('');
				setPasswordError('');
				setSavePasswordChecked(false);
				const msg =
					respData?.message ||
					(typeof respData?.detail === 'string' ? respData.detail : respData?.detail?.message) ||
					err?.message ||
					'Failed to parse statement.';
				setState('error');
				setError(msg);
			}
		}
	};

	const handlePasswordCancel = () => {
		setPasswordModalVisible(false);
		setPendingFile(null);
		setPassword('');
		setPasswordError('');
		setSavePasswordChecked(false);
	};

	const handleDemo = async () => {
		setState('parsing');
		setError('');

		const demoHash = await Crypto.digestStringAsync(
			Crypto.CryptoDigestAlgorithm.SHA256,
			'vector-demo-statement-v1',
		);
		if (checkDuplicate(demoHash)) return;

		// Small delay to show parsing state
		setTimeout(() => {
			try {
				const parsed = parseDemoStatement();
				saveAndNavigate(parsed, demoHash);
			} catch {
				setState('error');
				setError('Demo failed unexpectedly.');
			}
		}, 800);
	};

	const saveAndNavigate = (parsed: any, fileHash?: string, passwordToSave?: string) => {
		const cardInfo: CardInfo | null = parsed.card_info ?? null;
		const bankDetected: string = parsed.bank_detected || 'generic';
		const issuerName = BANK_TO_ISSUER[bankDetected] || 'Other';
		const detectedCurrency = (cardInfo?.currency || parsed.currency_detected || 'INR') as CurrencyCode;

		if (cardInfo?.card_last4) {
			// Try to find existing card by last4 + issuer
			const existing = cards.find(
				(c) => c.last4 === cardInfo.card_last4 && c.issuer.toLowerCase() === issuerName.toLowerCase(),
			);

			if (existing) {
				// Existing card matched — update metadata and proceed directly
				const updates: Partial<CreditCard> = {};
				if (cardInfo.credit_limit != null) updates.creditLimit = cardInfo.credit_limit;
				if (cardInfo.total_amount_due != null) updates.totalAmountDue = cardInfo.total_amount_due;
				if (cardInfo.minimum_amount_due != null) updates.minimumAmountDue = cardInfo.minimum_amount_due;
				if (cardInfo.payment_due_date) updates.paymentDueDate = cardInfo.payment_due_date;
				if (passwordToSave) updates.pdfPassword = passwordToSave;
				if (Object.keys(updates).length > 0) updateCard(existing.id, updates);
				finalizeSave(existing.id, existing, false, parsed, fileHash);
			} else {
				// New card detected — show confirmation modal
				const network = normalizeNetwork(cardInfo.card_network);
				const newCard: CreditCard = {
					id: `auto-${Date.now()}`,
					nickname: `${issuerName} •${cardInfo.card_last4}`,
					last4: cardInfo.card_last4,
					issuer: issuerName,
					network,
					creditLimit: cardInfo.credit_limit ?? 0,
					billingCycle: '1',
					color: pickUnusedColor(cards),
					totalAmountDue: cardInfo.total_amount_due ?? undefined,
					minimumAmountDue: cardInfo.minimum_amount_due ?? undefined,
					paymentDueDate: cardInfo.payment_due_date ?? undefined,
					autoCreated: true,
					currency: detectedCurrency,
				};
				// Populate confirmation fields
				setConfirmNickname(newCard.nickname);
				setConfirmLast4(newCard.last4);
				setConfirmIssuer(newCard.issuer);
				setConfirmNetwork(newCard.network);
				setConfirmCreditLimit(newCard.creditLimit ? String(newCard.creditLimit) : '');
				setConfirmCurrency(detectedCurrency);
				setPendingCardData(newCard);
				setPendingParseResult({ parsed, fileHash, passwordToSave });
				setState('idle');
				setCardConfirmVisible(true);
			}
		} else {
			// Fallback to selected card
			const cardId = selectedCardId || 'demo';
			const matched = cards.find((c) => c.id === cardId);
			if (passwordToSave && matched) {
				updateCard(matched.id, { pdfPassword: passwordToSave });
			}
			finalizeSave(cardId, matched, false, parsed, fileHash);
		}
	};

	const finalizeSave = (
		cardId: string,
		matched: CreditCard | undefined,
		wasAutoCreated: boolean,
		parsed: any,
		fileHash?: string,
	) => {
		const bankDetected: string = parsed.bank_detected || 'generic';
		const detectedCurrency = (parsed.card_info?.currency || parsed.currency_detected || 'INR') as CurrencyCode;

		const statementId = Date.now().toString();
		const statement: StatementData = {
			id: statementId,
			cardId,
			parsedAt: new Date().toISOString(),
			transactions: parsed.transactions,
			summary: parsed.summary,
			csv: parsed.csv,
			bankDetected: bankDetected,
			currency: detectedCurrency,
		};

		addStatement(cardId, statement);

		if (fileHash) {
			insertFileHash(fileHash, statementId, cardId);
		}

		// --- Track monthly usage ---
		const periodTo = parsed.summary?.statement_period?.to;
		if (periodTo) {
			const month = periodTo.substring(0, 7); // "YYYY-MM"
			const totalDebits = parsed.transactions
				.filter((t: any) => t.type === 'debit')
				.reduce((s: number, t: any) => s + t.amount, 0);
			const totalCredits = parsed.transactions
				.filter((t: any) => t.type === 'credit')
				.reduce((s: number, t: any) => s + t.amount, 0);
			addMonthlyUsage({
				cardId,
				month,
				totalDebits: Math.round(totalDebits * 100) / 100,
				totalCredits: Math.round(totalCredits * 100) / 100,
				net: Math.round((totalDebits - totalCredits) * 100) / 100,
				statementId,
			});
		}

		setState('idle');
		navigation.navigate('Analysis', { statementId: statement.id, cardId });
	};

	const handleCardConfirm = () => {
		if (!pendingCardData || !pendingParseResult) return;
		const confirmedCard: CreditCard = {
			...pendingCardData,
			nickname: confirmNickname.trim() || pendingCardData.nickname,
			last4: confirmLast4.trim() || pendingCardData.last4,
			issuer: confirmIssuer,
			network: confirmNetwork,
			creditLimit: parseFloat(confirmCreditLimit) || 0,
			currency: confirmCurrency,
			pdfPassword: pendingParseResult.passwordToSave,
		};
		addCard(confirmedCard);
		setCardConfirmVisible(false);
		finalizeSave(confirmedCard.id, confirmedCard, true, pendingParseResult.parsed, pendingParseResult.fileHash);
		setPendingCardData(null);
		setPendingParseResult(null);
	};

	const handleCardConfirmCancel = () => {
		setCardConfirmVisible(false);
		setPendingCardData(null);
		setPendingParseResult(null);
		setState('idle');
	};

	return (
		<>
			<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
				<View style={[styles.header, { paddingTop: insets.top + 12 }]}>
					<Text style={styles.title}>Upload Statement</Text>
					<Text style={styles.subtitle}>Parse your credit card PDF statement</Text>
				</View>

				{/* Privacy badge */}
				<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
					<Badge text="Your PDF is processed in memory and never stored" color={colors.accent} />
				</View>

				{/* Free tier usage indicator */}
				{!__DEV__ && !isPremium && (
					<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
						<Card>
							<View style={styles.usageRow}>
								<View style={{ flex: 1 }}>
									<Text style={styles.usageTitle}>
										{Math.max(0, FREE_TIER_UPLOAD_LIMIT - uploadsThisMonth)} of{' '}
										{FREE_TIER_UPLOAD_LIMIT} uploads remaining
									</Text>
									<Text style={styles.usageSubtitle}>Resets monthly</Text>
								</View>
								<TouchableOpacity
									style={styles.upgradeBtn}
									onPress={async () => {
										try {
											await RevenueCatUI.presentPaywallIfNeeded({
												requiredEntitlementIdentifier: ENTITLEMENT_ID,
											});
										} catch {}
									}}
								>
									<Feather name="zap" size={14} color="#fff" />
									<Text style={styles.upgradeBtnText}>Upgrade</Text>
								</TouchableOpacity>
							</View>
							<View style={styles.usageBarBg}>
								<View
									style={[
										styles.usageBarFill,
										{
											width: `${Math.min(100, (uploadsThisMonth / FREE_TIER_UPLOAD_LIMIT) * 100)}%`,
											backgroundColor:
												uploadsThisMonth >= FREE_TIER_UPLOAD_LIMIT
													? colors.debit
													: colors.accent,
										},
									]}
								/>
							</View>
						</Card>
					</View>
				)}

				{/* Card selector */}
				{cards.length > 1 && (
					<View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
						<Text style={styles.label}>Select Card</Text>
						<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
							{cards.map((card) => (
								<TouchableOpacity
									key={card.id}
									style={[styles.cardChip, selectedCardId === card.id && styles.cardChipActive]}
									onPress={() => setSelectedCardId(card.id)}
								>
									<Text
										style={[
											styles.cardChipText,
											selectedCardId === card.id && styles.cardChipTextActive,
										]}
									>
										{card.nickname} (*{card.last4})
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					</View>
				)}

				{/* Upload area */}
				<View style={{ paddingHorizontal: spacing.lg }}>
					<TouchableOpacity
						style={[
							styles.uploadArea,
							state === 'error' && { borderColor: colors.debit },
							(state === 'uploading' || state === 'parsing') && { borderColor: colors.accent },
						]}
						onPress={state === 'idle' || state === 'error' ? handlePick : undefined}
						activeOpacity={0.8}
						disabled={state === 'uploading' || state === 'parsing'}
					>
						{state === 'idle' && (
							<>
								<Feather name="upload-cloud" size={48} color={colors.textMuted} />
								<Text style={styles.uploadTitle}>Tap to Upload PDF</Text>
								<Text style={styles.uploadSubtitle}>Select your credit card statement (max 10 MB)</Text>
							</>
						)}
						{(state === 'uploading' || state === 'parsing') && (
							<>
								<ActivityIndicator size="large" color={colors.accent} />
								<Text style={[styles.uploadTitle, { color: colors.accent }]}>
									{state === 'uploading' ? 'Uploading...' : 'Parsing Statement...'}
								</Text>
								<Text style={styles.uploadSubtitle}>Your data is being processed securely</Text>
							</>
						)}
						{state === 'error' && (
							<>
								<Feather name="alert-circle" size={48} color={colors.debit} />
								<Text style={[styles.uploadTitle, { color: colors.debit }]}>Upload Failed</Text>
								<Text style={styles.uploadSubtitle}>{error}</Text>
								<Text style={[styles.uploadSubtitle, { color: colors.accent, marginTop: spacing.sm }]}>
									Tap to try again
								</Text>
							</>
						)}
					</TouchableOpacity>
				</View>

				{/* Demo button */}
				<View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
					<PrimaryButton
						title="Try Demo"
						icon="play"
						variant="outline"
						onPress={handleDemo}
						disabled={state === 'uploading' || state === 'parsing'}
					/>
				</View>

				{/* Privacy info */}
				<View style={{ padding: spacing.lg, marginTop: spacing.lg }}>
					<Card>
						<View style={styles.privacyRow}>
							<Feather name="shield" size={20} color={colors.accent} />
							<View style={{ flex: 1, marginLeft: spacing.md }}>
								<Text style={styles.privacyTitle}>Privacy First</Text>
								<Text style={styles.privacyText}>
									Your PDF is parsed in-memory on our server and immediately discarded. No financial
									data is ever stored, logged, or shared.
								</Text>
							</View>
						</View>
					</Card>
				</View>

				<View style={{ height: 40 }} />
			</ScrollView>

			<Modal
				visible={passwordModalVisible}
				transparent
				animationType="fade"
				onRequestClose={handlePasswordCancel}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={styles.modalOverlay}
				>
					<View style={styles.modalCard}>
						<Feather name="lock" size={36} color={colors.accent} style={{ alignSelf: 'center' }} />
						<Text style={styles.modalTitle}>Password Required</Text>
						<Text style={styles.modalSubtitle}>
							This PDF is password-protected. Common passwords are your date of birth, PAN number, or card
							last 4 digits.
						</Text>
						{!!passwordError && <Text style={styles.modalError}>{passwordError}</Text>}
						<TextInput
							style={styles.modalInput}
							placeholder="Enter PDF password"
							placeholderTextColor={colors.textMuted}
							secureTextEntry
							autoFocus
							value={password}
							onChangeText={setPassword}
							onSubmitEditing={handlePasswordSubmit}
							returnKeyType="done"
						/>
						<TouchableOpacity
							style={styles.checkboxRow}
							onPress={() => setSavePasswordChecked((prev) => !prev)}
							activeOpacity={0.7}
						>
							<View style={[styles.checkbox, savePasswordChecked && styles.checkboxChecked]}>
								{savePasswordChecked && <Feather name="check" size={14} color="#fff" />}
							</View>
							<Text style={styles.checkboxLabel}>Save password for this card</Text>
						</TouchableOpacity>
						<View style={styles.modalButtons}>
							<TouchableOpacity style={styles.modalCancelBtn} onPress={handlePasswordCancel}>
								<Text style={styles.modalCancelText}>Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.modalUnlockBtn, !password.trim() && { opacity: 0.5 }]}
								onPress={handlePasswordSubmit}
								disabled={!password.trim()}
							>
								<Feather name="unlock" size={16} color="#fff" style={{ marginRight: 6 }} />
								<Text style={styles.modalUnlockText}>Unlock</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Card Confirmation Modal */}
			<Modal
				visible={cardConfirmVisible}
				transparent
				animationType="fade"
				onRequestClose={handleCardConfirmCancel}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={styles.modalOverlay}
				>
					<ScrollView
						style={{ width: '100%' }}
						contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }}
						keyboardShouldPersistTaps="handled"
					>
						<View style={styles.modalCard}>
							<Feather name="credit-card" size={36} color={colors.accent} style={{ alignSelf: 'center' }} />
							<Text style={styles.modalTitle}>New Card Detected</Text>
							<Text style={styles.modalSubtitle}>
								Review the details below before adding this card.
							</Text>

							{/* Card preview */}
							<View style={{ alignItems: 'center', marginTop: spacing.lg }}>
								<CreditCardView
									card={{
										id: pendingCardData?.id ?? '',
										nickname: confirmNickname || 'New Card',
										last4: confirmLast4 || '••••',
										issuer: confirmIssuer,
										network: confirmNetwork,
										creditLimit: parseFloat(confirmCreditLimit) || 0,
										billingCycle: '1',
										color: pendingCardData?.color ?? '#1E3A5F',
										currency: confirmCurrency,
									}}
									compact
								/>
							</View>

							{/* Nickname */}
							<Text style={styles.confirmFieldLabel}>Nickname</Text>
							<TextInput
								style={styles.modalInput}
								placeholder="e.g. HDFC •1234"
								placeholderTextColor={colors.textMuted}
								value={confirmNickname}
								onChangeText={setConfirmNickname}
							/>

							{/* Last 4 Digits */}
							<Text style={styles.confirmFieldLabel}>Last 4 Digits</Text>
							<TextInput
								style={styles.modalInput}
								placeholder="1234"
								placeholderTextColor={colors.textMuted}
								value={confirmLast4}
								onChangeText={(t) => setConfirmLast4(t.replace(/\D/g, '').slice(0, 4))}
								keyboardType="number-pad"
								maxLength={4}
							/>

							{/* Issuer picker */}
							<Text style={styles.confirmFieldLabel}>Issuer</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
								{ISSUERS.map((iss) => (
									<TouchableOpacity
										key={iss}
										style={[styles.chipOption, confirmIssuer === iss && styles.chipOptionActive]}
										onPress={() => {
											setConfirmIssuer(iss);
											if (ISSUER_CURRENCY[iss]) setConfirmCurrency(ISSUER_CURRENCY[iss]);
										}}
									>
										<Text style={[styles.chipOptionText, confirmIssuer === iss && styles.chipOptionTextActive]}>
											{iss}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>

							{/* Network picker */}
							<Text style={styles.confirmFieldLabel}>Network</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
								{NETWORKS.map((net) => (
									<TouchableOpacity
										key={net}
										style={[styles.chipOption, confirmNetwork === net && styles.chipOptionActive]}
										onPress={() => setConfirmNetwork(net)}
									>
										<Text style={[styles.chipOptionText, confirmNetwork === net && styles.chipOptionTextActive]}>
											{net}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>

							{/* Credit Limit */}
							<Text style={styles.confirmFieldLabel}>Credit Limit</Text>
							<TextInput
								style={styles.modalInput}
								placeholder="0"
								placeholderTextColor={colors.textMuted}
								value={confirmCreditLimit}
								onChangeText={setConfirmCreditLimit}
								keyboardType="numeric"
							/>

							{/* Currency picker */}
							<Text style={styles.confirmFieldLabel}>Currency</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
								{SUPPORTED_CURRENCIES.map((cur) => (
									<TouchableOpacity
										key={cur}
										style={[styles.chipOption, confirmCurrency === cur && styles.chipOptionActive]}
										onPress={() => setConfirmCurrency(cur)}
									>
										<Text style={[styles.chipOptionText, confirmCurrency === cur && styles.chipOptionTextActive]}>
											{CURRENCY_CONFIG[cur].symbol} {cur}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>

							{/* Buttons */}
							<View style={[styles.modalButtons, { marginTop: spacing.xl }]}>
								<TouchableOpacity style={styles.modalCancelBtn} onPress={handleCardConfirmCancel}>
									<Text style={styles.modalCancelText}>Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.modalUnlockBtn, !confirmLast4.trim() && { opacity: 0.5 }]}
									onPress={handleCardConfirm}
									disabled={!confirmLast4.trim()}
								>
									<Feather name="check" size={16} color="#fff" style={{ marginRight: 6 }} />
									<Text style={styles.modalUnlockText}>Confirm & Continue</Text>
								</TouchableOpacity>
							</View>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.md,
	},
	title: {
		color: colors.textPrimary,
		fontSize: fontSize.xxxl,
		fontWeight: '600',
		lineHeight: 32,
	},
	subtitle: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: spacing.xs,
		lineHeight: 18,
	},
	label: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '600',
		lineHeight: 18,
	},
	cardChip: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		backgroundColor: colors.surfaceElevated,
		marginRight: spacing.sm,
	},
	cardChipActive: {
		backgroundColor: colors.accent + '20',
		borderWidth: 1,
		borderColor: colors.accent,
	},
	cardChipText: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '500',
		lineHeight: 18,
	},
	cardChipTextActive: {
		color: colors.accent,
	},
	uploadArea: {
		borderWidth: 2,
		borderColor: colors.border,
		borderStyle: 'dashed',
		borderRadius: borderRadius.xl,
		paddingVertical: spacing.xxxl * 2,
		paddingHorizontal: spacing.xl,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.surface,
	},
	uploadTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.xl,
		fontWeight: '600',
		marginTop: spacing.lg,
		lineHeight: 26,
	},
	uploadSubtitle: {
		color: colors.textMuted,
		fontSize: fontSize.sm,
		textAlign: 'center',
		marginTop: spacing.sm,
		lineHeight: 18,
	},
	confirmFieldLabel: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '600',
		marginTop: spacing.md,
		lineHeight: 18,
	},
	chipOption: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		backgroundColor: colors.surface,
		marginRight: spacing.xs,
		borderWidth: 1,
		borderColor: colors.border,
	},
	chipOptionActive: {
		backgroundColor: colors.accent + '20',
		borderColor: colors.accent,
	},
	chipOptionText: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '500',
		lineHeight: 18,
	},
	chipOptionTextActive: {
		color: colors.accent,
	},
	privacyRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	privacyTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.md,
		fontWeight: '600',
		lineHeight: 20,
	},
	privacyText: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: spacing.xs,
		lineHeight: 18,
	},
	usageRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	usageTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		fontWeight: '600',
		lineHeight: 18,
	},
	usageSubtitle: {
		color: colors.textMuted,
		fontSize: fontSize.xs,
		marginTop: 2,
		lineHeight: 16,
	},
	upgradeBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		backgroundColor: colors.accent,
	},
	upgradeBtnText: {
		color: '#fff',
		fontSize: fontSize.sm,
		fontWeight: '600',
		lineHeight: 18,
	},
	usageBarBg: {
		height: 4,
		borderRadius: 2,
		backgroundColor: colors.border,
		marginTop: spacing.md,
		overflow: 'hidden' as const,
	},
	usageBarFill: {
		height: '100%',
		borderRadius: 2,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.7)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: spacing.lg,
	},
	modalCard: {
		width: '100%',
		backgroundColor: colors.surfaceElevated,
		borderRadius: borderRadius.xl,
		padding: spacing.xl,
	},
	modalTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.xl,
		fontWeight: '600',
		textAlign: 'center',
		marginTop: spacing.md,
		lineHeight: 26,
	},
	modalSubtitle: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		textAlign: 'center',
		marginTop: spacing.sm,
		lineHeight: 18,
	},
	modalError: {
		color: colors.debit,
		fontSize: fontSize.sm,
		textAlign: 'center',
		marginTop: spacing.sm,
		fontWeight: '600',
		lineHeight: 18,
	},
	modalInput: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: borderRadius.lg,
		color: colors.textPrimary,
		fontSize: fontSize.md,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		marginTop: spacing.lg,
	},
	checkboxRow: {
		flexDirection: 'row' as const,
		alignItems: 'center' as const,
		marginTop: spacing.md,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: borderRadius.sm,
		borderWidth: 1.5,
		borderColor: colors.border,
		alignItems: 'center' as const,
		justifyContent: 'center' as const,
		marginRight: spacing.sm,
	},
	checkboxChecked: {
		backgroundColor: colors.accent,
		borderColor: colors.accent,
	},
	checkboxLabel: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		lineHeight: 18,
	},
	modalButtons: {
		flexDirection: 'row',
		marginTop: spacing.lg,
		gap: spacing.sm,
	},
	modalCancelBtn: {
		flex: 1,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.lg,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalCancelText: {
		color: colors.textSecondary,
		fontSize: fontSize.md,
		fontWeight: '600',
		lineHeight: 20,
	},
	modalUnlockBtn: {
		flex: 1,
		flexDirection: 'row',
		paddingVertical: spacing.md,
		borderRadius: borderRadius.lg,
		backgroundColor: colors.accent,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalUnlockText: {
		color: '#fff',
		fontSize: fontSize.md,
		fontWeight: '600',
		lineHeight: 20,
	},
});
