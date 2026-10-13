import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface StickyCartBarProps {
  count: number;
  total: number;
  onReview: () => void;
}

export const StickyCartBar: React.FC<StickyCartBarProps> = ({ count, total, onReview }) => {
  if (count === 0) return null;

  return (
    <View style={styles.stickyCartBar}>
      <View>
        <Text style={styles.cartCountText}>{count} Items Selected</Text>
        <Text style={styles.cartTotalText}>₹{total.toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.reviewBtn} onPress={onReview} activeOpacity={0.8}>
        <Text style={styles.reviewBtnText}>Review & Send KOT</Text>
        <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  stickyCartBar: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  cartCountText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  cartTotalText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
