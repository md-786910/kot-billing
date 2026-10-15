import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Alert } from '../ui/alert';
import { ShishaCard, shishaMinutesLeft } from '../components/ShishaCard';
import { COLORS, SPACE } from '../constants/theme';
import { useGrid } from '../hooks/useGrid';
import { usePOS } from '../context/POSContext';
import { KOT } from '../types';
import { EmptyState } from '../ui';

const TICK_MS = 15_000;

export const ShishaScreen: React.FC = () => {
  const { kots, extendShisha, refreshData, can } = usePOS();
  const grid = useGrid(270, SPACE.lg, SPACE.md);
  const canExtend = can('shisha.manage');
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  // Live countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Running pots only, least time left first
  const pots = useMemo(
    () =>
      kots
        .filter((k) => k.station === 'Shisha Master' && k.status !== 'SERVED' && k.status !== 'CANCELLED')
        .sort((a, b) => shishaMinutesLeft(a, now) - shishaMinutesLeft(b, now)),
    [kots, now]
  );

  const handleExtend = async (pot: KOT) => {
    if (extendingId) return;
    setExtendingId(pot.id);
    const res = await extendShisha(pot.id);
    setExtendingId(null);
    setNow(Date.now());
    if (!res.success && !res.busy) Alert.alert('Could not extend', res.error || 'Try again.');
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  }, [refreshData]);

  return (
    <View style={styles.container}>
      <FlatList
        key={`shisha-${grid.columns}`}
        data={pots}
        keyExtractor={(k) => k.id}
        numColumns={grid.columns}
        columnWrapperStyle={grid.columns > 1 ? styles.row : undefined}
        renderItem={({ item }) => (
          <View style={{ width: grid.itemWidth }}>
            <ShishaCard pot={item} now={now} onExtend={canExtend ? handleExtend : undefined} extending={extendingId === item.id} />
          </View>
        )}
        extraData={`${now}-${extendingId}`}
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
        ListEmptyComponent={<EmptyState icon="wind" title="No shisha running" hint="Pull down to refresh." />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { gap: SPACE.md, padding: SPACE.lg, paddingBottom: SPACE.xxl, flexGrow: 1 },
  row: { gap: SPACE.md },
});
