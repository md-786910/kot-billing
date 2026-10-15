import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACE, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { usePrintStatus } from '../hooks/usePrintStatus';
import { AppText, Banner, IconButton } from '../ui';
import { PrintQueueSheet } from './PrintQueueSheet';

interface HeaderProps {
  /** What this screen is about, e.g. "Tables" or "Table 4" */
  title: string;
  /** Optional context line; defaults to the signed-in staff member */
  subtitle?: string;
}

/**
 * Screen title on the left, print queue and Lock on the right.
 * Offline and counter printer banners appear only when needed.
 */
export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { isConnected, currentStaff, lock, refreshData } = usePOS();
  const { problem, message, tone } = usePrintStatus();
  const [showQueue, setShowQueue] = useState(false);
  const insets = useSafeAreaInsets();
  // Wide screens (tablets) show the printer warning as a pill in the header row to save height
  const { width } = useWindowDimensions();
  const compact = width >= 600;
  // While offline the printer status is stale, and the offline banner already explains why
  const printProblem = isConnected && problem ? message : null;
  const staffLine = currentStaff ? `${currentStaff.name} · ${roleLabel(currentStaff.role)}` : '';

  return (
    // The header colour runs up under the status bar
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {subtitle ?? staffLine}
          </AppText>
        </View>
        {printProblem && compact ? (
          <Pressable
            onPress={() => setShowQueue(true)}
            style={[styles.pill, { backgroundColor: tone === 'danger' ? COLORS.dangerBg : COLORS.warningBg }]}
            accessibilityRole="button"
            accessibilityLabel={`${printProblem} Open print queue`}
            testID="printer-pill"
          >
            <Feather name="alert-triangle" size={16} color={tone === 'danger' ? COLORS.danger : COLORS.warning} />
            <AppText variant="label" numberOfLines={1} style={[styles.pillText, { color: tone === 'danger' ? COLORS.danger : COLORS.warning }]}>
              {printProblem}
            </AppText>
          </Pressable>
        ) : null}
        <View>
          <IconButton
            icon="printer"
            label={printProblem ? `Print queue. ${printProblem}` : 'Print queue'}
            onPress={() => setShowQueue(true)}
            testID="printer-status"
          />
          {printProblem ? <View style={styles.dot} pointerEvents="none" testID="printer-problem-dot" /> : null}
        </View>
        <IconButton icon="lock" label="Lock" onPress={() => lock()} testID="lock" />
      </View>
      {!isConnected && (
        <View style={styles.banner}>
          <Banner tone="danger" text="Offline. Orders can't be sent until Wi-Fi is back." actionLabel="Retry" onAction={refreshData} />
        </View>
      )}
      {printProblem && !compact ? (
        <View style={styles.banner} testID="printer-banner">
          <Banner tone={tone} text={printProblem} actionLabel="View" onAction={() => setShowQueue(true)} />
        </View>
      ) : null}
      <PrintQueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.bgSecondary, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.lg, paddingRight: SPACE.sm, paddingVertical: SPACE.sm },
  titles: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    flexShrink: 1,
    maxWidth: '55%',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.full,
  },
  pillText: { flexShrink: 1 },
  banner: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.md },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    borderWidth: 2,
    borderColor: COLORS.bgSecondary,
  },
});
