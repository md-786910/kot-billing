import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS, SPACE, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { AppText, Banner, IconButton } from '../ui';

interface HeaderProps {
  /** What this screen is about, e.g. "Tables" or "Table 4" */
  title: string;
  /** Optional context line; defaults to the signed-in staff member */
  subtitle?: string;
}

/** Screen title on the left, Lock on the right; an offline banner appears only when needed. */
export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { isConnected, currentStaff, lock, refreshData } = usePOS();
  const staffLine = currentStaff ? `${currentStaff.name} · ${roleLabel(currentStaff.role)}` : '';

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle ?? staffLine}
          </AppText>
        </View>
        <IconButton icon="lock" label="Lock" onPress={() => lock()} testID="lock" />
      </View>
      {!isConnected && (
        <View style={styles.banner}>
          <Banner tone="danger" text="Offline. Orders can't be sent until Wi-Fi is back." actionLabel="Retry" onAction={refreshData} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.bgSecondary, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.lg, paddingRight: SPACE.sm, paddingVertical: SPACE.sm },
  titles: { flex: 1 },
  banner: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md },
});
