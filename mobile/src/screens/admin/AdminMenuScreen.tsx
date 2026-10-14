import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { COLORS, SPACE, stationColors } from '../../constants/theme';
import { usePOS } from '../../context/POSContext';
import { errorMessage } from '../../services/api';
import { createMenuItem, fetchAdminMenu, setMenuItemAvailable, updateMenuItemPrice } from '../../services/adminApi';
import { MenuItem, Station } from '../../types';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  OptionRow,
  SectionLabel,
  Sheet,
  SheetActions,
  formatMoney,
} from '../../ui';
import { Field } from './AdminSettingsScreen';

const STATIONS: { key: Station; title: string; subtitle: string }[] = [
  { key: 'Kitchen', title: 'Kitchen', subtitle: 'Food tickets print in the kitchen' },
  { key: 'Beverage Counter', title: 'Bar', subtitle: 'Beverage counter' },
  { key: 'Shisha Master', title: 'Shisha', subtitle: 'Shisha master' },
];

/** "120", "120.5" → number; anything else → null */
function parsePrice(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function AdminMenuScreen() {
  const { can, refreshData } = usePOS();
  const canEdit = can('menu.edit');
  const canStock = can('menu.stock');

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchAdminMenu());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the menu'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Reload this list and the order screen's menu */
  const reloadAll = useCallback(async () => {
    await load();
    void refreshData().catch(() => {});
  }, [load, refreshData]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (category === 'All' || i.category === category) && (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    );
  }, [items, query, category]);

  const toggleStock = async (item: MenuItem) => {
    if (busyId) return;
    setBusyId(item.id);
    setActionError(null);
    try {
      await setMenuItemAvailable(item.id, !item.isAvailable);
      await reloadAll();
    } catch (err) {
      setActionError(errorMessage(err, `Could not update ${item.name}`));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {canEdit ? <Button label="Add item" icon="plus" fullWidth onPress={() => setAdding(true)} testID="add-menu-item" /> : null}
        <Field
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Item or category"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          testID="menu-search"
        />
      </View>

      <ChipRow style={styles.chips}>
        {['All', ...categories].map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`menu-category-${c}`} />
        ))}
      </ChipRow>

      {loadError || actionError ? (
        <View style={styles.banners}>
          {loadError ? <Banner tone="danger" text={loadError} actionLabel="Retry" onAction={() => void load()} /> : null}
          {actionError ? <Banner tone="danger" text={actionError} actionLabel="Dismiss" onAction={() => setActionError(null)} /> : null}
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="book-open"
            title={items.length === 0 ? 'No menu items yet' : 'Nothing matches'}
            hint={items.length === 0 ? (canEdit ? 'Add your first item.' : undefined) : 'Try another search or category.'}
          />
        }
        renderItem={({ item }) => (
          <MenuRow
            item={item}
            canEdit={canEdit}
            canStock={canStock}
            busy={busyId === item.id}
            onEdit={() => setEditing(item)}
            onToggleStock={() => void toggleStock(item)}
          />
        )}
      />

      <EditPriceSheet item={editing} onClose={() => setEditing(null)} onSaved={reloadAll} />
      <AddItemSheet visible={adding} categories={categories} onClose={() => setAdding(false)} onSaved={reloadAll} />
    </View>
  );
}

function MenuRow({
  item,
  canEdit,
  canStock,
  busy,
  onEdit,
  onToggleStock,
}: {
  item: MenuItem;
  canEdit: boolean;
  canStock: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleStock: () => void;
}) {
  const station = stationColors(item.station).short;
  return (
    <Card
      onPress={canEdit ? onEdit : undefined}
      testID={`menu-item-${item.name}`}
      accessibilityLabel={`${item.name}, ${formatMoney(item.price)}. Edit price`}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" tone={item.isAvailable ? 'primary' : 'muted'} numberOfLines={2}>
          {item.name}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {item.category} · {station}
        </AppText>
        <AppText variant="bodyStrong" tone="gold" money>
          {formatMoney(item.price)}
        </AppText>
      </View>
      {canStock ? (
        <Button
          label={item.isAvailable ? 'In stock' : 'Out of stock'}
          icon={item.isAvailable ? 'check' : 'slash'}
          variant={item.isAvailable ? 'secondary' : 'dangerGhost'}
          loading={busy}
          onPress={onToggleStock}
          testID={`stock-${item.name}`}
          accessibilityLabel={`${item.name} is ${item.isAvailable ? 'in stock' : 'out of stock'}. Tap to mark ${
            item.isAvailable ? 'out of stock' : 'in stock'
          }`}
        />
      ) : !item.isAvailable ? (
        <Badge label="Out of stock" fg={COLORS.danger} bg={COLORS.dangerBg} />
      ) : null}
    </Card>
  );
}

