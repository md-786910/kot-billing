import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
// Not '../ui': Sheet imports this file, so the barrel would make a require cycle
import { AppText } from '../ui/primitives';

/** Small Layali brand mark (also used on the pairing and lock screens) */
export const LogoMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}>
    <MaterialCommunityIcons name="fire" size={Math.round(size * 0.5)} color={COLORS.gold} />
  </View>
);

/**
 * Plain branded screen shown while the app is not in the foreground, so the iOS app switcher
 * snapshot never shows orders or bills. Modals render above the main view, so each modal adds
 * its own cover as its last child as well.
 */
export const PrivacyCover: React.FC = () => {
  const { privacyCover } = usePOS();
  if (!privacyCover) return null;

  return (
    <View style={styles.cover} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LogoMark size={48} />
      <AppText variant="title">Layali</AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    zIndex: 1000,
    elevation: 1000,
  },
  mark: {
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
