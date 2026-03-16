import React, { useMemo, useRef, useState } from 'react';
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
import { spacing, borderRadius, fontSize, CurrencyCode, DateFormat, SUPPORTED_CURRENCIES, CURRENCY_CONFIG } from '../theme';
import type { ThemeColors } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, StatementData, CreditCard } from '../store';
import { parseStatement, parseDemoStatement, CardInfo } from '../utils/api';
import { findByHash, insertFileHash } from '../db/fileHashes';
import { Badge, Card, PrimaryButton, ProgressBar } from '../components/ui';
import CreditCardView from '../components/CreditCardView';
import type { RootStackParamList } from '../navigation';
import { BANK_TO_ISSUER, ISSUERS, NETWORKS, ISSUER_CURRENCY, normalizeNetwork, pickUnusedColor } from '../constants/cards';
import { capture, AnalyticsEvents } from '../utils/analytics';

const FREE_TIER_UPLOAD_LIMIT = 3;
const NEW_CARD_ID = '__new__';

type FileStatus = 'pending' | 'hashing' | 'parsing' | 'success' | 'failed' | 'duplicate' | 'skipped' | 'reparse';

interface BatchFileItem {
	uri: string;
	name: string;
	status: FileStatus;
	error?: string;
	fileHash?: string;
	parseResult?: any;
	statementId?: string;
	existingStatementId?: string;
	existingCardId?: string;
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'error' | 'batch';

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
	const colors = useColors();
	const styles = useMemo(() => createStyles(colors), [colors]);

	const [state, setState] = useState<UploadState>('idle');
	const [error, setError] = useState<string>('');
	const [selectedCardId, setSelectedCardId] = useState<string>(activeCardId || cards[0]?.id || NEW_CARD_ID);
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

	// Batch state
	const [batchFiles, setBatchFiles] = useState<BatchFileItem[]>([]);
	const [batchIndex, setBatchIndex] = useState(0);
	const [batchCardId, setBatchCardId] = useState<string | null>(null);
	const [batchPassword, setBatchPassword] = useState<string | null>(null);
	const [batchComplete, setBatchComplete] = useState(false);
	const [isNewCardFlow, setIsNewCardFlow] = useState(false);
	const batchCancelledRef = useRef(false);
	const batchFilesRef = useRef<BatchFileItem[]>([]);
	// Track which batch index needs password retry
	const batchPasswordIndexRef = useRef<number>(0);

	const computeFileHash = async (fileUri: string): Promise<string> => {
		const base64 = await FileSystem.readAsStringAsync(fileUri, {
			encoding: FileSystem.EncodingType.Base64,
		});
		return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
	};

	const checkDuplicateSilent = (hash: string): { isDuplicate: boolean; cardName?: string; existingStatementId?: string; existingCardId?: string } => {
		if (__DEV__) return { isDuplicate: false };
		const existing = findByHash(hash);
		if (!existing) return { isDuplicate: false };
		const cardName = cards.find((c) => c.id === existing.cardId)?.nickname ?? 'a card';
		return { isDuplicate: true, cardName, existingStatementId: existing.statementId, existingCardId: existing.cardId };
	};

	const checkUploadAllowed = async (): Promise<boolean> => {
		return true;
	};

	// -----------------------------------------------------------------------
	// Batch helpers
	// -----------------------------------------------------------------------

	const updateBatchFile = (index: number, updates: Partial<BatchFileItem>) => {
		batchFilesRef.current = batchFilesRef.current.map((f, i) =>
			i === index ? { ...f, ...updates } : f,
		);
		setBatchFiles([...batchFilesRef.current]);
	};

	const resetBatch = () => {
		setBatchFiles([]);
		setBatchIndex(0);
		setBatchCardId(null);
		setBatchPassword(null);
		setBatchComplete(false);
		setIsNewCardFlow(false);
		batchCancelledRef.current = false;
		batchFilesRef.current = [];
		setState('idle');
	};

	// -----------------------------------------------------------------------
	// finalizeSaveForBatch — saves statement + returns statementId, no nav
	// -----------------------------------------------------------------------