function EditPriceSheet({ item, onClose, onSaved }: { item: MenuItem | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setPrice(String(item.price));
      setError(null);
      setSaving(false);
    }
  }, [item]);

  const save = async () => {
    if (!item || saving) return;
    const value = parsePrice(price);
    if (value === null) {
      setError('Enter a price in rupees, for example 250');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMenuItemPrice(item.id, value);
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not change the price'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={!!item}
      title="Edit price"
      subtitle={item ? `${item.name} · ${item.category} · ${stationColors(item.station).short}` : undefined}
      onClose={onClose}
      testID="edit-price-sheet"
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Save price" onPress={save} loading={saving} style={styles.grow} testID="save-price" />
        </SheetActions>
      }
    >
      <Field
        label="Price (₹)"
        value={price}
        onChangeText={(v) => {
          setPrice(v.replace(/[^0-9.]/g, ''));
          setError(null);
        }}
        keyboardType="decimal-pad"
        maxLength={9}
        hint={item ? `Now ${formatMoney(item.price)}. Applies to new orders only.` : undefined}
        testID="menu-price-input"
      />
      {error ? <Banner tone="danger" text={error} /> : null}
    </Sheet>
  );
}

function AddItemSheet({
  visible,
  categories,
  onClose,
  onSaved,
}: {
  visible: boolean;
  categories: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState<Station>('Kitchen');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setPrice('');
      setStation('Kitchen');
      setCategory('');
      setError(null);
      setSaving(false);
    }
  }, [visible]);

  const save = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    const value = parsePrice(price);
    if (!trimmedName) return setError('Enter the item name');
    if (value === null) return setError('Enter a price in rupees, for example 250');
    if (!trimmedCategory) return setError('Choose or type a category');
    setSaving(true);
    setError(null);
    try {
      await createMenuItem({ name: trimmedName, price: value, station, category: trimmedCategory });
      await onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Could not add the item'));
    } finally {
      setSaving(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <Sheet
      visible={visible}
      title="Add item"
      onClose={onClose}
      dismissOnBackdrop={false}
      testID="add-item-sheet"
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Add item" onPress={save} loading={saving} style={styles.grow} testID="save-menu-item" />
        </SheetActions>
      }
    >
      <Field
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          clearError();
        }}
        maxLength={80}
        testID="menu-name-input"
      />
      <Field
        label="Price (₹)"
        value={price}
        onChangeText={(v) => {
          setPrice(v.replace(/[^0-9.]/g, ''));
          clearError();
        }}
        keyboardType="decimal-pad"
        maxLength={9}
        testID="menu-new-price-input"
      />

      <View style={styles.group}>
        <SectionLabel>Prints at</SectionLabel>
        {STATIONS.map((s) => (
          <OptionRow
            key={s.key}
            title={s.title}
            subtitle={s.subtitle}
            selected={station === s.key}
            onPress={() => setStation(s.key)}
            testID={`menu-station-${s.title}`}
          />
        ))}
      </View>

      <View style={styles.group}>
        <SectionLabel>Category</SectionLabel>
        {categories.length > 0 ? (
          <View style={styles.chipWrap}>
            {categories.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={category.trim() === c}
                onPress={() => {
                  setCategory(c);
                  clearError();
                }}
                testID={`menu-new-category-${c}`}
              />
            ))}
          </View>
        ) : null}
        <Field
          label={categories.length > 0 ? 'Or a new category' : 'Category name'}
          value={category}
          onChangeText={(v) => {
            setCategory(v);
            clearError();
          }}
          maxLength={40}
          testID="menu-category-input"
        />
      </View>

      {error ? <Banner tone="danger" text={error} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, gap: SPACE.md },
  chips: { paddingTop: SPACE.sm },
  banners: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.sm },
  list: { padding: SPACE.lg, gap: SPACE.sm, paddingBottom: SPACE.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  rowText: { flex: 1, gap: 2 },
  grow: { flex: 1 },
  group: { gap: SPACE.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
