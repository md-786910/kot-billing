import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { Order } from '../types';
import { AppText, Button, EmptyState, OptionRow, Sheet, SheetActions, formatMoney } from '../ui';

interface TableMergeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (targetTable: string) => void;
}

/** Running amount and item count of an open order (voided items excluded) */
function running(order: Order | undefined): { total: number; count: number } {
  const items = order ? order.items.filter((x) => !x.isVoided) : [];
  return {
    total: items.reduce((sum, x) => sum + x.price * x.qty, 0),
    count: items.reduce((sum, x) => sum + x.qty, 0),
  };
}

export const TableMergeModal: React.FC<TableMergeModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { tables, orders, selectedTable, mergeTables } = usePOS();
  const [isMerging, setIsMerging] = useState(false);

  const openOrders = useMemo(() => {
    const byTable = new Map<string, Order>();
    for (const o of orders) if (!o.closed) byTable.set(o.tableName, o);
    return byTable;
  }, [orders]);

  // Find other occupied tables
  const occupiedTables = useMemo(() => {
    return tables.filter((t) => t.name !== selectedTable && openOrders.has(t.name));
  }, [tables, openOrders, selectedTable]);

  const [targetTable, setTargetTable] = useState<string>('');

  // Start every opening with nothing picked
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    setTargetTable('');
  }

  // A picked table whose bill has since closed no longer counts as picked
  const picked = occupiedTables.some((t) => t.name === targetTable) ? targetTable : '';

  const source = running(openOrders.get(selectedTable));

  const handleExecute = async () => {
    if (!picked) {
      Alert.alert('Pick a table', 'Choose a table in use to merge into.');
      return;
    }

    setIsMerging(true);
    const res = await mergeTables(selectedTable, picked);
    setIsMerging(false);
    if (res.busy) return;

    if (res.success) {
      Alert.alert('Tables merged', `${selectedTable} is now part of ${picked}. ${selectedTable} is free.`);
      onSuccess(picked);
      onClose();
    } else if (res.uncertain) {
      Alert.alert('Not confirmed yet', res.error || 'Check the tables before trying again.');
    } else {
      Alert.alert('Merge failed', res.error || 'Failed to merge tables.');
    }
  };

  return (
    <Sheet
      visible={visible}
      title={`Merge ${selectedTable} into…`}
      subtitle="Items and payments move to the table you pick"
      onClose={onClose}
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isMerging} />
          <Button
            label={picked ? `Merge into ${picked}` : 'Merge'}
            onPress={handleExecute}
            loading={isMerging}
            disabled={!picked}
            style={styles.grow}
            testID="confirm-merge"
          />
        </SheetActions>
      }
    >
      {occupiedTables.length === 0 ? (
        <EmptyState icon="git-merge" title="No other tables in use" hint="You can only merge into a table with a running bill." />
      ) : (
        <>
          <AppText variant="caption" tone="secondary">
            Moving {source.count} item{source.count === 1 ? '' : 's'} · {formatMoney(source.total)}
          </AppText>
          <View style={styles.list} accessibilityRole="radiogroup">
            {occupiedTables.map((t) => {
              const r = running(openOrders.get(t.name));
              return (
                <OptionRow
                  key={t.id || t.name}
                  title={t.name}
                  subtitle={`${formatMoney(r.total)} running · ${t.floor}`}
                  selected={picked === t.name}
                  onPress={() => setTargetTable(t.name)}
                  testID={`merge-into-${t.name}`}
                />
              );
            })}
          </View>
        </>
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  list: { gap: SPACE.sm },
});