	const finalizeSaveForBatch = (
		cardId: string,
		parsed: any,
		fileHash?: string,
	): string => {
		const bankDetected: string = parsed.bank_detected || 'generic';
		const detectedCurrency = (parsed.card_info?.currency || parsed.currency_detected || 'INR') as CurrencyCode;
		const detectedDateFormat = (['DMY', 'MDY', 'YMD'].includes(parsed.date_format_detected ?? '')
			? parsed.date_format_detected
			: undefined) as DateFormat | undefined;

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
			dateFormat: detectedDateFormat,
		};

		addStatement(cardId, statement);
		capture(AnalyticsEvents.STATEMENT_UPLOAD_SUCCESS, {
			bank: bankDetected,
			transaction_count: parsed.transactions.length,
			currency: detectedCurrency,
		});

		if (fileHash) {
			insertFileHash(fileHash, statementId, cardId);
		}

		// Update card metadata from parsed card_info (credit limit, due amounts, etc.)
		const cardInfo: CardInfo | null = parsed.card_info ?? null;
		const matched = cards.find((c) => c.id === cardId);
		if (matched && cardInfo) {
			const updates: Partial<CreditCard> = {};
			if (cardInfo.credit_limit != null) updates.creditLimit = cardInfo.credit_limit;
			if (cardInfo.total_amount_due != null) updates.totalAmountDue = cardInfo.total_amount_due;
			if (cardInfo.minimum_amount_due != null) updates.minimumAmountDue = cardInfo.minimum_amount_due;
			if (cardInfo.payment_due_date) updates.paymentDueDate = cardInfo.payment_due_date;
			if (Object.keys(updates).length > 0) updateCard(matched.id, updates);
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

		return statementId;
	};

	// -----------------------------------------------------------------------
	// finalizeSave — single-file path (demo + legacy), saves + navigates
	// -----------------------------------------------------------------------

	const finalizeSave = (
		cardId: string,
		matched: CreditCard | undefined,
		wasAutoCreated: boolean,
		parsed: any,
		fileHash?: string,
	) => {
		if (matched && pendingParseResult?.passwordToSave) {
			updateCard(matched.id, { pdfPassword: pendingParseResult.passwordToSave });
		}
		const statementId = finalizeSaveForBatch(cardId, parsed, fileHash);
		setState('idle');
		navigation.navigate('Analysis', { statementId, cardId });
	};

	// -----------------------------------------------------------------------
	// processBatch — sequential processing loop
	// -----------------------------------------------------------------------

