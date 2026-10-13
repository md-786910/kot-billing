import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

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
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="fire" size={28} color={COLORS.gold} />
      </View>
      <Text style={styles.brand}>LAYALI</Text>
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
    gap: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
