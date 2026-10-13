import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { TableItem } from '../types';
import { COLORS } from '../constants/theme';

interface TableCardProps {
  table: TableItem;
  onSelect: (tableName: string) => void;
  onSettleBill?: (tableName: string) => void;
}

export const TableCard: React.FC<TableCardProps> = ({ table, onSelect, onSettleBill }) => {
  const isOccupied = table.status === 'OCCUPIED';
  const isBillPrinted = table.status === 'BILL_PRINTED';

  return (
    <TouchableOpacity
      style={[
        styles.tableCard,
        isOccupied && styles.tableCardOccupied,
        isBillPrinted && styles.tableCardBillPrinted,
      ]}
      onPress={() => onSelect(table.name)}
      activeOpacity={0.7}
    >
      <View style={styles.tableCardHeader}>
        <Text style={styles.tableName}>{table.name}</Text>
        <View
          style={[
            styles.statusTag,
            isOccupied
              ? styles.statusTagOccupied
              : isBillPrinted
              ? styles.statusTagBillPrinted
              : styles.statusTagVacant,
          ]}
        >
          <Text style={styles.statusTagText}>
            {isOccupied ? 'OCCUPIED' : isBillPrinted ? 'BILL' : 'VACANT'}
          </Text>
        </View>
      </View>

      <Text style={styles.tableFloor}>{table.floor}</Text>
      <View style={styles.tableFooter}>
        <Text style={styles.tableCapacity}>Cap: {table.capacity}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isOccupied && onSettleBill && (
            <TouchableOpacity
              style={styles.settleShortcutBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                onSettleBill(table.name);
              }}
            >
              <Text style={styles.settleShortcutText}>₹ Bill</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.orderShortcut}>{isOccupied ? '+ Add' : '+ Order'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tableCard: {
    width: '48%',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  tableCardOccupied: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.bgCardOccupied,
  },
  tableCardBillPrinted: {
    borderColor: COLORS.gold,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tableName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagVacant: {
    backgroundColor: COLORS.vacantBg,
  },
  statusTagOccupied: {
    backgroundColor: COLORS.occupiedBg,
  },
  statusTagBillPrinted: {
    backgroundColor: COLORS.billPrintedBg,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  tableFloor: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 12,
  },
  tableFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 8,
  },
  tableCapacity: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  orderShortcut: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  settleShortcutBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  settleShortcutText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
});