	const processBatch = async (startIndex: number, cardIdOverride?: string, passwordOverride?: string | null) => {
		const currentCardId = cardIdOverride ?? batchCardId;
		const currentPassword = passwordOverride !== undefined ? passwordOverride : batchPassword;
		const files = batchFilesRef.current;

		for (let i = startIndex; i < files.length; i++) {
			// Check cancelled
			if (batchCancelledRef.current) {
				for (let j = i; j < files.length; j++) {
					updateBatchFile(j, { status: 'skipped' });
				}
				break;
			}

			setBatchIndex(i);

			// Hash
			updateBatchFile(i, { status: 'hashing' });
			let fileHash: string | undefined;
			try {
				fileHash = await computeFileHash(files[i].uri);
				const dupResult = checkDuplicateSilent(fileHash);
				if (dupResult.isDuplicate) {
					// Pause batch — ask user whether to re-parse or skip
					updateBatchFile(i, { status: 'duplicate', fileHash, existingStatementId: dupResult.existingStatementId, existingCardId: dupResult.existingCardId });
					const userChoice = await new Promise<'skip' | 'reparse'>((resolve) => {
						Alert.alert(
							'Statement Already Uploaded',
							`This statement was already uploaded for ${dupResult.cardName}. Re-parse to check for changes?`,
							[
								{ text: 'Skip', style: 'cancel', onPress: () => resolve('skip') },
								{ text: 'Re-parse & Update', onPress: () => resolve('reparse') },
							],
							{ cancelable: false },
						);
					});
					if (userChoice === 'skip') {
						continue;
					}
					// User chose re-parse — continue to parsing below, mark with existing info
					updateBatchFile(i, { status: 'parsing', fileHash, existingStatementId: dupResult.existingStatementId, existingCardId: dupResult.existingCardId });
				}
			} catch {
				updateBatchFile(i, { status: 'failed', error: 'Failed to read file' });
				continue;
			}

			// Parse
			updateBatchFile(i, { status: 'parsing', fileHash });

			// Determine password: batch password > card saved password
			let pwd = currentPassword || undefined;
			if (!pwd && currentCardId) {
				const selectedCard = cards.find((c) => c.id === currentCardId);
				if (selectedCard?.pdfPassword) pwd = selectedCard.pdfPassword;
			}

			try {
				const parsed = await parseStatement(files[i].uri, files[i].name, pwd);

				// New card flow — first successful parse, no card created yet
				if (isNewCardFlow && !currentCardId) {
					// Pause batch: show card confirmation
					const cardInfo: CardInfo | null = parsed.card_info ?? null;
					const bankDetected: string = parsed.bank_detected || 'generic';
					const issuerName = BANK_TO_ISSUER[bankDetected] || 'Other';
					const detectedCurrency = (cardInfo?.currency || parsed.currency_detected || 'INR') as CurrencyCode;
					const network = normalizeNetwork(cardInfo?.card_network ?? null);

					const newCard: CreditCard = {
						id: `auto-${Date.now()}`,
						nickname: cardInfo?.card_last4 ? `${issuerName} \u2022${cardInfo.card_last4}` : `${issuerName} Card`,
						last4: cardInfo?.card_last4 || '',
						issuer: issuerName,
						network,
						creditLimit: cardInfo?.credit_limit ?? 0,
						billingCycle: '1',
						color: pickUnusedColor(cards),
						totalAmountDue: cardInfo?.total_amount_due ?? undefined,
						minimumAmountDue: cardInfo?.minimum_amount_due ?? undefined,
						paymentDueDate: cardInfo?.payment_due_date ?? undefined,
						autoCreated: true,
						currency: detectedCurrency,
					};

					setConfirmNickname(newCard.nickname);
					setConfirmLast4(newCard.last4);
					setConfirmIssuer(newCard.issuer);
					setConfirmNetwork(newCard.network);
					setConfirmCreditLimit(newCard.creditLimit ? String(newCard.creditLimit) : '');
					setConfirmCurrency(detectedCurrency);
					setPendingCardData(newCard);

					// Store parse result for this file
					updateBatchFile(i, { status: 'parsing', fileHash, parseResult: parsed });
					setPendingParseResult({ parsed, fileHash, passwordToSave: currentPassword || undefined });

					setCardConfirmVisible(true);
					return; // Pause — handleCardConfirm will resume
				}

				// Check if this is a re-parse of an existing statement
				const currentFile = batchFilesRef.current[i];
				if (currentFile.existingStatementId && currentFile.existingCardId) {
					// Re-parse flow → navigate to diff screen
					updateBatchFile(i, { status: 'reparse', fileHash, parseResult: parsed });
					// For single file: navigate immediately. For batch: pause and show after batch.
					if (files.length === 1) {
						setState('idle');
						navigation.navigate('StatementDiff', {
							statementId: currentFile.existingStatementId,
							cardId: currentFile.existingCardId,
							newParsed: parsed,
						});
						return;
					}
					// In batch mode, store the info and continue — will show after batch completes
					continue;
				}

				// Normal flow — save
				const stmtId = finalizeSaveForBatch(currentCardId!, parsed, fileHash);
				updateBatchFile(i, { status: 'success', fileHash, parseResult: parsed, statementId: stmtId });
			} catch (err: any) {
				const respData = err?.response?.data;
				const errorCode = respData?.error_code || respData?.detail?.error_code;

				if (errorCode === 'password_required' || errorCode === 'incorrect_password') {
					// First time needing password in batch — no batch password set yet
					if (!currentPassword) {
						capture(AnalyticsEvents.STATEMENT_PASSWORD_REQUIRED);
						batchPasswordIndexRef.current = i;
						setPendingFile({ uri: files[i].uri, name: files[i].name });
						setPasswordError(errorCode === 'incorrect_password' ? 'Incorrect password. Please try again.' : '');
						setPassword('');
						setSavePasswordChecked(false);
						setPasswordModalVisible(true);
						return; // Pause — handlePasswordSubmit will resume
					}
					// Already have a batch password but it failed for this file
					updateBatchFile(i, { status: 'failed', error: 'Wrong password', fileHash });
					continue;
				}

				const msg =
					respData?.message ||
					(typeof respData?.detail === 'string' ? respData.detail : respData?.detail?.message) ||
					err?.message ||
					'Failed to parse statement.';
				capture(AnalyticsEvents.STATEMENT_UPLOAD_FAILED, { error_code: errorCode || 'unknown' });
				updateBatchFile(i, { status: 'failed', error: msg, fileHash });
			}
		}

		// Batch complete
		setBatchComplete(true);

		const successCount = batchFilesRef.current.filter((f) => f.status === 'success').length;
		const reparseCount = batchFilesRef.current.filter((f) => f.status === 'reparse').length;
		const totalCount = batchFilesRef.current.length;
		capture(AnalyticsEvents.BATCH_UPLOAD_COMPLETE, {
			total: totalCount,
			success: successCount,
			failed: batchFilesRef.current.filter((f) => f.status === 'failed').length,
			duplicate: batchFilesRef.current.filter((f) => f.status === 'duplicate').length,
			skipped: batchFilesRef.current.filter((f) => f.status === 'skipped').length,
			reparse: reparseCount,
		});

		// Single file success → auto-navigate
		if (totalCount === 1 && successCount === 1) {
			const file = batchFilesRef.current[0];
			setState('idle');
			navigation.navigate('Analysis', { statementId: file.statementId!, cardId: currentCardId ?? batchCardId! });
		}
	};

