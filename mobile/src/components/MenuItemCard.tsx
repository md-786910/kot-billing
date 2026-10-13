import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MenuItem, CartItem } from '../types';
import { COLORS } from '../constants/theme';

interface MenuItemCardProps {
  item: MenuItem;
  cartItem?: CartItem;
  onAdd: (item: MenuItem) => void;
  onUpdateQty: (id: string, delta: number) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartItem,
  onAdd,
  onUpdateQty,
}) => {
  const is86 = !item.isAvailable;

  return (
    <View style={[styles.menuItemCard, is86 && styles.menuItemCard86]}>
      <View style={styles.menuItemInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[styles.menuItemName, is86 && styles.menuItemName86]}>{item.name}</Text>
          {is86 && (
            <View style={styles.badge86}>
              <Text style={styles.badge86Text}>86 SOLD OUT</Text>
            </View>
          )}
        </View>
        <View style={styles.menuItemMeta}>
          <Text style={styles.menuItemPrice}>₹{item.price}</Text>
          <Text
            style={[
              styles.stationBadge,
              item.station === 'Kitchen'
                ? styles.badgeKitchen
                : item.station === 'Beverage Counter'
                ? styles.badgeBar
                : styles.badgeShisha,
            ]}
          >
            {item.station}
          </Text>
        </View>
      </View>

      {is86 ? (
        <View style={styles.btn86Disabled}>
          <Text style={styles.btn86Text}>86'd</Text>
        </View>
      ) : cartItem ? (
        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => onUpdateQty(item.id, -1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.stepperQty}>{cartItem.qty}</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => onUpdateQty(item.id, 1)}
            activeOpacity={0.7}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => onAdd(item)}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ ADD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemPrice: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  stationBadge: {
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeKitchen: {
    backgroundColor: COLORS.kitchenBg,
    color: COLORS.kitchen,
  },
  badgeBar: {
    backgroundColor: COLORS.barBg,
    color: COLORS.bar,
  },
  badgeShisha: {
    backgroundColor: COLORS.shishaBg,
    color: COLORS.shisha,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepperBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  stepperQty: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  menuItemCard86: {
    opacity: 0.65,
    backgroundColor: '#161314',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  menuItemName86: {
    textDecorationLine: 'line-through',
    color: COLORS.textMuted,
  },
  badge86: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badge86Text: {
    color: '#f87171',
    fontSize: 9,
    fontWeight: '800',
  },
  btn86Disabled: {
    backgroundColor: '#262626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#404040',
  },
  btn86Text: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
  },
});
