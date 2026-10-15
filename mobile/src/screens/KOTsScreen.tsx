import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Alert } from '../ui/alert';
import { KOTCard } from '../components/KOTCard';
import { COLORS, SPACE } from '../constants/theme';
import { useGrid } from '../hooks/useGrid';
import { usePrintStatus } from '../hooks/usePrintStatus';
import { usePOS } from '../context/POSContext';
import { errorMessage } from '../services/api';
import { requestKotReprint } from '../services/printApi';
import { KOT, KOTStatus, Station } from '../types';
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
  const grid = useGrid(270, SPACE.lg, SPACE.md);
  const [view, setView] = useState<Tab>('active');
  const [filter, setFilter] = useState<Filter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const canServe = can('kot.update');
  const canReprint = can('order.create') || can('kot.update');
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const { status: printStatus } = usePrintStatus();
  const reprintingRef = useRef(false);

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

  // Start → Ready → Served (or straight to Served); one update at a time so double taps don't skip a step
  const advance = async (kot: KOT, status: KOTStatus) => {
    if (updatingId) return;
    setUpdatingId(kot.id);
    const res = await updateKOT(kot.kotNumber ?? kot.id, status);
    setUpdatingId(null);
    if (!res.success && !res.busy) Alert.alert("Couldn't update the ticket", res.error || 'Try again.');
  };

  // Reprints at the counter printer; one at a time so a double tap can't print twice
  const reprint = async (kot: KOT) => {
    if (reprintingRef.current) return;
    reprintingRef.current = true;
    setReprintingId(kot.id);
    const number = kot.kotNumber ?? kot.id;
    try {
      await requestKotReprint(number);
      const station = printStatus?.station;
      const slip = kot.status === 'CANCELLED' ? `The cancel slip for ${number}` : `The slip for ${number}`;
      // Say plainly when the slip can't print yet, so nobody waits at the printer
      Alert.alert(
        'Slip sent to the counter printer',
        station && !station.configured
          ? `${slip} is queued, but no counter printer is set. Ask the owner to choose one in Devices.`
          : station && !station.online
          ? `${slip} is queued. The counter printer is offline; it will print when it's back.`
          : `${slip} is printing at the counter.`
      );
    } catch (err) {
      Alert.alert("Couldn't reprint", errorMessage(err, 'Try again.'));
    } finally {
      reprintingRef.current = false;
      setReprintingId(null);
    }
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
        key={`kots-${grid.columns}`}
        data={visible}
        keyExtractor={(k) => k.id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? styles.row : undefined}
        renderItem={({ item }) => (
          <View style={{ width: grid.itemWidth }}>
            <KOTCard
              kot={item}
              now={now}
              onAdvance={canServe ? advance : undefined}
              updating={updatingId === item.id}
              onReprint={canReprint ? reprint : undefined}
              reprinting={reprintingId === item.id}
              reprintDisabled={!!reprintingId && reprintingId !== item.id}
            />
          </View>
        )}
        extraData={`${now}-${updatingId}-${reprintingId}`}
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
  row: { gap: SPACE.md },
});