	// -----------------------------------------------------------------------
	// handlePick — file picker (batch-aware)
	// -----------------------------------------------------------------------

	const handlePick = async () => {
		try {
			const allowed = await checkUploadAllowed();
			if (!allowed) return;

			const result = await DocumentPicker.getDocumentAsync({
				type: 'application/pdf',
				copyToCacheDirectory: true,
				multiple: true,
			});

			if (result.canceled || !result.assets?.length) return;

				// Build batch items
			const items: BatchFileItem[] = result.assets.map((a) => ({
				uri: a.uri,
				name: a.name || 'statement.pdf',
				status: 'pending' as FileStatus,
			}));

			batchFilesRef.current = items;
			setBatchFiles(items);
			setBatchIndex(0);
			setBatchComplete(false);
			setBatchPassword(null);
			batchCancelledRef.current = false;

			capture(AnalyticsEvents.BATCH_UPLOAD_STARTED, { file_count: items.length });

			if (selectedCardId === NEW_CARD_ID) {
				setIsNewCardFlow(true);
				setBatchCardId(null);
				setState('batch');
				processBatch(0, undefined, null);
			} else {
				setIsNewCardFlow(false);
				setBatchCardId(selectedCardId);
				setState('batch');
				processBatch(0, selectedCardId, null);
			}
		} catch {
			setState('error');
			setError('Could not open file picker.');
		}
	};

	// -----------------------------------------------------------------------
	// handlePasswordSubmit — batch-aware
	// -----------------------------------------------------------------------

