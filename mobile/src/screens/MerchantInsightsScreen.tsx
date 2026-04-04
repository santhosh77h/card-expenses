import React, { useMemo, useState, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  LayoutAnimation,
  Keyboard,
  Platform,
  Share,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore, Transaction } from '../store';
import { EmptyState } from '../components/ui';
import TransactionDetailModal from '../components/TransactionDetailModal';
import {
  getAllMerchants,
  computeMerchantStats,
  buildDaySections,
  type MerchantData,
} from '../utils/merchantAnalytics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MerchantInsightsScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    manualTransactions,
    statements,
    cards,
    defaultCurrency,
    enrichments,
    updateManualTransaction,
  } = useStore();

  // --- State ---
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'amount' | 'frequency'>('amount');
  const [detailTxn, setDetailTxn] = useState<Transaction | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // --- Derived data ---
  const allMerchants = useMemo(
    () => getAllMerchants(manualTransactions, statements, defaultCurrency as CurrencyCode),
    [manualTransactions, statements, defaultCurrency],
  );

  const filteredMerchants = useMemo(() => {
    let list = allMerchants;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (sortBy === 'frequency') {
      list = [...list].sort((a, b) => b.txnCount - a.txnCount);
    }
    return list;
  }, [allMerchants, searchQuery, sortBy]);

  const selectedMerchantData = useMemo(
    () => allMerchants.filter((m) => selectedMerchants.includes(m.name)),
    [allMerchants, selectedMerchants],
  );

  const stats = useMemo(
    () => computeMerchantStats(selectedMerchantData, defaultCurrency as CurrencyCode),
    [selectedMerchantData, defaultCurrency],
  );

  const daySections = useMemo(
    () => buildDaySections(selectedMerchantData, defaultCurrency as CurrencyCode),
    [selectedMerchantData, defaultCurrency],
  );

  const globalStats = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of allMerchants) {
      for (const txn of m.transactions) {
        const cur = txn.currency ?? defaultCurrency;
        if (!totals[cur]) totals[cur] = 0;
        totals[cur] += txn.amount;
      }
    }
    return { merchantCount: allMerchants.length, totals };
  }, [allMerchants, defaultCurrency]);

  const isDetailView = selectedMerchants.length > 0;

  // --- Search toggle ---
  const toggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowSearch((prev) => {
      if (prev) {
        setSearchQuery('');
        Keyboard.dismiss();
      }
      return !prev;
    });
    if (!showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  // --- Merchant selection ---
  const selectMerchant = useCallback((name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setShowSearch(false);
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const removeMerchant = useCallback((name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants((prev) => {
      const next = prev.filter((n) => n !== name);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants([]);
  }, []);

  // --- Dynamic header ---
  useLayoutEffect(() => {
    if (isDetailView) {
      const title =
        selectedMerchants.length === 1
          ? selectedMerchants[0]
          : `${selectedMerchants.length} merchants`;
      navigation.setOptions({
        headerTitle: title,
        headerLeft: () => (
          <TouchableOpacity
            onPress={clearSelection}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginLeft: Platform.OS === 'ios' ? 0 : spacing.sm }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Feather name="chevron-left" size={24} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: fontSize.lg, fontWeight: '500' }}>
                Merchants
              </Text>
            </View>
          </TouchableOpacity>
        ),
        headerRight: undefined,
      });
    } else {
      navigation.setOptions({
        headerTitle: 'Merchants',
        headerLeft: undefined,
        headerRight: () => (
          <TouchableOpacity
            onPress={toggleSearch}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: spacing.lg }}
          >
            <Feather
              name={showSearch ? 'x' : 'search'}
              size={20}
              color={showSearch ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, isDetailView, selectedMerchants, colors, showSearch, toggleSearch, clearSelection]);

  // --- Export ---
  const handleExport = useCallback(async () => {
    if (!selectedMerchantData.length) return;
    try {
      const header = 'Date,Description,Category,Amount,Type,Currency\n';
      const allTxns = selectedMerchantData.flatMap((m) => m.transactions);
      const rows = allTxns
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          (t) =>
            `${t.date},"${t.description.replace(/"/g, '""')}",${t.category},${t.amount},${t.type},${t.currency ?? defaultCurrency}`,
        )
        .join('\n');
      const names = selectedMerchants.join('-').replace(/\s+/g, '_').slice(0, 40);
      const path = `${FileSystem.cacheDirectory}vector-merchants-${names}.csv`;
      await FileSystem.writeAsStringAsync(path, header + rows);
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Merchant Transactions',
      });
    } catch {
      // Sharing cancelled
    }
  }, [selectedMerchantData, selectedMerchants, defaultCurrency]);

  // --- Copy ---
  const handleCopy = useCallback(() => {
    if (!stats.txnCount) return;
    const lines: string[] = [];
    if (selectedMerchants.length === 1) {
      lines.push(selectedMerchants[0]);
    } else {
      lines.push(`${selectedMerchants.length} merchants`);
    }
    for (const [cur, total] of Object.entries(stats.totalSpend)) {
      lines.push(`Total: ${formatCurrency(total, cur as CurrencyCode)}`);
    }
    lines.push(`Transactions: ${stats.txnCount}`);
    if (stats.max) lines.push(`Highest: ${formatCurrency(stats.max.amount, defaultCurrency as CurrencyCode)}`);
    if (stats.min) lines.push(`Lowest: ${formatCurrency(stats.min.amount, defaultCurrency as CurrencyCode)}`);
    Share.share({ message: lines.join('\n') });
  }, [stats, selectedMerchants, defaultCurrency]);

  const detailCard = detailTxn?.cardId ? cards.find((c) => c.id === detailTxn.cardId) : undefined;

  // --- Add merchant modal filtered list ---
  const addFilteredMerchants = useMemo(() => {
    const already = new Set(selectedMerchants);
    let list = allMerchants.filter((m) => !already.has(m.name));
    if (addSearchQuery) {
      const q = addSearchQuery.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [allMerchants, selectedMerchants, addSearchQuery]);

  // =========================================================================
  // LIST VIEW — all merchants
  // =========================================================================
  if (!isDetailView) {
    const globalTotalEntries = Object.entries(globalStats.totals) as [CurrencyCode, number][];
    const subtitleParts = [
      `${globalStats.merchantCount} merchant${globalStats.merchantCount !== 1 ? 's' : ''}`,
      ...globalTotalEntries.map(([cur, amt]) => formatCurrency(amt, cur)),
    ];

    const listHeader = allMerchants.length > 0 ? (
      <>
        {/* Search bar */}
        {showSearch && (
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search merchants..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Subtitle */}
        <Text style={styles.subtitle}>{subtitleParts.join(' · ')} total</Text>

        {/* Sort chips */}
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'amount' && styles.sortChipActive]}
            onPress={() => setSortBy('amount')}
          >
            <Feather name="trending-down" size={13} color={sortBy === 'amount' ? colors.accent : colors.textSecondary} />
            <Text style={[styles.sortChipText, sortBy === 'amount' && styles.sortChipTextActive]}>
              By spend
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'frequency' && styles.sortChipActive]}
            onPress={() => setSortBy('frequency')}
          >
            <Feather name="repeat" size={13} color={sortBy === 'frequency' ? colors.accent : colors.textSecondary} />
            <Text style={[styles.sortChipText, sortBy === 'frequency' && styles.sortChipTextActive]}>
              By frequency
            </Text>
          </TouchableOpacity>
        </View>
      </>
    ) : null;

    return (
      <View style={styles.container}>
        {allMerchants.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="shopping-bag"
              title="No merchants yet"
              subtitle="Upload a statement to see your merchants here"
            />
          </View>
        ) : (
          <FlatList
            data={filteredMerchants}
            keyExtractor={(m) => m.name}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <EmptyState
                icon="search"
                title="No matches"
                subtitle="Try a different search term"
              />
            }
            renderItem={({ item: merchant }) => (
              <TouchableOpacity
                style={styles.merchantRow}
                activeOpacity={0.7}
                onPress={() => selectMerchant(merchant.name)}
              >
                <View style={[styles.merchantAvatar, { borderColor: merchant.color + '50' }]}>
                  <Text style={[styles.merchantInitials, { color: merchant.color }]}>
                    {merchant.initials}
                  </Text>
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName} numberOfLines={1}>
                    {merchant.name}
                  </Text>
                  <Text style={styles.merchantSub}>
                    {merchant.txnCount} transaction{merchant.txnCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.merchantRight}>
                  <Text style={styles.merchantAmount}>
                    {formatCurrency(merchant.totalAmount, defaultCurrency as CurrencyCode)}
                  </Text>
                  <Feather name="chevron-right" size={16} color={colors.textMuted + '40'} />
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // =========================================================================
  // DETAIL VIEW — selected merchant(s)
  // =========================================================================
  const totalEntries = Object.entries(stats.totalSpend) as [CurrencyCode, number][];

  const detailHeader = (
    <>
      {/* Selected merchant chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {selectedMerchants.map((name) => {
          const m = allMerchants.find((x) => x.name === name);
          return (
            <View key={name} style={[styles.chip, { backgroundColor: (m?.color ?? colors.accent) + '15', borderColor: (m?.color ?? colors.accent) + '40' }]}>
              <Text style={[styles.chipText, { color: m?.color ?? colors.accent }]} numberOfLines={1}>
                {name}
              </Text>
              <TouchableOpacity
                onPress={() => removeMerchant(name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={14} color={m?.color ?? colors.accent} />
              </TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, styles.addChip]}
          onPress={() => { setAddSearchQuery(''); setShowAddModal(true); }}
        >
          <Feather name="plus" size={14} color={colors.accent} />
          <Text style={[styles.chipText, { color: colors.accent }]}>Add</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Stats grid — 2×2 */}
      <View style={styles.statsCard}>
        {totalEntries.map(([cur, total], i) => (
          <React.Fragment key={cur}>
            {i > 0 && <View style={[styles.statsCurrencyDivider, { backgroundColor: colors.border }]} />}
            <View style={styles.statsGrid}>
              <View style={[styles.statsCell, styles.statsCellLeft]}>
                <Text style={styles.statsCellLabel}>TOTAL SPEND</Text>
                <Text style={[styles.statsCellValue, { color: colors.debit }]} numberOfLines={1}>
                  {formatCurrency(total, cur)}
                </Text>
              </View>
              <View style={[styles.statsVDivider, { backgroundColor: colors.border }]} />
              <View style={[styles.statsCell, styles.statsCellRight]}>
                <Text style={styles.statsCellLabel}>TRANSACTIONS</Text>
                <Text style={styles.statsCellValue}>{stats.txnCount}</Text>
              </View>
            </View>
            <View style={[styles.statsHDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statsGrid}>
              <View style={[styles.statsCell, styles.statsCellLeft]}>
                <Text style={styles.statsCellLabel}>HIGHEST</Text>
                <Text style={[styles.statsCellValue, { color: colors.debit }]} numberOfLines={1}>
                  {stats.max ? formatCurrency(stats.max.amount, cur) : '—'}
                </Text>
              </View>
              <View style={[styles.statsVDivider, { backgroundColor: colors.border }]} />
              <View style={[styles.statsCell, styles.statsCellRight]}>
                <Text style={styles.statsCellLabel}>LOWEST</Text>
                <Text style={[styles.statsCellValue, { color: colors.credit }]} numberOfLines={1}>
                  {stats.min ? formatCurrency(stats.min.amount, cur) : '—'}
                </Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionTile} onPress={handleExport}>
          <Feather name="upload" size={18} color={colors.accent} />
          <Text style={styles.actionTileLabel}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionTile} onPress={handleCopy}>
          <Feather name="copy" size={18} color={colors.accent} />
          <Text style={styles.actionTileLabel}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* Transaction count header */}
      <Text style={styles.txnCountHeader}>
        {stats.txnCount} transaction{stats.txnCount !== 1 ? 's' : ''}
      </Text>
    </>
  );

  return (
    <View style={styles.container}>
      {daySections.length === 0 ? (
        <ScrollView>
          {detailHeader}
          <View style={styles.list}>
            <EmptyState
              icon="inbox"
              title="No transactions"
              subtitle="This merchant has no debit transactions"
            />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={daySections}
          keyExtractor={(s) => s.date}
          contentContainerStyle={styles.list}
          ListHeaderComponent={detailHeader}
          renderItem={({ item: section }) => {
            const d = new Date(section.date + 'T00:00:00');
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const fullDate = d.toLocaleDateString('en-US', {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            return (
              <View style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayHeaderDate}>{fullDate}</Text>
                    <Text style={styles.dayHeaderDay}>{dayName}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {Object.entries(section.totals).map(([cur, total]) => (
                      <Text key={cur} style={[styles.dayHeaderTotal, { color: colors.debit }]}>
                        {formatCurrency(total as number, cur as CurrencyCode)}
                      </Text>
                    ))}
                    <Text style={styles.dayHeaderSub}>
                      {section.data.length} transaction{section.data.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {section.data.map((txn, idx) => {
                  const enrichment = enrichments[txn.id];
                  return (
                    <TouchableOpacity
                      key={txn.id}
                      style={[
                        styles.txnRow,
                        idx === section.data.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setDetailTxn(txn)}
                    >
                      <View style={[styles.txnIcon, { backgroundColor: txn.category_color + '20' }]}>
                        <Feather
                          name={(txn.category_icon || 'help-circle') as keyof typeof Feather.glyphMap}
                          size={16}
                          color={txn.category_color}
                        />
                      </View>
                      <View style={styles.txnInfo}>
                        <Text style={styles.txnDesc} numberOfLines={1}>
                          {txn.description}
                        </Text>
                        <View style={styles.txnSubRow}>
                          <Text style={styles.txnSub}>{txn.category}</Text>
                          {enrichment?.flagged && (
                            <Feather name="star" size={10} color="#FBBF24" />
                          )}
                          {!!enrichment?.notes && (
                            <Feather name="message-square" size={10} color={colors.textMuted} />
                          )}
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.txnAmount,
                          { color: txn.type === 'debit' ? colors.debit : colors.credit },
                        ]}
                      >
                        {txn.type === 'debit' ? '\u2013' : '+'}
                        {formatCurrency(txn.amount, (txn.currency ?? defaultCurrency) as CurrencyCode)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          }}
        />
      )}

      {/* Transaction detail modal */}
      <TransactionDetailModal
        visible={!!detailTxn}
        transaction={detailTxn}
        onClose={() => setDetailTxn(null)}
        card={detailCard}
        isManual={detailTxn?.cardId === undefined}
        onUpdateTransaction={(txnId, updates) => updateManualTransaction(txnId, updates)}
      />

      {/* Add merchant modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandleBar} />
            <View style={styles.modalNav}>
              <Text style={styles.modalTitle}>Add Merchant</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.modalSearchRow}>
              <Feather name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search merchants..."
                placeholderTextColor={colors.textMuted}
                value={addSearchQuery}
                onChangeText={setAddSearchQuery}
                autoFocus
                returnKeyType="search"
                autoCorrect={false}
              />
              {addSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAddSearchQuery('')}>
                  <Feather name="x-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={addFilteredMerchants}
              keyExtractor={(m) => m.name}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <EmptyState icon="search" title="No matches" subtitle="Try a different search" />
              }
              renderItem={({ item: merchant }) => (
                <TouchableOpacity
                  style={styles.modalMerchantRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    selectMerchant(merchant.name);
                    setShowAddModal(false);
                  }}
                >
                  <View style={[styles.merchantAvatar, { borderColor: merchant.color + '50', width: 36, height: 36 }]}>
                    <Text style={[styles.merchantInitials, { color: merchant.color, fontSize: fontSize.xs }]}>
                      {merchant.initials}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.merchantName} numberOfLines={1}>
                      {merchant.name}
                    </Text>
                    <Text style={styles.merchantSub}>
                      {merchant.txnCount} transaction{merchant.txnCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.merchantAmount, { fontSize: fontSize.sm }]}>
                    {formatCurrency(merchant.totalAmount, defaultCurrency as CurrencyCode)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
    },

    // ── Search ──
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.xs,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      padding: 0,
    },

    // ── Subtitle ──
    subtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      paddingBottom: spacing.md,
    },

    // ── Sort chips ──
    sortRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    sortChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
    },
    sortChipActive: {
      backgroundColor: colors.accent + '20',
      borderWidth: 1,
      borderColor: colors.accent,
    },
    sortChipText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
    sortChipTextActive: {
      color: colors.accent,
    },

    // ── Merchant rows (list view) ──
    merchantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    merchantAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.background,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    merchantInitials: {
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    merchantInfo: {
      flex: 1,
    },
    merchantName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    merchantSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    merchantRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    merchantAmount: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },

    // ── Detail: merchant chips ──
    chipScroll: {
      marginBottom: spacing.lg,
    },
    chipRow: {
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    addChip: {
      backgroundColor: colors.accent + '10',
      borderColor: colors.accent + '30',
    },
    chipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      maxWidth: 140,
    },

    // ── Detail: stats grid ──
    statsCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
    },
    statsCell: {
      flex: 1,
      padding: spacing.lg,
    },
    statsCellLeft: {
      alignItems: 'flex-start',
    },
    statsCellRight: {
      alignItems: 'flex-start',
    },
    statsCellLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    statsCellValue: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      lineHeight: 24,
    },
    statsVDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
    },
    statsHDivider: {
      height: StyleSheet.hairlineWidth,
    },
    statsCurrencyDivider: {
      height: spacing.xs,
    },

    // ── Detail: actions ──
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    actionTile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionTileLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '500',
    },

    // ── Detail: txn count header ──
    txnCountHeader: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.md,
    },

    // ── Day cards ──
    dayCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dayHeaderDate: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    dayHeaderDay: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      lineHeight: 28,
    },
    dayHeaderTotal: {
      fontSize: fontSize.md,
      fontWeight: '700',
      lineHeight: 20,
    },
    dayHeaderSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },

    // ── Transaction rows ──
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    txnIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    txnInfo: {
      flex: 1,
    },
    txnDesc: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      lineHeight: 20,
    },
    txnSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    txnSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    txnAmount: {
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },

    // ── Add merchant modal ──
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingBottom: 40,
      maxHeight: '70%',
    },
    modalHandleBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted + '60',
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    modalNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    modalSearchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.xs,
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    modalMerchantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
