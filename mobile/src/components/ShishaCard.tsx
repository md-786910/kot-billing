import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KOT } from '../types';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { AppText, Badge, Button, Card, minutesSince } from '../ui';

export const DEFAULT_SHISHA_MINUTES = 45;

const potMinutes = (pot: KOT) => (pot.duration && pot.duration > 0 ? pot.duration : DEFAULT_SHISHA_MINUTES);

/** Minutes left on a pot (negative once it has run over) */
export function shishaMinutesLeft(pot: KOT, now: number): number {
  return potMinutes(pot) - minutesSince(pot.startedAt ?? pot.createdAt, now);
}

function potState(left: number): { label: string; fg: string; bg: string } {
  if (left <= 0) return { label: 'Time up', fg: COLORS.danger, bg: COLORS.dangerBg };
  if (left <= 10) return { label: 'Ending soon', fg: COLORS.danger, bg: COLORS.dangerBg };
  if (left <= 25) return { label: 'Check coals', fg: COLORS.warning, bg: COLORS.warningBg };
  return { label: 'Burning well', fg: COLORS.success, bg: COLORS.successBg };
}

interface ShishaCardProps {
  pot: KOT;
  /** Current time, ticked by the screen */
  now: number;
  /** Omitted when the signed-in user can't manage shisha */
  onExtend?: (pot: KOT) => void;
  extending?: boolean;
}

export const ShishaCard: React.FC<ShishaCardProps> = ({ pot, now, onExtend, extending }) => {
  const total = potMinutes(pot);
  const left = shishaMinutesLeft(pot, now);
  const state = potState(left);
  const over = Math.floor(-left);
  const timeText = left > 0 ? `${Math.ceil(left)} min left` : over >= 1 ? `Over by ${over} min` : 'Time up';
  const progress = Math.min(1, Math.max(0, 1 - left / total));
  const flavour = pot.items.map((i) => (i.qty > 1 ? `${i.qty}× ${i.name}` : i.name)).join(', ');
  const number = pot.kotNumber ?? pot.id;

  return (
    <Card accent={left <= 10 ? COLORS.danger : undefined} testID={`shisha-${number}`}>
      <View style={styles.row}>
        <AppText variant="heading" numberOfLines={1} style={styles.flex}>
          {pot.tableName}
        </AppText>
        <Badge label={state.label} fg={state.fg} bg={state.bg} />
      </View>

      <AppText variant="display" tone={left > 0 ? 'primary' : 'danger'} money style={styles.time}>
        {timeText}
      </AppText>

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: Math.round(Math.min(total, total - left)) }}
      >
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: state.fg }]} />
      </View>

      <View style={styles.footer}>
        <View style={styles.flex}>
          {flavour ? (
            <AppText variant="caption" tone="secondary">
              {flavour}
            </AppText>
          ) : null}
          {pot.notes ? (
            <AppText variant="caption" tone="muted">
              {pot.notes}
            </AppText>
          ) : null}
        </View>
        {onExtend ? (
          <Button
            label="+15 min"
            variant="secondary"
            onPress={() => onExtend(pot)}
            loading={extending}
            accessibilityLabel={`Add 15 minutes to ${pot.tableName}`}
            testID={`extend-${number}`}
          />
        ) : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  time: { marginTop: SPACE.sm },
  track: { height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.bgSurface, overflow: 'hidden', marginTop: SPACE.sm },
  fill: { height: '100%', borderRadius: RADIUS.full },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md },
});
