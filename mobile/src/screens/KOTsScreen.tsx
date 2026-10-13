import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KOTCard } from '../components/KOTCard';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

export const KOTsScreen: React.FC = () => {
  const { kots, refreshData } = usePOS();

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Active KOT Dockets</Text>
        <TouchableOpacity onPress={refreshData} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {kots.length === 0 ? (
        <Text style={styles.emptyText}>No active kitchen tickets.</Text>
      ) : (
        kots.map((kot) => <KOTCard key={kot.id} kot={kot} />)
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
