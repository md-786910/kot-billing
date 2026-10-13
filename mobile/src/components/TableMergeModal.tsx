import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { PrivacyCover } from './PrivacyCover';

interface TableMergeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (targetTable: string) => void;
}

export const TableMergeModal: React.FC<TableMergeModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { tables, orders, selectedTable, mergeTables, markActivity } = usePOS();
  const [isMerging, setIsMerging] = useState(false);

  // Find other occupied tables
  const occupiedTables = useMemo(() => {
    const occupiedNames = new Set(
      orders.filter((o) => !o.closed).map((o) => o.tableName)
    );
    return tables.filter(
      (t) => t.name !== selectedTable && occupiedNames.has(t.name)
    );
  }, [tables, orders, selectedTable]);

  const [targetTable, setTargetTable] = useState<string>(
    occupiedTables[0]?.name || ''
  );

  const activeOrder = orders.find((o) => !o.closed && o.tableName === selectedTable);
  const runningItemsCount = activeOrder ? activeOrder.items.filter((x) => !x.isVoided).length : 0;
  const runningTotal = activeOrder
    ? activeOrder.items
        .filter((x) => !x.isVoided)
        .reduce((sum, x) => sum + x.price * x.qty, 0)
    : 0;

  const handleExecute = async () => {
    if (!targetTable) {
      Alert.alert('Selection Required', 'Please select an occupied destination table.');
      return;
    }

    setIsMerging(true);
    const res = await mergeTables(selectedTable, targetTable);
    setIsMerging(false);
    if (res.busy) return;

    if (res.success) {
      Alert.alert(
        'Tables Merged Successfully',
        `Table ${selectedTable} has been combined into ${targetTable}. Table ${selectedTable} is now VACANT.`
      );
      onSuccess(targetTable);
      onClose();
    } else {
      Alert.alert('Merge Failed', res.error || 'Failed to merge tables.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay} onTouchStart={markActivity}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="call-merge" size={22} color="#818cf8" />
              <Text style={styles.modalTitle}>Merge Table Orders</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalDesc}>
            Combine active items and bills from <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{selectedTable}</Text> into another occupied table.
          </Text>

          {/* Current order summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Closing Source Table:</Text>
              <Text style={styles.summaryVal}>{selectedTable}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Active Items:</Text>
              <Text style={[styles.summaryVal, { color: '#818cf8' }]}>{runningItemsCount} Items</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Balance to Transfer:</Text>
              <Text style={[styles.summaryVal, { color: COLORS.vacant }]}>₹{runningTotal.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Select Occupied Target Table:</Text>
          {occupiedTables.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No other occupied tables currently active.</Text>
            </View>
          ) : (
            <View style={styles.tableList}>
              {occupiedTables.map((t) => (
                <TouchableOpacity
                  key={t.id || t.name}
                  style={[
                    styles.tableChip,
                    (targetTable === t.name || (!targetTable && occupiedTables[0]?.name === t.name)) &&
                      styles.tableChipActive,
                  ]}
                  onPress={() => setTargetTable(t.name)}
                >
                  <Text
                    style={[
                      styles.tableChipText,
                      (targetTable === t.name || (!targetTable && occupiedTables[0]?.name === t.name)) &&
                        styles.tableChipTextActive,
                    ]}
                  >
                    {t.name} ({t.floor})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (isMerging || occupiedTables.length === 0) && { opacity: 0.5 },
              ]}
              onPress={handleExecute}
              disabled={isMerging || occupiedTables.length === 0}
            >
              {isMerging ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmText}>Confirm Table Merge</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <PrivacyCover />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4f46e5',
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  summaryVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.bgPrimary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  tableList: {
    gap: 8,
    marginBottom: 16,
  },
  tableChip: {
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  tableChipActive: {
    borderColor: '#818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  tableChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tableChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.bgSurface,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
