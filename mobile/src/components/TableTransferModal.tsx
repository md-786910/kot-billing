import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { Button, EmptyState, OptionRow, SectionLabel, Sheet, SheetActions } from '../ui';

interface TableTransferModalProps {
  visible: boolean;
  onClose: () => void;
  fromTable: string;
  orderNumber?: string;
  onSuccess?: (newTable: string) => void;
}

// Sent when staff leave the optional reason empty (the server always got this text before)
const DEFAULT_REASON = 'Guest shifted table';

export const TableTransferModal: React.FC<TableTransferModalProps> = ({
  visible,
  onClose,
  fromTable,
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
  const [reason, setReason] = useState<string>('');

  // Start every opening with nothing picked
  useEffect(() => {
    setSelectedToTable('');
    setReason('');
  }, [visible]);

  // A picked table that has since filled up no longer counts as picked
  const picked = vacantTables.some((t) => t.name === selectedToTable) ? selectedToTable : '';

  const handleConfirmTransfer = async () => {
    const target = picked;
    if (!target) {
      Alert.alert('Pick a table', 'Choose a free table to move to.');
      return;
    }

    const res = await transferTable(fromTable, target, reason.trim() || DEFAULT_REASON);
    if (res.busy) return;
    if (res.success) {
      Alert.alert('Table moved', `${fromTable} is now at ${target}.`);
      if (onSuccess) onSuccess(target);
      onClose();
    } else if (res.uncertain) {
      Alert.alert('Not confirmed yet', res.error || 'Check the tables before trying again.');
    } else {
      Alert.alert('Move failed', res.error || "Couldn't move the table.");
    }
  };

  return (
    <Sheet
      visible={visible}
      title={`Move ${fromTable}`}
      subtitle="Pick a free table"
      onClose={onClose}
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button
            label={picked ? `Move to ${picked}` : 'Move'}
            onPress={handleConfirmTransfer}
            loading={loading}
            disabled={!picked}
            style={styles.grow}
            testID="confirm-move"
          />
        </SheetActions>
      }
    >
      {vacantTables.length === 0 ? (
        <EmptyState icon="grid" title="No free tables" hint="Every other table is in use right now." />
      ) : (
        <>
          <View style={styles.list} accessibilityRole="radiogroup">
            {vacantTables.map((t) => (
              <OptionRow
                key={t.id || t.name}
                title={t.name}
                subtitle={`${t.floor} · ${t.capacity} seat${t.capacity === 1 ? '' : 's'}`}
                selected={picked === t.name}
                onPress={() => setSelectedToTable(t.name)}
                testID={`move-to-${t.name}`}
              />
            ))}
          </View>

          <View>
            <SectionLabel>Reason (optional)</SectionLabel>
            <TextInput
              style={styles.input}
              placeholder="e.g. Moved to the terrace"
              placeholderTextColor={COLORS.textMuted}
              value={reason}
              onChangeText={setReason}
              accessibilityLabel="Reason, optional"
              testID="move-reason"
            />
          </View>
        </>
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  list: { gap: SPACE.sm },
  input: {
    minHeight: TOUCH.min,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.bgInput,
    color: COLORS.textPrimary,
    fontSize: TYPE.body.fontSize,
  },
});
