import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TableItem, Order } from '../types';
import { COLORS, SPACE } from '../constants/theme';
import { AppText, Card, formatElapsed, formatMoney } from '../ui';

interface TableCardProps {
  table: TableItem;
  /** The table's running bill, if any */
  order?: Order;
  width: number;
  onSelect: (tableName: string) => void;
}

/** Free tables stay quiet; a table in use shows its running amount and how long guests have been seated. */
export const TableCard: React.FC<TableCardProps> = ({ table, order, width, onSelect }) => {
  const inUse = !!order || table.status === 'OCCUPIED';
  const items = order ? order.items.filter((it) => !it.isVoided) : [];
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const itemCount = items.reduce((sum, it) => sum + it.qty, 0);
  const seats = `${table.capacity} seat${table.capacity === 1 ? '' : 's'}`;
  const label = inUse
    ? `${table.name}, in use, ${formatMoney(total)}, ${itemCount} items`
    : `${table.name}, free, ${seats}`;

  return (
    <Card
      onPress={() => onSelect(table.name)}
      accent={inUse ? COLORS.occupied : undefined}
      style={[styles.card, { width }, inUse && styles.cardInUse]}
      testID={`table-${table.name}`}
      accessibilityLabel={label}
    >
      <AppText variant="heading" numberOfLines={1}>
        {table.name}
      </AppText>
      {inUse ? (
        <View style={styles.body}>
          <AppText variant="title" tone="gold" money>
            {formatMoney(total)}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {[order ? formatElapsed(order.createdAt) : '', `${itemCount} item${itemCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          </AppText>
        </View>
      ) : (
        <View style={styles.freeRow}>
          <View style={styles.dot} />
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            Free · {seats}
          </AppText>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { minHeight: 104, padding: SPACE.lg, justifyContent: 'space-between' },
  cardInUse: { backgroundColor: COLORS.bgCardOccupied },
  body: { gap: 2, marginTop: SPACE.sm },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.vacant },
});
