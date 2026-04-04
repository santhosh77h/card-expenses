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
  Alert,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { spacing, borderRadius, fontSize, formatCurrency } from '../theme';
import type { ThemeColors, CurrencyCode } from '../theme';
import { useColors } from '../hooks/useColors';
import { useStore } from '../store';
import { EmptyState } from '../components/ui';
// Uses navigation-based TransactionDetail (formSheet) instead of modal
import {
  getAllMerchants,
  computeMerchantStats,
  computeCardBreakdown,
  buildDaySections,
  type MerchantData,
} from '../utils/merchantAnalytics';
import { matchRule } from '../utils/smartMerchantEngine';
import type { SmartMerchantRule } from '../db/smartMerchantRules';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MerchantInsightsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    manualTransactions,
    statements,
    cards,
    defaultCurrency,
    enrichments,
    savedMerchantFilters,
    addSavedMerchantFilter,
    updateSavedMerchantFilter,
    deleteSavedMerchantFilter,
    smartMerchantRules,
    updateSmartMerchantRule,
    deleteSmartMerchantRule,
  } = useStore();

  // --- State ---
  const preselect = route.params?.preselect as string[] | undefined;
  const [viewMode, setViewMode] = useState<'filters' | 'list' | 'detail'>(
    preselect?.length ? 'detail' : 'filters',
  );
  const [selectedMerchants, setSelectedMerchants] = useState<string[]>(
    () => preselect ?? [],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'amount' | 'frequency'>('amount');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [pendingAddMerchants, setPendingAddMerchants] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [editingFilter, setEditingFilter] = useState<{ id: string; name: string } | null>(null);
  const [editFilterName, setEditFilterName] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // --- Derived data ---
  const allMerchants = useMemo(
    () => getAllMerchants(manualTransactions, statements, defaultCurrency as CurrencyCode, smartMerchantRules),
    [manualTransactions, statements, defaultCurrency, smartMerchantRules],
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

  const cardBreakdown = useMemo(
    () => computeCardBreakdown(selectedMerchantData),
    [selectedMerchantData],
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

  const isDetailView = viewMode === 'detail';

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
    setViewMode('detail');
    setShowSearch(false);
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const removeMerchant = useCallback((name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants((prev) => {
      const next = prev.filter((n) => n !== name);
      if (next.length === 0) setViewMode('filters');
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants([]);
    setViewMode('filters');
  }, []);

  // --- Dynamic header ---
  useLayoutEffect(() => {
    if (viewMode === 'detail') {
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
    } else if (viewMode === 'list') {
      navigation.setOptions({
        headerTitle: 'All Merchants',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setViewMode('filters'); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginLeft: Platform.OS === 'ios' ? 0 : spacing.sm }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Feather name="chevron-left" size={24} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: fontSize.lg, fontWeight: '500' }}>
                Back
              </Text>
            </View>
          </TouchableOpacity>
        ),
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
    } else {
      navigation.setOptions({
        headerTitle: 'Merchants',
        headerLeft: undefined,
        headerRight: undefined,
      });
    }
  }, [navigation, viewMode, selectedMerchants, colors, showSearch, toggleSearch, clearSelection]);

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


  // --- Save filter ---
  const handleSaveFilter = useCallback(() => {
    setSaveFilterName(
      selectedMerchants.length === 1
        ? selectedMerchants[0]
        : `${selectedMerchants.length} merchants`,
    );
    setShowSaveModal(true);
  }, [selectedMerchants]);

  const confirmSaveFilter = useCallback(() => {
    const name = saveFilterName.trim();
    if (!name) return;
    addSavedMerchantFilter({
      id: Date.now().toString(),
      name,
      merchants: selectedMerchants,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowSaveModal(false);
    setSaveFilterName('');
  }, [saveFilterName, selectedMerchants, addSavedMerchantFilter]);

  const handleLoadFilter = useCallback((merchants: string[]) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants(merchants);
    setViewMode('detail');
  }, []);

  const handleLoadRule = useCallback((rule: SmartMerchantRule) => {
    // Find all merchant names that match this rule
    const matchingNames = new Set<string>();
    for (const m of allMerchants) {
      for (const txn of m.transactions) {
        if (matchRule(txn.description, rule)) {
          matchingNames.add(m.name);
          break;
        }
      }
    }
    if (matchingNames.size === 0) {
      Alert.alert('No Matches', 'No transactions currently match this rule.');
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMerchants(Array.from(matchingNames));
    setViewMode('detail');
  }, [allMerchants]);

  const handleEditFilter = useCallback((filter: { id: string; name: string }) => {
    setEditingFilter(filter);
    setEditFilterName(filter.name);
  }, []);

  const confirmEditFilter = useCallback(() => {
    if (!editingFilter || !editFilterName.trim()) return;
    updateSavedMerchantFilter(editingFilter.id, { name: editFilterName.trim() });
    setEditingFilter(null);
    setEditFilterName('');
  }, [editingFilter, editFilterName, updateSavedMerchantFilter]);

  const handleDeleteFilter = useCallback((id: string, name: string) => {
    Alert.alert('Delete Filter', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSavedMerchantFilter(id) },
    ]);
  }, [deleteSavedMerchantFilter]);

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
  // FILTERS LANDING VIEW — saved merchant filters
  // =========================================================================
  if (viewMode === 'filters') {
    const goToList = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode('list');
    };

    return (
      <View style={styles.container}>
        {savedMerchantFilters.length > 0 ? (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <Text style={styles.filtersSubtitle}>
              {savedMerchantFilters.length} saved filter{savedMerchantFilters.length !== 1 ? 's' : ''}
            </Text>

            {savedMerchantFilters.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.filterRow}
                onPress={() => handleLoadFilter(f.merchants)}
                activeOpacity={0.7}
              >
                <View style={styles.filterIcon}>
                  <Feather name="bookmark" size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.filterSub}>
                    {f.merchants.length} merchant{f.merchants.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => handleEditFilter(f)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="edit-2" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteFilter(f.id, f.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Feather name="trash-2" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={16} color={colors.textMuted + '40'} />
                </View>
              </TouchableOpacity>
            ))}

            {/* Smart Rules section */}
            <SmartRulesSection
              rules={smartMerchantRules}
              colors={colors}
              styles={styles}
              onNewRule={() => (navigation as any).navigate('SmartMerchantRule')}
              onTapRule={(rule: any) => handleLoadRule(rule)}
              onEditRule={(id: string) => (navigation as any).navigate('SmartMerchantRule', { ruleId: id })}
              onToggleRule={(id: string, enabled: boolean) => updateSmartMerchantRule(id, { enabled })}
              onDeleteRule={(id: string, name: string) => {
                Alert.alert('Delete Rule', `Remove "${name}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteSmartMerchantRule(id) },
                ]);
              }}
            />

            <TouchableOpacity style={styles.browseAllBtn} onPress={goToList} activeOpacity={0.8}>
              <Feather name="shopping-bag" size={16} color={colors.accent} />
              <Text style={styles.browseAllText}>Browse All Merchants</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.filtersEmptyContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Visual showcase: example filter chips */}
            <View style={styles.filtersEmptyChipCloud}>
              {[
                { name: 'Grocery Run', count: 4, color: '#4ecb8a' },
                { name: 'Subscriptions', count: 6, color: '#5B8DEF' },
                { name: 'Food Delivery', count: 3, color: '#FF9F43' },
                { name: 'Monthly Bills', count: 5, color: '#a78bfa' },
              ].map((ex, i) => (
                <View
                  key={ex.name}
                  style={[
                    styles.filtersEmptyChip,
                    { backgroundColor: ex.color + '14', borderColor: ex.color + '30' },
                    i === 0 && { transform: [{ rotate: '-2deg' }] },
                    i === 1 && { transform: [{ rotate: '1.5deg' }], marginTop: -6 },
                    i === 2 && { transform: [{ rotate: '-1deg' }] },
                    i === 3 && { transform: [{ rotate: '2deg' }], marginTop: -4 },
                  ]}
                >
                  <Feather name="bookmark" size={14} color={ex.color} />
                  <Text style={[styles.filtersEmptyChipText, { color: ex.color }]}>{ex.name}</Text>
                  <View style={[styles.filtersEmptyChipBadge, { backgroundColor: ex.color + '25' }]}>
                    <Text style={[styles.filtersEmptyChipBadgeText, { color: ex.color }]}>{ex.count}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.filtersEmptyHeadline}>
              Track merchants{'\n'}you care about
            </Text>

            <Text style={styles.filtersEmptyBody}>
              Save merchant groups to quickly recheck spending — perfect for tracking
              groceries, subscriptions, or recurring vendors across all cards.
            </Text>

            <View style={styles.filtersEmptyHints}>
              {[
                { icon: 'repeat' as const, text: 'Quickly recheck recurring merchant spend' },
                { icon: 'bar-chart-2' as const, text: 'See card-wise totals across merchants' },
                { icon: 'zap' as const, text: 'One tap to load — no re-selecting' },
              ].map((hint) => (
                <View key={hint.text} style={styles.filtersEmptyHintRow}>
                  <View style={styles.filtersEmptyHintIcon}>
                    <Feather name={hint.icon} size={15} color={colors.accent} />
                  </View>
                  <Text style={styles.filtersEmptyHintText}>{hint.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.filtersEmptyCta} onPress={goToList} activeOpacity={0.8}>
              <Feather name="shopping-bag" size={18} color="#000" />
              <Text style={styles.filtersEmptyCtaText}>Browse All Merchants</Text>
            </TouchableOpacity>

            {/* Smart Rules section */}
            <View style={{ alignSelf: 'stretch', marginTop: spacing.xxl }}>
              <SmartRulesSection
                rules={smartMerchantRules}
                colors={colors}
                styles={styles}
                onNewRule={() => (navigation as any).navigate('SmartMerchantRule')}
                onTapRule={(rule: any) => handleLoadRule(rule)}
              onEditRule={(id: string) => (navigation as any).navigate('SmartMerchantRule', { ruleId: id })}
                onToggleRule={(id: string, enabled: boolean) => updateSmartMerchantRule(id, { enabled })}
                onDeleteRule={(id: string, name: string) => {
                  Alert.alert('Delete Rule', `Remove "${name}"?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteSmartMerchantRule(id) },
                  ]);
                }}
              />
            </View>
          </ScrollView>
        )}

        {/* Edit filter name modal */}
        <Modal
          visible={!!editingFilter}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingFilter(null)}
        >
          <TouchableOpacity
            style={styles.saveModalOverlay}
            activeOpacity={1}
            onPress={() => setEditingFilter(null)}
          >
            <View style={styles.saveModalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.saveModalTitle}>Rename Filter</Text>
              <TextInput
                style={styles.saveModalInput}
                placeholder="Filter name"
                placeholderTextColor={colors.textMuted}
                value={editFilterName}
                onChangeText={setEditFilterName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmEditFilter}
              />
              <View style={styles.saveModalActions}>
                <TouchableOpacity style={styles.saveModalCancel} onPress={() => setEditingFilter(null)}>
                  <Text style={styles.saveModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveModalConfirm, !editFilterName.trim() && { opacity: 0.35 }]}
                  onPress={confirmEditFilter}
                  disabled={!editFilterName.trim()}
                >
                  <Text style={styles.saveModalConfirmText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // LIST VIEW — all merchants
  // =========================================================================
  if (viewMode === 'list') {
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
          onPress={() => { setAddSearchQuery(''); setPendingAddMerchants(new Set()); setShowAddModal(true); }}
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

      {/* Card breakdown */}
      {cardBreakdown.length > 0 && (
        <View style={styles.cardBreakdownSection}>
          <Text style={styles.cardBreakdownHeader}>CARD BREAKDOWN</Text>
          {cardBreakdown.map((entry, idx) => {
            const card = entry.cardId !== '__none__' ? cards.find((c) => c.id === entry.cardId) : undefined;
            const cardLabel = card ? `${card.nickname || card.issuer} ••${card.last4}` : entry.cardId === '__none__' ? 'No Card' : 'Unknown Card';
            const cardColor = card?.color ?? colors.textMuted;
            return (
              <View
                key={entry.cardId}
                style={[
                  styles.cardBreakdownRow,
                  idx === cardBreakdown.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.cardDot, { backgroundColor: cardColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardBreakdownName} numberOfLines={1}>{cardLabel}</Text>
                  <Text style={styles.cardBreakdownSub}>{entry.txnCount} transaction{entry.txnCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {Object.entries(entry.currencies).map(([cur, amt]) => (
                    <Text key={cur} style={[styles.cardBreakdownAmount, { color: colors.debit }]}>
                      {formatCurrency(amt, cur as CurrencyCode)}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

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
        <TouchableOpacity style={styles.actionTilePrimary} onPress={handleSaveFilter}>
          <Feather name="bookmark" size={18} color="#000" />
          <Text style={styles.actionTilePrimaryLabel}>Save</Text>
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
                  const txnCard = txn.cardId ? cards.find((c) => c.id === txn.cardId) : undefined;
                  return (
                    <TouchableOpacity
                      key={txn.id}
                      style={[
                        styles.txnRow,
                        idx === section.data.length - 1 && { borderBottomWidth: 0 },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => (navigation as any).navigate('TransactionDetail', { transaction: txn, cardId: txn.cardId })}
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
                          {txnCard && (
                            <>
                              <View style={[styles.txnCardDot, { backgroundColor: txnCard.color }]} />
                              <Text style={styles.txnCardName} numberOfLines={1}>{'••' + txnCard.last4}</Text>
                            </>
                          )}
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

      {/* Add merchant modal — multi-select */}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={styles.modalTitle}>Add Merchants</Text>
                {pendingAddMerchants.size > 0 && (
                  <View style={styles.modalCountBadge}>
                    <Text style={styles.modalCountBadgeText}>{pendingAddMerchants.size}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <TouchableOpacity
                  onPress={() => {
                    pendingAddMerchants.forEach((name) => selectMerchant(name));
                    setShowAddModal(false);
                  }}
                  disabled={pendingAddMerchants.size === 0}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.modalDoneText, pendingAddMerchants.size === 0 && { opacity: 0.35 }]}>Done</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
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
              renderItem={({ item: merchant }) => {
                const isChecked = pendingAddMerchants.has(merchant.name);
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalMerchantRow,
                      isChecked && { backgroundColor: colors.accent + '08' },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setPendingAddMerchants((prev) => {
                        const next = new Set(prev);
                        if (next.has(merchant.name)) {
                          next.delete(merchant.name);
                        } else {
                          next.add(merchant.name);
                        }
                        return next;
                      });
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
                    <Feather
                      name={isChecked ? 'check-circle' : 'circle'}
                      size={20}
                      color={isChecked ? colors.accent : colors.textMuted + '60'}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Save filter modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <TouchableOpacity
          style={styles.saveModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSaveModal(false)}
        >
          <View style={styles.saveModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.saveModalTitle}>Save Filter</Text>
            <TextInput
              style={styles.saveModalInput}
              placeholder="Filter name"
              placeholderTextColor={colors.textMuted}
              value={saveFilterName}
              onChangeText={setSaveFilterName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmSaveFilter}
            />
            <View style={styles.saveModalActions}>
              <TouchableOpacity style={styles.saveModalCancel} onPress={() => setShowSaveModal(false)}>
                <Text style={styles.saveModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalConfirm, !saveFilterName.trim() && { opacity: 0.35 }]}
                onPress={confirmSaveFilter}
                disabled={!saveFilterName.trim()}
              >
                <Text style={styles.saveModalConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Smart Rules Section
// ---------------------------------------------------------------------------

function SmartRulesSection({
  rules,
  colors,
  styles: s,
  onNewRule,
  onTapRule,
  onEditRule,
  onToggleRule,
  onDeleteRule,
}: {
  rules: any[];
  colors: any;
  styles: any;
  onNewRule: () => void;
  onTapRule: (rule: any) => void;
  onEditRule: (id: string) => void;
  onToggleRule: (id: string, enabled: boolean) => void;
  onDeleteRule: (id: string, name: string) => void;
}) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={s.smartRulesLabel}>SMART RULES</Text>
        <TouchableOpacity onPress={onNewRule} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '600' }}>+ New Rule</Text>
        </TouchableOpacity>
      </View>

      {rules.length > 0 ? (
        rules.map((rule: any) => (
          <TouchableOpacity
            key={rule.id}
            style={[s.smartRuleRow, !rule.enabled && { opacity: 0.5 }]}
            onPress={() => onTapRule(rule)}
            activeOpacity={0.7}
          >
            <View style={s.smartRuleIcon}>
              <Feather name="git-merge" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.smartRuleName} numberOfLines={1}>{rule.name}</Text>
              <Text style={s.smartRuleSub}>
                {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onEditRule(rule.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="edit-2" size={15} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDeleteRule(rule.id, rule.name)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="trash-2" size={15} color={colors.textMuted} />
            </TouchableOpacity>
            <Switch
              value={rule.enabled}
              onValueChange={(val) => onToggleRule(rule.id, val)}
              trackColor={{ false: colors.border, true: colors.accent + '60' }}
              thumbColor={rule.enabled ? colors.accent : colors.textMuted}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </TouchableOpacity>
        ))
      ) : (
        <View style={s.smartRuleEmptyCard}>
          <View style={[s.smartRuleEmptyIcon, { backgroundColor: colors.accent + '15' }]}>
            <Feather name="git-merge" size={22} color={colors.accent} />
          </View>
          <Text style={s.smartRuleEmptyTitle}>Group merchants automatically</Text>
          <Text style={s.smartRuleEmptyBody}>
            Define IF conditions to merge multiple raw bank descriptions into one clean merchant name.
          </Text>
          <TouchableOpacity style={s.smartRuleEmptyCta} onPress={onNewRule} activeOpacity={0.8}>
            <Feather name="plus" size={16} color={colors.accent} />
            <Text style={s.smartRuleEmptyCtaText}>Create Your First Rule</Text>
          </TouchableOpacity>
        </View>
      )}
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
    actionTilePrimary: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionTilePrimaryLabel: {
      color: '#000',
      fontSize: fontSize.xs,
      fontWeight: '600',
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
      paddingHorizontal: spacing.xs,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      borderRadius: borderRadius.sm,
    },
    modalCountBadge: {
      backgroundColor: colors.accent,
      borderRadius: borderRadius.full,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    modalCountBadgeText: {
      color: '#000',
      fontSize: 11,
      fontWeight: '700',
    },
    modalDoneText: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: '600',
    },

    // ── Card breakdown ──
    cardBreakdownSection: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    cardBreakdownHeader: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    cardBreakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    cardDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    cardBreakdownName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      lineHeight: 20,
    },
    cardBreakdownSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    cardBreakdownAmount: {
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },

    // ── Transaction card indicator ──
    txnCardDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    txnCardName: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      maxWidth: 60,
      lineHeight: 16,
    },

    // ── Filters landing view ──
    filtersSubtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      paddingBottom: spacing.md,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    filterIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent + '15',
    },
    filterName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    filterSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    browseAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    browseAllText: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    filtersEmptyContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
      paddingBottom: 40,
    },
    filtersEmptyChipCloud: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xxl,
      paddingHorizontal: spacing.md,
    },
    filtersEmptyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    filtersEmptyChipText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    filtersEmptyChipBadge: {
      borderRadius: borderRadius.full,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filtersEmptyChipBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    filtersEmptyHeadline: {
      color: colors.textPrimary,
      fontSize: fontSize.hero,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 36,
      marginBottom: spacing.md,
    },
    filtersEmptyBody: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    filtersEmptyHints: {
      alignSelf: 'stretch',
      gap: spacing.lg,
      marginBottom: spacing.xxl,
    },
    filtersEmptyHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    filtersEmptyHintIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accent + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    filtersEmptyHintText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 20,
      flex: 1,
    },
    filtersEmptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      alignSelf: 'stretch',
    },
    filtersEmptyCtaText: {
      color: '#000',
      fontSize: fontSize.lg,
      fontWeight: '600',
    },

    // ── Save filter modal ──
    saveModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
    },
    saveModalCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      width: '100%',
      gap: spacing.lg,
    },
    saveModalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    saveModalInput: {
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveModalActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    saveModalCancel: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveModalCancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    saveModalConfirm: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accent,
    },
    saveModalConfirmText: {
      color: '#000',
      fontSize: fontSize.md,
      fontWeight: '600',
    },

    // ── Smart Rules ──
    smartRulesLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.8,
    },
    smartRuleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    smartRuleIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent + '15',
    },
    smartRuleName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      lineHeight: 20,
    },
    smartRuleSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
    },
    smartRuleEmptyCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    smartRuleEmptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    smartRuleEmptyTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    smartRuleEmptyBody: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
      textAlign: 'center',
    },
    smartRuleEmptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accent + '40',
      marginTop: spacing.sm,
    },
    smartRuleEmptyCtaText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  });