	const handlePasswordSubmit = async () => {
		if (!password.trim()) return;
		const usedPwd = password;
		const shouldSave = savePasswordChecked;
		setPasswordModalVisible(false);
		setPassword('');
		setPasswordError('');
		setSavePasswordChecked(false);

		if (state === 'batch') {
			// Batch mode — retry current file with password, then continue
			const idx = batchPasswordIndexRef.current;
			const file = batchFilesRef.current[idx];

			updateBatchFile(idx, { status: 'parsing' });

			try {
				const parsed = await parseStatement(file.uri, file.name, usedPwd);

				// Set batch password for remaining files
				setBatchPassword(usedPwd);

				// If new card flow and no card yet
				const currentCardId = batchCardId;
				if (isNewCardFlow && !currentCardId) {
					const cardInfo: CardInfo | null = parsed.card_info ?? null;
					const bankDetected: string = parsed.bank_detected || 'generic';
					const issuerName = BANK_TO_ISSUER[bankDetected] || 'Other';
					const detectedCurrency = (cardInfo?.currency || parsed.currency_detected || 'INR') as CurrencyCode;
					const network = normalizeNetwork(cardInfo?.card_network ?? null);

					const newCard: CreditCard = {
						id: `auto-${Date.now()}`,
						nickname: cardInfo?.card_last4 ? `${issuerName} \u2022${cardInfo.card_last4}` : `${issuerName} Card`,
						last4: cardInfo?.card_last4 || '',
						issuer: issuerName,
						network,
						creditLimit: cardInfo?.credit_limit ?? 0,
						billingCycle: '1',
						color: pickUnusedColor(cards),
						totalAmountDue: cardInfo?.total_amount_due ?? undefined,
						minimumAmountDue: cardInfo?.minimum_amount_due ?? undefined,
						paymentDueDate: cardInfo?.payment_due_date ?? undefined,
						autoCreated: true,
						currency: detectedCurrency,
					};

					setConfirmNickname(newCard.nickname);
					setConfirmLast4(newCard.last4);
					setConfirmIssuer(newCard.issuer);
					setConfirmNetwork(newCard.network);
					setConfirmCreditLimit(newCard.creditLimit ? String(newCard.creditLimit) : '');
					setConfirmCurrency(detectedCurrency);
					setPendingCardData(newCard);
					updateBatchFile(idx, { status: 'parsing', parseResult: parsed });
					setPendingParseResult({ parsed, fileHash: file.fileHash, passwordToSave: shouldSave ? usedPwd : undefined });
					setCardConfirmVisible(true);
					return;
				}

				// Save this file
				const stmtId = finalizeSaveForBatch(currentCardId!, parsed, file.fileHash);
				updateBatchFile(idx, { status: 'success', parseResult: parsed, statementId: stmtId });

				// Save password to card if requested
				if (shouldSave && currentCardId) {
					updateCard(currentCardId, { pdfPassword: usedPwd });
				}

				// Continue batch from next file
				processBatch(idx + 1, currentCardId ?? undefined, usedPwd);
			} catch (retryErr: any) {
				const retryData = retryErr?.response?.data;
				const retryCode = retryData?.error_code || retryData?.detail?.error_code;
				if (retryCode === 'incorrect_password') {
					setPasswordError('Incorrect password. Please try again.');
					setPassword('');
					setPasswordModalVisible(true);
				} else {
					const msg =
						retryData?.message ||
						(typeof retryData?.detail === 'string' ? retryData.detail : retryData?.detail?.message) ||
						retryErr?.message ||
						'Failed to parse statement.';
					updateBatchFile(idx, { status: 'failed', error: msg });
					// Continue batch from next file
					processBatch(idx + 1, batchCardId ?? undefined, usedPwd);
				}
			}
			return;
		}

		// Non-batch (legacy single-file) path
		if (!pendingFile) return;
		setState('parsing');
		setError('');
		try {
			const fileHash = await computeFileHash(pendingFile.uri);
			const dupResult = checkDuplicateSilent(fileHash);
			if (dupResult.isDuplicate && dupResult.existingStatementId && dupResult.existingCardId) {
				// Offer re-parse
				const userChoice = await new Promise<'skip' | 'reparse'>((resolve) => {
					Alert.alert(
						'Statement Already Uploaded',
						`This statement was already uploaded for ${dupResult.cardName}. Re-parse to check for changes?`,
						[
							{ text: 'Cancel', style: 'cancel', onPress: () => resolve('skip') },
							{ text: 'Re-parse & Update', onPress: () => resolve('reparse') },
						],
						{ cancelable: false },
					);
				});
				if (userChoice === 'skip') {
					setPendingFile(null);
					setState('idle');
					return;
				}
				// Re-parse: parse the file, then navigate to diff screen
				const parsed = await parseStatement(pendingFile.uri, pendingFile.name, usedPwd);
				setPendingFile(null);
				setState('idle');
				navigation.navigate('StatementDiff', {
					statementId: dupResult.existingStatementId,
					cardId: dupResult.existingCardId,
					newParsed: parsed,
				});
				return;
			}

			const parsed = await parseStatement(pendingFile.uri, pendingFile.name, usedPwd);
			setPendingFile(null);

			// For single-file non-batch, go through the card selection flow
			const cardId = selectedCardId || 'demo';
			const matched = cards.find((c) => c.id === cardId);
			if (shouldSave && matched) {
				updateCard(matched.id, { pdfPassword: usedPwd });
			}
			finalizeSave(cardId, matched, false, parsed, fileHash);
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

		if (state === 'batch') {
			// Mark current file as failed, continue batch
			const idx = batchPasswordIndexRef.current;
			updateBatchFile(idx, { status: 'failed', error: 'Password required' });
			// Mark remaining as skipped (user chose to cancel)
			for (let j = idx + 1; j < batchFilesRef.current.length; j++) {
				updateBatchFile(j, { status: 'skipped' });
			}
			setBatchComplete(true);
		}
	};

	// -----------------------------------------------------------------------
	// handleDemo — unchanged single-file flow
	// -----------------------------------------------------------------------

	const handleDemo = async () => {
		capture(AnalyticsEvents.DEMO_STATEMENT_LOADED);
		setState('parsing');
		setError('');

		const demoHash = await Crypto.digestStringAsync(
			Crypto.CryptoDigestAlgorithm.SHA256,
			'vector-demo-statement-v1',
		);
		const demoDup = checkDuplicateSilent(demoHash);
		if (demoDup.isDuplicate) {
			Alert.alert('Demo Already Loaded', 'The demo statement has already been uploaded.', [{ text: 'OK' }]);
			setState('idle');
			return;
		}

		setTimeout(() => {
			try {
				const parsed = parseDemoStatement();
				const statementId = finalizeSaveForBatch('demo', parsed, demoHash);
				setState('idle');
				navigation.navigate('Analysis', { statementId, cardId: 'demo' });
			} catch {
				setState('error');
				setError('Demo failed unexpectedly.');
			}
		}, 800);
	};

	// -----------------------------------------------------------------------
	// handleCardConfirm — batch-aware
	// -----------------------------------------------------------------------

	const handleCardConfirm = () => {
		if (!pendingCardData) return;
		const confirmedCard: CreditCard = {
			...pendingCardData,
			nickname: confirmNickname.trim() || pendingCardData.nickname,
			last4: confirmLast4.trim() || pendingCardData.last4,
			issuer: confirmIssuer,
			network: confirmNetwork,
			creditLimit: parseFloat(confirmCreditLimit) || 0,
			currency: confirmCurrency,
			pdfPassword: batchPassword || pendingParseResult?.passwordToSave || undefined,
		};
		addCard(confirmedCard);
		setCardConfirmVisible(false);

		if (state === 'batch') {
			// Batch mode — save the first file, then resume
			const idx = batchFilesRef.current.findIndex((f) => f.status === 'parsing' && f.parseResult);
			if (idx !== -1 && pendingParseResult) {
				const stmtId = finalizeSaveForBatch(confirmedCard.id, pendingParseResult.parsed, pendingParseResult.fileHash);
				updateBatchFile(idx, { status: 'success', statementId: stmtId });
			}
			setBatchCardId(confirmedCard.id);
			setPendingCardData(null);
			setPendingParseResult(null);

			// Resume from next file
			const nextIdx = (idx !== -1 ? idx : 0) + 1;
			processBatch(nextIdx, confirmedCard.id, batchPassword);
			return;
		}

		// Non-batch legacy path
		if (pendingParseResult) {
			finalizeSave(confirmedCard.id, confirmedCard, true, pendingParseResult.parsed, pendingParseResult.fileHash);
		}
		setPendingCardData(null);
		setPendingParseResult(null);
	};

	const handleCardConfirmCancel = () => {
		setCardConfirmVisible(false);
		setPendingCardData(null);
		setPendingParseResult(null);

		if (state === 'batch') {
			// Cancel entire batch
			batchCancelledRef.current = true;
			for (let j = 0; j < batchFilesRef.current.length; j++) {
				if (batchFilesRef.current[j].status !== 'success') {
					updateBatchFile(j, { status: 'skipped' });
				}
			}
			setBatchComplete(true);
		} else {
			setState('idle');
		}
	};

	// -----------------------------------------------------------------------
	// Cancel batch
	// -----------------------------------------------------------------------

	const handleCancelBatch = () => {
		batchCancelledRef.current = true;
	};

	// -----------------------------------------------------------------------
	// Batch UI helpers
	// -----------------------------------------------------------------------

	const getStatusIcon = (status: FileStatus): React.ReactNode => {
		switch (status) {
			case 'success':
				return <Feather name="check-circle" size={18} color={colors.accent} />;
			case 'reparse':
				return <Feather name="git-merge" size={18} color={colors.warning} />;
			case 'failed':
				return <Feather name="x-circle" size={18} color={colors.debit} />;
			case 'duplicate':
				return <Feather name="copy" size={18} color={colors.textMuted} />;
			case 'skipped':
				return <Feather name="minus-circle" size={18} color={colors.textMuted} />;
			case 'hashing':
			case 'parsing':
				return <ActivityIndicator size="small" color={colors.accent} />;
			case 'pending':
			default:
				return <Feather name="clock" size={18} color={colors.textMuted} />;
		}
	};

	const getStatusLabel = (file: BatchFileItem): string | undefined => {
		switch (file.status) {
			case 'failed':
				return file.error || 'Failed';
			case 'duplicate':
				return 'Duplicate — Skipped';
			case 'skipped':
				return 'Skipped';
			case 'reparse':
				return 'Re-parsed — Review changes';
			default:
				return undefined;
		}
	};

	const batchProgress = useMemo(() => {
		if (batchFiles.length === 0) return 0;
		const done = batchFiles.filter((f) =>
			['success', 'failed', 'duplicate', 'skipped', 'reparse'].includes(f.status),
		).length;
		return done / batchFiles.length;
	}, [batchFiles]);

	const batchSuccessCount = useMemo(
		() => batchFiles.filter((f) => f.status === 'success').length,
		[batchFiles],
	);

	const isProcessing = state === 'uploading' || state === 'parsing';

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

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

				{/* Card selector — always visible */}
				{state !== 'batch' && (
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
										{card.nickname} {card.last4 ? `(*${card.last4})` : ''}
									</Text>
								</TouchableOpacity>
							))}
							<TouchableOpacity
								style={[styles.cardChip, selectedCardId === NEW_CARD_ID && styles.cardChipActive]}
								onPress={() => setSelectedCardId(NEW_CARD_ID)}
							>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
									<Feather
										name="plus"
										size={14}
										color={selectedCardId === NEW_CARD_ID ? colors.accent : colors.textSecondary}
									/>
									<Text
										style={[
											styles.cardChipText,
											selectedCardId === NEW_CARD_ID && styles.cardChipTextActive,
										]}
									>
										New Card
									</Text>
								</View>
							</TouchableOpacity>
						</ScrollView>
					</View>
				)}

				{/* Upload area */}
				<View style={{ paddingHorizontal: spacing.lg }}>
					{/* Batch progress UI */}
					{state === 'batch' && !batchComplete && (
						<View style={[styles.uploadArea, { borderColor: colors.accent, paddingVertical: spacing.xl }]}>
							<Feather name="upload-cloud" size={40} color={colors.accent} />
							<Text style={[styles.uploadTitle, { color: colors.accent }]}>Processing Statements</Text>
							<Text style={styles.uploadSubtitle}>
								{batchFiles.filter((f) => ['success', 'failed', 'duplicate', 'skipped'].includes(f.status)).length} of {batchFiles.length}
							</Text>

							<View style={{ width: '100%', marginTop: spacing.lg, marginBottom: spacing.md }}>
								<ProgressBar progress={batchProgress} />
							</View>

							{/* File list */}
							{batchFiles.map((file, idx) => (
								<View key={`${file.name}-${idx}`} style={styles.batchFileRow}>
									{getStatusIcon(file.status)}
									<Text
										style={[
											styles.batchFileName,
											file.status === 'success' && { color: colors.accent },
											(file.status === 'failed') && { color: colors.debit },
											(file.status === 'duplicate' || file.status === 'skipped') && { color: colors.textMuted },
										]}
										numberOfLines={1}
									>
										{file.name}
									</Text>
								</View>
							))}

							{/* Cancel button */}
							<TouchableOpacity
								style={[styles.cancelBatchBtn, { marginTop: spacing.lg }]}
								onPress={handleCancelBatch}
								activeOpacity={0.7}
							>
								<Text style={styles.cancelBatchText}>Cancel</Text>
							</TouchableOpacity>
						</View>
					)}

					{/* Batch completion UI */}
					{state === 'batch' && batchComplete && batchFiles.length > 1 && (
						<View style={[styles.uploadArea, { borderColor: colors.accent, paddingVertical: spacing.xl }]}>
							<Feather name="check-circle" size={48} color={colors.accent} />
							<Text style={[styles.uploadTitle, { color: colors.accent }]}>Upload Complete</Text>
							<Text style={styles.uploadSubtitle}>
								{batchSuccessCount} of {batchFiles.length} statements processed
							</Text>

							{/* File results */}
							<View style={{ width: '100%', marginTop: spacing.lg }}>
								{batchFiles.map((file, idx) => {
									const label = getStatusLabel(file);
									const canNavigate = file.status === 'success' && file.statementId;
									const canReview = file.status === 'reparse' && file.existingStatementId && file.existingCardId && file.parseResult;
									const isClickable = canNavigate || canReview;
									return (
										<TouchableOpacity
											key={`${file.name}-${idx}`}
											style={styles.batchFileRow}
											disabled={!isClickable}
											onPress={() => {
												if (canNavigate) {
													resetBatch();
													navigation.navigate('Analysis', {
														statementId: file.statementId!,
														cardId: batchCardId!,
													});
												} else if (canReview) {
													resetBatch();
													navigation.navigate('StatementDiff', {
														statementId: file.existingStatementId!,
														cardId: file.existingCardId!,
														newParsed: file.parseResult,
													});
												}
											}}
											activeOpacity={isClickable ? 0.7 : 1}
										>
											{getStatusIcon(file.status)}
											<View style={{ flex: 1 }}>
												<Text
													style={[
														styles.batchFileName,
														file.status === 'success' && { color: colors.accent },
														file.status === 'reparse' && { color: colors.warning },
														file.status === 'failed' && { color: colors.debit },
														(file.status === 'duplicate' || file.status === 'skipped') && { color: colors.textMuted },
													]}
													numberOfLines={1}
												>
													{file.name}
												</Text>
												{label && (
													<Text style={styles.batchFileError} numberOfLines={1}>
														{label}
													</Text>
												)}
											</View>
											{isClickable && (
												<Feather name="chevron-right" size={16} color={colors.textMuted} />
											)}
										</TouchableOpacity>
									);
								})}
							</View>

							{/* Done button */}
							<View style={{ width: '100%', marginTop: spacing.xl }}>
								<PrimaryButton title="Done" icon="check" onPress={resetBatch} />
							</View>
						</View>
					)}

					{/* Normal upload area (idle / single uploading / parsing / error) */}
					{state !== 'batch' && (
						<TouchableOpacity
							style={[
								styles.uploadArea,
								state === 'error' && { borderColor: colors.debit },
								isProcessing && { borderColor: colors.accent },
							]}
							onPress={state === 'idle' || state === 'error' ? handlePick : undefined}
							activeOpacity={0.8}
							disabled={isProcessing}
						>
							{state === 'idle' && (
								<>
									<Feather name="upload-cloud" size={48} color={colors.textMuted} />
									<Text style={styles.uploadTitle}>Tap to Upload PDF</Text>
									<Text style={styles.uploadSubtitle}>Select one or more credit card statements (max 10 MB each)</Text>

								</>
							)}
							{isProcessing && (
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
					)}
				</View>

				{/* Demo button */}
				{state !== 'batch' && (
					<View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
						<PrimaryButton
							title="Try Demo"
							icon="play"
							variant="outline"
							onPress={handleDemo}
							disabled={isProcessing}
						/>
					</View>
				)}

				{/* Privacy info */}
				{state !== 'batch' && (
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
				)}

				<View style={{ height: 40 }} />
			</ScrollView>

			{/* Password Modal */}
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
										last4: confirmLast4 || '\u2022\u2022\u2022\u2022',
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
								placeholder="e.g. HDFC \u20221234"
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
	// Batch file row
	batchFileRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.sm,
		width: '100%',
	},
	batchFileName: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		fontWeight: '500',
		lineHeight: 18,
	},
	batchFileError: {
		color: colors.textMuted,
		fontSize: fontSize.xs,
		lineHeight: 16,
		marginTop: 2,
	},
	cancelBatchBtn: {
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.xl,
		borderRadius: borderRadius.lg,
		backgroundColor: colors.surfaceElevated,
	},
	cancelBatchText: {
		color: colors.textSecondary,
		fontSize: fontSize.md,
		fontWeight: '600',
		lineHeight: 20,
	},
	// Modals
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
