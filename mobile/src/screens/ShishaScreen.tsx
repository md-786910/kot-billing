import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShishaCard } from '../components/ShishaCard';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

export const ShishaScreen: React.FC = () => {
  const { kots, extendShisha, refreshData, can } = usePOS();
  const canExtend = can('shisha.manage');

  const handleExtend = async (kotId: string) => {
    const res = await extendShisha(kotId);
    if (!res.success) Alert.alert('Could not extend', res.error || 'Try again.');
  };
  const shishaPots = kots.filter((k) => k.station === 'Shisha Master' && k.status !== 'SERVED');

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Active Shisha Pots</Text>
        <TouchableOpacity onPress={refreshData} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {shishaPots.length === 0 ? (
        <Text style={styles.emptyText}>No active shisha pots currently running.</Text>
      ) : (
        shishaPots.map((pot) => (
          <ShishaCard key={pot.id} pot={pot} onExtend={canExtend ? handleExtend : undefined} />
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
  },
});
