import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TableCard } from '../components/TableCard';
import { COLORS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { useContentWidth } from '../hooks/useGrid';
import { AppText, Chip, ChipRow, EmptyState } from '../ui';

interface TablesScreenProps {
  onSelectTable: (tableName: string) => void;
}

const PADDING = SPACE.lg;
const GAP = SPACE.md;

export const TablesScreen: React.FC<TablesScreenProps> = ({ onSelectTable }) => {
  const { tables, orders, selectedFloor, setSelectedFloor } = usePOS();
  const width = useContentWidth();
  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const cardWidth = Math.floor((width - PADDING * 2 - GAP * (columns - 1)) / columns);

  // Main floor first, then upper floors in order
  const floors = useMemo(() => {
    const unique = Array.from(new Set(tables.map((t) => t.floor)));
    unique.sort((a, b) => (a === 'Main Floor' ? -1 : b === 'Main Floor' ? 1 : a.localeCompare(b, undefined, { numeric: true })));
    return ['All', ...unique];
  }, [tables]);
  const openOrders = useMemo(() => {
    const byTable = new Map<string, (typeof orders)[number]>();
    for (const o of orders) if (!o.closed) byTable.set(o.tableName, o);
    return byTable;
  }, [orders]);

  const visible = tables.filter((t) => selectedFloor === 'All' || t.floor === selectedFloor);
  const inUse = tables.filter((t) => openOrders.has(t.name)).length;

  return (
    <View style={styles.container}>
      <ChipRow style={styles.floors}>
        {floors.map((fl) => (
          <Chip key={fl} label={fl} selected={selectedFloor === fl} onPress={() => setSelectedFloor(fl)} testID={`floor-${fl}`} />
        ))}
      </ChipRow>

      <AppText variant="caption" tone="muted" style={styles.summary}>
        {inUse} of {tables.length} tables in use
      </AppText>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {visible.length === 0 ? (
          <EmptyState icon="grid" title="No tables here" hint="Pick another floor." />
        ) : (
          visible.map((table) => (
            <TableCard key={table.id} table={table} order={openOrders.get(table.name)} width={cardWidth} onSelect={onSelectTable} />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  floors: { paddingTop: SPACE.md },
  summary: { paddingHorizontal: PADDING, paddingTop: SPACE.md, paddingBottom: SPACE.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PADDING, paddingBottom: SPACE.xxl },
});
