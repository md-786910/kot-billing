import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KOT, KOTStatus } from '../types';
import { COLORS, SPACE, stationColors } from '../constants/theme';
import { AppText, Badge, Button, Card, formatElapsed, minutesSince } from '../ui';

interface KOTCardProps {
  kot: KOT;
  /** Current time, ticked by the screen so the age badge stays fresh */
  now: number;
  /** Shown only for READY tickets when the signed-in user may update tickets */
  onMarkServed?: (kot: KOT) => void;
  /** This ticket's "Mark served" request is running */
  serving?: boolean;
  /** Reprint at the counter printer; shown on every ticket (cancelled ones reprint as cancel slips) */
  onReprint?: (kot: KOT) => void;
  /** This ticket's reprint request is running */
  reprinting?: boolean;
  /** Another ticket's reprint is running */
  reprintDisabled?: boolean;
}

const STATUS: Record<KOTStatus, { label: string; fg: string; bg: string }> = {
  NEW: { label: 'New', fg: COLORS.info, bg: COLORS.infoBg },
  PREPARING: { label: 'Preparing', fg: COLORS.warning, bg: COLORS.warningBg },
  READY: { label: 'Ready', fg: COLORS.success, bg: COLORS.successBg },
  SERVED: { label: 'Served', fg: COLORS.textSecondary, bg: COLORS.bgSurface },
  CANCELLED: { label: 'Cancelled', fg: COLORS.danger, bg: COLORS.dangerBg },
};

/** Waiting time colour: under 10 min fine, 10–20 getting long, over 20 late */
function ageColors(minutes: number): { fg: string; bg: string } {
  if (minutes > 20) return { fg: COLORS.danger, bg: COLORS.dangerBg };
  if (minutes >= 10) return { fg: COLORS.warning, bg: COLORS.warningBg };
  return { fg: COLORS.success, bg: COLORS.successBg };
}

export const KOTCard: React.FC<KOTCardProps> = ({ kot, now, onMarkServed, serving, onReprint, reprinting, reprintDisabled }) => {
  const status = STATUS[kot.status] ?? STATUS.NEW;
  const station = stationColors(kot.station);
  const done = kot.status === 'SERVED' || kot.status === 'CANCELLED';
  const cancelled = kot.status === 'CANCELLED';
  const age = done ? { fg: COLORS.textSecondary, bg: COLORS.bgSurface } : ageColors(minutesSince(kot.createdAt, now));
  const elapsed = formatElapsed(kot.createdAt, now);
  const number = kot.kotNumber ?? kot.id;

  return (
    <Card accent={cancelled ? COLORS.danger : kot.status === 'READY' ? COLORS.success : undefined} testID={`kot-${number}`}>
      <View style={styles.row}>
        <AppText variant="heading" numberOfLines={1} style={styles.flex}>
          {kot.tableName}
        </AppText>
        {elapsed ? <Badge label={elapsed} fg={age.fg} bg={age.bg} /> : null}
      </View>

      <View style={[styles.row, styles.meta]}>
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.shrink}>
          {number}
        </AppText>
        <Badge label={station.short} fg={station.fg} bg={station.bg} />
        <Badge label={status.label} fg={status.fg} bg={status.bg} />
      </View>

      {cancelled ? (
        <AppText variant="caption" tone="danger" style={styles.notes}>
          Cancelled. Do not prepare.
        </AppText>
      ) : null}

      <View style={styles.items}>
        {kot.items.map((it, idx) => (
          <View key={idx} style={styles.itemRow}>
            <AppText variant="bodyStrong" tone={cancelled ? 'muted' : 'gold'} money style={styles.qty}>
              {it.qty}×
            </AppText>
            <View style={styles.flex}>
              <AppText variant="body" tone={cancelled ? 'muted' : 'primary'} style={cancelled && styles.struck}>
                {it.name}
              </AppText>
              {it.notes ? (
                <AppText variant="caption" tone="warning">
                  {it.notes}
                </AppText>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      {kot.notes ? (
        <AppText variant="caption" tone="warning" style={styles.notes}>
          {kot.notes}
        </AppText>
      ) : null}

      {(kot.status === 'READY' && onMarkServed) || onReprint ? (
        <View style={styles.actions}>
          {kot.status === 'READY' && onMarkServed ? (
            <Button
              label="Mark served"
              variant="secondary"
              icon="check"
              onPress={() => onMarkServed(kot)}
              loading={serving}
              style={styles.flex}
              testID={`served-${number}`}
            />
          ) : null}
          {onReprint ? (
            <Button
              label="Reprint"
              variant="ghost"
              icon="printer"
              onPress={() => onReprint(kot)}
              loading={reprinting}
              disabled={reprintDisabled}
              testID={`reprint-${number}`}
              accessibilityLabel={`Reprint ${number}`}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  meta: { marginTop: SPACE.xs },
  items: {
    marginTop: SPACE.md,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    gap: SPACE.sm,
  },
  itemRow: { flexDirection: 'row', gap: SPACE.sm },
  qty: { minWidth: 28 },
  struck: { textDecorationLine: 'line-through' },
  notes: { marginTop: SPACE.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.md },
});
