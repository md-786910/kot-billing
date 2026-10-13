import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MenuItem, CartItem } from '../types';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { AppText, Badge, Button, Stepper, formatMoney } from '../ui';

interface MenuItemCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: (item: MenuItem) => void;
  onUpdateQty: (id: string, delta: number) => void;
  is86ManagerMode?: boolean;
  onToggle86?: (item: MenuItem) => void;
  /** Hide add/qty controls for staff who can't place orders */
  readOnly?: boolean;
}

/**
 * One compact menu row. Tapping the row adds one; the right side shows Add, a stepper once the
 * item is in the cart, or an in/out of stock toggle while editing stock.
 */
export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartItem,
  onAdd,
  onUpdateQty,
  is86ManagerMode,
  onToggle86,
  readOnly,
}) => {
  const outOfStock = !item.isAvailable;
  const qty = cartItem?.qty ?? 0;
  const canAdd = !is86ManagerMode && !readOnly && !outOfStock;
  const price = formatMoney(item.price);

  let control: React.ReactNode = null;
  if (is86ManagerMode) {
    control = (
      <Button
        label={outOfStock ? 'Out of stock' : 'In stock'}
        icon={outOfStock ? 'slash' : 'check-circle'}
        variant={outOfStock ? 'dangerGhost' : 'secondary'}
        onPress={() => onToggle86?.(item)}
        testID={`stock-${item.name}`}
        accessibilityLabel={outOfStock ? `${item.name} is out of stock. Mark in stock` : `${item.name} is in stock. Mark out of stock`}
      />
    );
  } else if (canAdd) {
    control =
      qty > 0 ? (
        <Stepper value={qty} itemName={item.name} onChange={(next) => onUpdateQty(item.id, next - qty)} />
      ) : (
        <Button label="Add" icon="plus" variant="secondary" onPress={() => onAdd(item)} testID={`add-${item.name}`} accessibilityLabel={`Add ${item.name}`} />
      );
  }

  return (
    <Pressable
      onPress={canAdd ? () => onAdd(item) : undefined}
      disabled={!canAdd}
      accessibilityRole={canAdd ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${price}${outOfStock ? ', out of stock' : ''}${qty > 0 ? `, ${qty} in cart` : ''}`}
      accessibilityHint={canAdd ? 'Adds one to the order' : undefined}
      style={({ pressed }) => [styles.row, qty > 0 && !is86ManagerMode && styles.rowInCart, pressed && styles.rowPressed]}
    >
      <View style={[styles.info, outOfStock && styles.dimmed]}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {item.name}
        </AppText>
        <AppText variant="caption" tone="secondary" money>
          {price}
        </AppText>
      </View>
      {outOfStock && !is86ManagerMode ? <Badge label="Out of stock" fg={COLORS.danger} bg={COLORS.dangerBg} /> : null}
      {control ? (
        // Swallow touches between the stepper buttons so they don't add another one via the row
        <View onStartShouldSetResponder={() => true}>{control}</View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  rowInCart: { borderColor: COLORS.gold },
  rowPressed: { backgroundColor: COLORS.bgSurface },
  info: { flex: 1, gap: 2 },
  dimmed: { opacity: 0.5 },
});
