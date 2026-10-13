import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, SPACE } from '../constants/theme';
import { AppText, Button, formatMoney } from '../ui';

interface StickyCartBarProps {
  count: number;
  total: number;
  onReview: () => void;
}

/** Unsent items for this table, pinned above the bottom nav. Hidden when the cart is empty. */
export const StickyCartBar: React.FC<StickyCartBarProps> = ({ count, total, onReview }) => {
  if (count === 0) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.summary} accessible accessibilityLabel={`${count} items in cart, ${formatMoney(total)}`}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {count} item{count === 1 ? '' : 's'}
        </AppText>
        <AppText variant="heading" tone="gold" money numberOfLines={1}>
          {formatMoney(total)}
        </AppText>
      </View>
      <Button label="Review order" onPress={onReview} testID="review-cart" />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },
  summary: { flex: 1 },
});
