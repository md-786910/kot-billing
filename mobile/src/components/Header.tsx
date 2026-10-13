import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { isConnected, currentStaff, lock } = usePOS();

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <MaterialCommunityIcons name="fire" size={24} color={COLORS.gold} />
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.headerTitle}>LAYALI POS</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {currentStaff ? `${currentStaff.name} • ${roleLabel(currentStaff.role)}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity
          style={[styles.connBadge, isConnected ? styles.connOnline : styles.connOffline]}
          onPress={onOpenSettings}
          accessibilityLabel={`${isConnected ? 'Online' : 'Offline'}. Open settings`}
        >
          <View style={[styles.dot, { backgroundColor: isConnected ? COLORS.vacant : COLORS.occupied }]} />
          <Text style={styles.connText}>{isConnected ? 'Online' : 'Offline'}</Text>
          <Ionicons name="settings-outline" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.lockBtn}
          onPress={() => lock()}
          accessibilityRole="button"
          accessibilityLabel="Lock"
        >
          <Feather name="lock" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  connOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  connOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  connText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
