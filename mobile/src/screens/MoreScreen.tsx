import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { Permission } from '../types';
import { AppText, Card, IconButton, SectionLabel } from '../ui';
import { SettingsScreen } from './SettingsScreen';
import { BookingsScreen } from './BookingsScreen';
import { ShiftScreen } from './ShiftScreen';
import { AdminMenuScreen } from './admin/AdminMenuScreen';
import { AdminSettingsScreen } from './admin/AdminSettingsScreen';
import { AdminStaffScreen } from './admin/AdminStaffScreen';
import { AdminDevicesScreen } from './admin/AdminDevicesScreen';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export type MorePage = 'bookings' | 'shift' | 'menu' | 'lounge' | 'staff' | 'devices' | 'account';

interface MoreRow {
  key: MorePage;
  title: string;
  hint: string;
  icon: FeatherName;
  /** Hidden when the signed-in user lacks this permission */
  permission?: Permission;
}

const GROUPS: { label: string; rows: MoreRow[] }[] = [
  {
    label: 'Service',
    rows: [
      { key: 'bookings', title: 'Private bookings', hint: 'VIP Lounge and Couple Cabin', icon: 'calendar', permission: 'booking.manage' },
      { key: 'shift', title: 'Cash drawer', hint: 'Open, drop cash and close the shift', icon: 'dollar-sign', permission: 'shift.manage' },
    ],
  },
  {
    label: 'Admin',
    rows: [
      { key: 'menu', title: 'Menu & stock', hint: 'Mark items in or out of stock', icon: 'book-open', permission: 'menu.stock' },
      { key: 'lounge', title: 'Lounge details', hint: 'Name, address, GST and UPI', icon: 'home', permission: 'settings.manage' },
      { key: 'staff', title: 'Staff', hint: 'Add staff, roles and PINs', icon: 'users', permission: 'staff.manage' },
      { key: 'devices', title: 'Devices', hint: 'Pair and remove terminals', icon: 'smartphone', permission: 'device.manage' },
    ],
  },
  {
    label: 'You',
    rows: [{ key: 'account', title: 'Account', hint: 'PIN, server and lock', icon: 'user' }],
  },
];

export const MORE_PAGE_TITLES: Record<MorePage, string> = {
  bookings: 'Private bookings',
  shift: 'Cash drawer',
  menu: 'Menu & stock',
  lounge: 'Lounge details',
  staff: 'Staff',
  devices: 'Devices',
  account: 'Account',
};

interface MoreScreenProps {
  /** Open sub-screen, or null for the list (owned by App so the header can show its title) */
  page: MorePage | null;
  onPageChange: (page: MorePage | null) => void;
  /** Select a table/venue and switch to the Order tab */
  onOpenTable: (tableName: string) => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({ page, onPageChange, onOpenTable }) => {
  const { can } = usePOS();

  if (page) {
    return (
      <View style={styles.container}>
        <View style={styles.backRow}>
          <IconButton icon="arrow-left" label="Back" onPress={() => onPageChange(null)} testID="more-back" />
          <AppText variant="heading" numberOfLines={1} style={styles.flex}>
            {MORE_PAGE_TITLES[page]}
          </AppText>
        </View>
        <View style={styles.flex}>
          {page === 'bookings' && <BookingsScreen onOpenTable={onOpenTable} />}
          {page === 'shift' && <ShiftScreen />}
          {page === 'menu' && <AdminMenuScreen />}
          {page === 'lounge' && <AdminSettingsScreen />}
          {page === 'staff' && <AdminStaffScreen />}
          {page === 'devices' && <AdminDevicesScreen />}
          {page === 'account' && <SettingsScreen />}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.list}>
      {GROUPS.map((group) => {
        const rows = group.rows.filter((r) => !r.permission || can(r.permission));
        if (rows.length === 0) return null;
        return (
          <View key={group.label} style={styles.group}>
            <SectionLabel>{group.label}</SectionLabel>
            {rows.map((row) => (
              <Card
                key={row.key}
                onPress={() => onPageChange(row.key)}
                testID={`more-${row.key}`}
                accessibilityLabel={`${row.title}. ${row.hint}`}
                style={styles.row}
              >
                <View style={styles.rowIcon}>
                  <Feather name={row.icon} size={22} color={COLORS.gold} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{row.title}</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={1}>
                    {row.hint}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={22} color={COLORS.textMuted} />
              </Card>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.xxl, gap: SPACE.xl },
  group: { gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 72,
    paddingVertical: SPACE.md,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldSubtle,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
});
