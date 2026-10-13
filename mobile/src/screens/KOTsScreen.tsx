import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { KOTCard } from '../components/KOTCard';
import { COLORS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { KOT, Station } from '../types';
import { Chip, ChipRow, EmptyState, Segmented } from '../ui';

type Filter = 'All' | 'Kitchen' | 'Bar' | 'Shisha';
type Tab = 'active' | 'done';

const FILTERS: { key: Filter; station?: Station }[] = [
  { key: 'All' },
  { key: 'Kitchen', station: 'Kitchen' },
  { key: 'Bar', station: 'Beverage Counter' },
  { key: 'Shisha', station: 'Shisha Master' },
];

const TICK_MS = 30_000;

const isDone = (k: KOT) => k.status === 'SERVED' || k.status === 'CANCELLED';
const time = (k: KOT) => new Date(k.createdAt).getTime() || 0;

export const KOTsScreen: React.FC = () => {
  const { kots, refreshData, updateKOT, can } = usePOS();
  const [view, setView] = useState<Tab>('active');
  const [filter, setFilter] = useState<Filter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [servingId, setServingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const canServe = can('kot.update');

  // Keep the age badges current between data refreshes
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Active: oldest first (first in, first out). Done: most recent first.
  const inView = useMemo(() => {
    const list = kots.filter((k) => (view === 'done' ? isDone(k) : !isDone(k)));
    return list.sort((a, b) => (view === 'done' ? time(b) - time(a) : time(a) - time(b)));
  }, [kots, view]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { All: inView.length, Kitchen: 0, Bar: 0, Shisha: 0 };
    for (const k of inView) {
      const f = FILTERS.find((x) => x.station === k.station);
      if (f) c[f.key] += 1;
    }
    return c;
  }, [inView]);

  const station = FILTERS.find((f) => f.key === filter)?.station;
  const visible = station ? inView.filter((k) => k.station === station) : inView;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  }, [refreshData]);

  const markServed = async (kot: KOT) => {
    if (servingId) return;
    setServingId(kot.id);
    const res = await updateKOT(kot.kotNumber ?? kot.id, 'SERVED');
    setServingId(null);
    if (!res.success && !res.busy) Alert.alert('Could not mark served', res.error || 'Try again.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.segment}>
        <Segmented<Tab>
          options={[
            { key: 'active', label: 'Active', testID: 'kots-active' },
            { key: 'done', label: 'Done', testID: 'kots-done' },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      <ChipRow style={styles.chips}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.key}
            count={counts[f.key]}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            testID={`kot-filter-${f.key}`}
          />
        ))}
      </ChipRow>

      <FlatList
        data={visible}
        keyExtractor={(k) => k.id}
        renderItem={({ item }) => (
          <KOTCard
            kot={item}
            now={now}
            onMarkServed={canServe ? markServed : undefined}
            serving={servingId === item.id}
          />
        )}
        extraData={`${now}-${servingId}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
            progressBackgroundColor={COLORS.bgSurface}
          />
        }
        ListEmptyComponent={
          view === 'active' ? (
            <EmptyState icon="inbox" title="No open tickets" hint="Pull down to refresh." />
          ) : (
            <EmptyState icon="check-circle" title="No finished tickets" hint="Served and cancelled tickets show here." />
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  segment: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  chips: { paddingTop: SPACE.sm },
  list: { gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.xxl, flexGrow: 1 },
});
