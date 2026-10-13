import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { KOT } from '../types';
import { COLORS } from '../constants/theme';

interface KOTCardProps {
  kot: KOT;
}

export const KOTCard: React.FC<KOTCardProps> = ({ kot }) => {
  const isReady = kot.status === 'READY';
  const isPrep = kot.status === 'PREPARING';
  const isCancelled = kot.status === 'CANCELLED';

  return (
    <View style={[styles.kotCard, isCancelled && styles.kotCardCancelled]}>
      {isCancelled ? (
        <View style={styles.cancelledBanner}>
          <Text style={styles.cancelledBannerText}>⛔ VOID DOCKET: DO NOT PREPARE</Text>
        </View>
      ) : null}

      <View style={styles.kotCardHeader}>
        <View>
          <Text style={styles.kotNumber}>{kot.kotNumber || kot.id}</Text>
          <Text style={styles.kotTable}>{kot.tableName}</Text>
        </View>
        <View
          style={[
            styles.kotStatusTag,
            isCancelled
              ? styles.statusCancelled
              : isReady
              ? styles.statusReady
              : isPrep
              ? styles.statusPrep
              : styles.statusNew,
          ]}
        >
          <Text style={styles.kotStatusText}>{kot.status}</Text>
        </View>
      </View>

      <Text style={styles.kotStation}>{kot.station}</Text>

      <View style={styles.kotItemsList}>
        {kot.items.map((it, idx) => (
          <View key={idx} style={styles.kotItemRow}>
            <Text style={styles.kotItemQty}>{it.qty}x</Text>
            <Text style={[styles.kotItemName, isCancelled && styles.kotItemNameCancelled]}>
              {it.name}
            </Text>
          </View>
        ))}
      </View>

      {kot.notes ? (
        <Text style={styles.kotNotes}>Note: {kot.notes}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  kotCard: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  kotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  kotNumber: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  kotTable: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  kotStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusNew: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusPrep: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  kotStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  kotStation: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  kotItemsList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 8,
  },
  kotItemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  kotItemQty: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    width: 24,
  },
  kotItemName: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  kotNotes: {
    color: COLORS.gold,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
  },
  kotCardCancelled: {
    borderColor: '#ef4444',
    backgroundColor: '#1c1416',
  },
  cancelledBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelledBannerText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusCancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  kotItemNameCancelled: {
    textDecorationLine: 'line-through',
    color: '#f87171',
  },
});
