import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { AppText } from '../ui';

export type TabKey = 'tables' | 'order' | 'kots' | 'shisha' | 'more';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'tables', label: 'Tables', icon: 'table-furniture' },
  { key: 'order', label: 'Order', icon: 'silverware-fork-knife' },
  { key: 'kots', label: 'KOTs', icon: 'receipt' },
  { key: 'shisha', label: 'Shisha', icon: 'fire' },
  { key: 'more', label: 'More', icon: 'dots-horizontal-circle-outline' },
];

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { cartCount, kots } = usePOS();
  const insets = useSafeAreaInsets();
  const badges: Partial<Record<TabKey, number>> = {
    order: cartCount,
    kots: kots.filter((k) => k.status === 'NEW' || k.status === 'PREPARING' || k.status === 'READY').length,
  };

  return (
    // Sits above the system navigation bar; on wide screens the tabs stay grouped in the middle
    <View style={[styles.navBar, { paddingBottom: SPACE.sm + insets.bottom }]}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = tab.key === activeTab;
          const badge = badges[tab.key] ?? 0;
          return (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={badge > 0 ? `${tab.label}, ${badge}` : tab.label}
              onPress={() => onTabChange(tab.key)}
              style={styles.navItem}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                <MaterialCommunityIcons name={tab.icon} size={24} color={active ? COLORS.gold : COLORS.textMuted} />
                {badge > 0 && (
                  <View style={[styles.badge, tab.key === 'kots' && { backgroundColor: COLORS.kitchen }]}>
                    <AppText variant="badge" style={{ color: tab.key === 'kots' ? COLORS.bgPrimary : COLORS.onPrimary }}>
                      {badge > 99 ? '99+' : badge}
                    </AppText>
                  </View>
                )}
              </View>
              <AppText variant="label" style={{ color: active ? COLORS.gold : COLORS.textMuted }}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
    paddingTop: SPACE.sm,
  },
  tabs: { flexDirection: 'row', width: '100%', maxWidth: 640, alignSelf: 'center' },
  navItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  iconWrap: { width: 56, height: 32, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: COLORS.goldSubtle },
  badge: {
    position: 'absolute',
    top: -4,
    right: 4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.bgSecondary,
  },
});
