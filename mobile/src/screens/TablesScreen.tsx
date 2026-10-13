import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { TableCard } from '../components/TableCard';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface TablesScreenProps {
  onSelectTableAndOrder: (tableName: string) => void;
}

export const TablesScreen: React.FC<TablesScreenProps> = ({ onSelectTableAndOrder }) => {
  const { tables, selectedFloor, setSelectedFloor } = usePOS();

  return (
    <View style={styles.container}>
      {/* Floor Selector */}
      <View style={styles.filterRow}>
        {['All', 'Main Floor', '1st Floor', '2nd Floor'].map((fl) => (
          <TouchableOpacity
            key={fl}
            style={[styles.filterPill, selectedFloor === fl && styles.filterPillActive]}
            onPress={() => setSelectedFloor(fl)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterPillText, selectedFloor === fl && styles.filterPillTextActive]}
            >
              {fl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tables Grid */}
      <ScrollView contentContainerStyle={styles.tableGrid} showsVerticalScrollIndicator={false}>
        {tables
          .filter((t) => selectedFloor === 'All' || t.floor === selectedFloor)
          .map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onSelect={onSelectTableAndOrder}
            />
          ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryHover,
  },
  filterPillText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
});
