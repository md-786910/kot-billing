import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface HeaderProps {
  onOpenConfig: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenConfig }) => {
  const { isConnected } = usePOS();

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <MaterialCommunityIcons name="fire" size={24} color={COLORS.gold} />
        <Text style={styles.headerTitle}>LAYALI POS</Text>
        <Text style={styles.headerSubtitle}>Waiter / Captain</Text>
      </View>

      <TouchableOpacity
        style={[styles.connBadge, isConnected ? styles.connOnline : styles.connOffline]}
        onPress={onOpenConfig}
      >
        <View style={[styles.dot, { backgroundColor: isConnected ? COLORS.vacant : COLORS.occupied }]} />
        <Text style={styles.connText}>{isConnected ? 'Online' : 'Offline'}</Text>
        <Ionicons name="settings-outline" size={13} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  connBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});
