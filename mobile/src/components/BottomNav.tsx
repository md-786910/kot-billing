import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

export type TabKey = 'tables' | 'order' | 'kots' | 'shisha';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { cartCount, kots } = usePOS();
  const activeKotsCount = kots.filter((k) => k.status !== 'SERVED').length;

  return (
    <View style={styles.navBar}>
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('tables')}
      >
        <MaterialCommunityIcons
          name="table-furniture"
          size={22}
          color={activeTab === 'tables' ? COLORS.gold : COLORS.textMuted}
        />
        <Text style={[styles.navLabel, activeTab === 'tables' && styles.navLabelActive]}>
          Tables
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('order')}
      >
        <View>
          <MaterialCommunityIcons
            name="cart-plus"
            size={22}
            color={activeTab === 'order' ? COLORS.gold : COLORS.textMuted}
          />
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === 'order' && styles.navLabelActive]}>
          Order
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('kots')}
      >
        <View>
          <FontAwesome5
            name="concierge-bell"
            size={18}
            color={activeTab === 'kots' ? COLORS.gold : COLORS.textMuted}
          />
          {activeKotsCount > 0 && (
            <View style={[styles.badge, { backgroundColor: COLORS.kitchen }]}>
              <Text style={styles.badgeText}>{activeKotsCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navLabel, activeTab === 'kots' && styles.navLabelActive]}>
          Live KOTs
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => onTabChange('shisha')}
      >
        <MaterialCommunityIcons
          name="fire"
          size={22}
          color={activeTab === 'shisha' ? COLORS.gold : COLORS.textMuted}
        />
        <Text style={[styles.navLabel, activeTab === 'shisha' && styles.navLabelActive]}>
          Shisha
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  navLabelActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
