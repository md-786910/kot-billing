import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KOT } from '../types';
import { COLORS } from '../constants/theme';

interface ShishaCardProps {
  pot: KOT;
  /** Omitted when the signed-in user can't manage shisha */
  onExtend?: (kotId: string) => void;
}

export const ShishaCard: React.FC<ShishaCardProps> = ({ pot, onExtend }) => {
  return (
    <View style={styles.shishaCard}>
      <View style={styles.shishaCardHeader}>
        <Text style={styles.shishaTable}>{pot.tableName}</Text>
        <Text style={styles.shishaFlavour}>
          {pot.items.map((i) => i.name).join(' + ')}
        </Text>
      </View>

      <View style={styles.shishaTimerRow}>
        <MaterialCommunityIcons name="timer-sand" size={20} color={COLORS.shisha} />
        <Text style={styles.shishaTimerText}>
          Duration: {pot.duration || 45} mins
        </Text>
        {onExtend ? (
          <TouchableOpacity
            style={styles.extendBtn}
            onPress={() => onExtend(pot.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.extendBtnText}>+15 Mins</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shishaCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  shishaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shishaTable: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  shishaFlavour: {
    color: COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  shishaTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 10,
  },
  shishaTimerText: {
    color: COLORS.shisha,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  extendBtn: {
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  extendBtnText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
  },
});
