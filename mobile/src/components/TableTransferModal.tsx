import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface TableTransferModalProps {
  visible: boolean;
  onClose: () => void;
  fromTable: string;
  orderNumber?: string;
  onSuccess?: (newTable: string) => void;
}

export const TableTransferModal: React.FC<TableTransferModalProps> = ({
  visible,
  onClose,
  fromTable,
  orderNumber,
  onSuccess,
}) => {
  const { tables, orders, transferTable, loading } = usePOS();

  // Find all occupied table names
  const occupiedNames = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (!o.closed) set.add(o.tableName);
    });
    return set;
  }, [orders]);

  // Vacant destination tables
  const vacantTables = useMemo(() => {
    return tables.filter(
      (t) => t.name !== fromTable && !occupiedNames.has(t.name) && t.status !== 'OCCUPIED'
    );
  }, [tables, fromTable, occupiedNames]);

  const [selectedToTable, setSelectedToTable] = useState<string>('');
  const [reason, setReason] = useState<string>('Guest shifted table');

  const handleConfirmTransfer = async () => {
    const target = selectedToTable || vacantTables[0]?.name;
    if (!target) {
      Alert.alert('Error', 'Please select a vacant destination table.');
      return;
    }

    const res = await transferTable(fromTable, target, reason.trim());
    if (res.success) {
      Alert.alert('Table Shifted', `Order transferred from ${fromTable} to ${target} successfully.`);
      if (onSuccess) onSuccess(target);
      onClose();
    } else {
      Alert.alert('Transfer Failed', res.error || 'Failed to shift table');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.gold} />
              <Text style={styles.modalTitle}>Shift Table</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Current Table:</Text>
              <Text style={styles.summaryValue}>{fromTable}</Text>
            </View>
            {orderNumber ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Order ID:</Text>
                <Text style={[styles.summaryValue, { color: COLORS.gold }]}>#{orderNumber}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Select Destination Vacant Table:</Text>

          {vacantTables.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No other tables are currently vacant!</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 160, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
              {vacantTables.map((t) => {
                const isSelected = (selectedToTable || vacantTables[0]?.name) === t.name;
                return (
                  <TouchableOpacity
                    key={t.id || t.name}
                    style={[styles.tableOption, isSelected && styles.tableOptionSelected]}
                    onPress={() => setSelectedToTable(t.name)}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={[styles.tableNameText, isSelected && styles.tableNameTextSelected]}>
                        {t.name}
                      </Text>
                      <Text style={styles.tableFloorText}>{t.floor} · {t.capacity} Seats</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.gold} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.sectionTitle}>Shift Reason (Optional):</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="e.g., Guest moved to AC section, joined friends..."
            placeholderTextColor={COLORS.textMuted}
            value={reason}
            onChangeText={setReason}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, vacantTables.length === 0 && styles.disabledBtn]}
              disabled={loading || vacantTables.length === 0}
              onPress={handleConfirmTransfer}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Shift</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  summaryBox: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 12,
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  emptyBox: {
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  tableOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    marginBottom: 6,
  },
  tableOptionSelected: {
    backgroundColor: 'rgba(159, 17, 25, 0.3)',
    borderColor: COLORS.gold,
  },
  tableNameText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  tableNameTextSelected: {
    color: '#ffffff',
  },
  tableFloorText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  reasonInput: {
    backgroundColor: COLORS.bgPrimary,
    color: '#ffffff',
    fontSize: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
