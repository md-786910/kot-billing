import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
export type Tone = 'primary' | 'secondary' | 'muted' | 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'onPrimary';

const TONE_COLOR: Record<Tone, string> = {
  primary: COLORS.textPrimary,
  secondary: COLORS.textSecondary,
  muted: COLORS.textMuted,
  gold: COLORS.gold,
  success: COLORS.success,
  warning: COLORS.warning,
  danger: COLORS.danger,
  info: COLORS.info,
  onPrimary: COLORS.onPrimary,
};

// ---------- Text ----------

export function AppText({
  variant = 'body',
  tone = 'primary',
  money,
  style,
  ...props
}: TextProps & { variant?: keyof typeof TYPE; tone?: Tone; money?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      {...props}
      style={[TYPE[variant], { color: TONE_COLOR[tone] }, money && styles.money, style]}
    />
  );
}

/** Small sentence-case heading above a group of content */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="label" tone="muted" style={[styles.sectionLabel, style]}>
      {children}
    </AppText>
  );
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';

const BUTTON_STYLES: Record<ButtonVariant, { bg: string; border: string; fg: string; pressed: string }> = {
  primary: { bg: COLORS.primary, border: COLORS.primary, fg: COLORS.onPrimary, pressed: COLORS.primaryPressed },
  secondary: { bg: COLORS.bgSurface, border: COLORS.borderDefault, fg: COLORS.textPrimary, pressed: COLORS.borderDefault },
  ghost: { bg: 'transparent', border: 'transparent', fg: COLORS.textSecondary, pressed: COLORS.bgSurface },
  danger: { bg: COLORS.dangerStrong, border: COLORS.dangerStrong, fg: COLORS.onPrimary, pressed: '#991b1b' },
  dangerGhost: { bg: 'transparent', border: 'transparent', fg: COLORS.danger, pressed: COLORS.dangerBg },
};

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: FeatherName;
  /** Trailing text shown after the label, e.g. an amount */
  trailing?: string;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  trailing,
  loading,
  disabled,
  fullWidth,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const v = BUTTON_STYLES[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (trailing ? `${label} ${trailing}` : label)}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: size === 'lg' ? TOUCH.large : TOUCH.min, backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        fullWidth && styles.fullWidth,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={size === 'lg' ? 20 : 18} color={v.fg} />}
          <Text style={[size === 'lg' ? TYPE.heading : TYPE.bodyStrong, { color: v.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {trailing ? (
            <Text style={[size === 'lg' ? TYPE.heading : TYPE.bodyStrong, styles.money, { color: v.fg, opacity: 0.9 }]}>
              {trailing}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Round 48dp icon button. `label` is required for screen readers. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'secondary',
  testID,
  style,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  tone?: Tone;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: COLORS.bgSurface }, style]}
    >
      <Feather name={icon} size={22} color={TONE_COLOR[tone]} />
    </Pressable>
  );
}

/** Square action tile: icon over a short label (table actions). */
export function ActionTile({
  icon,
  label,
  onPress,
  tone = 'primary',
  disabled,
  testID,
}: {
  icon: FeatherName;
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && { backgroundColor: COLORS.borderDefault }, disabled && styles.disabled]}
    >
      <Feather name={icon} size={20} color={TONE_COLOR[tone]} />
      <AppText variant="label" tone={tone === 'primary' ? 'secondary' : tone}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ---------- Selection ----------

export function Chip({
  label,
  selected,
  onPress,
  count,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && !selected && { backgroundColor: COLORS.borderDefault }]}
    >
      <AppText variant="label" style={{ color: selected ? COLORS.bgPrimary : COLORS.textSecondary }}>
        {label}
        {count !== undefined ? ` ${count}` : ''}
      </AppText>
    </Pressable>
  );
}

/** Horizontally scrolling row of chips that never clips (floors, categories, filters). */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.chipRow, style]}
      contentContainerStyle={styles.chipRowContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Two or three equal segments, e.g. Menu | Ordered (3) */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; testID?: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={o.testID}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <AppText variant="bodyStrong" tone={active ? 'primary' : 'muted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selectable full-width row with a radio mark (reasons, tables). */
export function OptionRow({
  title,
  subtitle,
  selected,
  onPress,
  testID,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, selected && styles.optionRowSelected, pressed && !selected && { backgroundColor: COLORS.bgSurface }]}
    >
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
    </Pressable>
  );
}

/** − qty + with 44dp buttons */
export function Stepper({ value, onChange, itemName, max = 99 }: { value: number; onChange: (next: number) => void; itemName: string; max?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${itemName}`} onPress={() => onChange(value - 1)} style={styles.stepBtn} hitSlop={4}>
        <Feather name={value <= 1 ? 'trash-2' : 'minus'} size={18} color={value <= 1 ? COLORS.danger : COLORS.textPrimary} />
      </Pressable>
      <AppText variant="heading" money style={styles.stepValue}>
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${itemName}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.stepBtn, value >= max && styles.disabled]}
        hitSlop={4}
      >
        <Feather name="plus" size={18} color={COLORS.gold} />
      </Pressable>
    </View>
  );
}

// ---------- Display ----------

export function Badge({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="badge" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

export function Card({
  children,
  onPress,
  accent,
  style,
  testID,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** Coloured left edge + border, e.g. an occupied table */
  accent?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const base = [styles.card, accent ? { borderColor: accent + '66', borderLeftColor: accent, borderLeftWidth: 3 } : null, style];
  if (!onPress) return <View style={base} testID={testID}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && { backgroundColor: COLORS.bgSurface }]}
    >
      {children}
    </Pressable>
  );
}

export function Banner({
  tone = 'info',
  text,
  actionLabel,
  onAction,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const fg = { info: COLORS.info, warning: COLORS.warning, danger: COLORS.danger, success: COLORS.success }[tone];
  const bg = { info: COLORS.infoBg, warning: COLORS.warningBg, danger: COLORS.dangerBg, success: COLORS.successBg }[tone];
  const icon: FeatherName = tone === 'success' ? 'check-circle' : tone === 'info' ? 'info' : 'alert-triangle';
  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: fg + '55' }]} accessibilityRole="alert">
      <Feather name={icon} size={18} color={fg} />
      <AppText variant="body" style={{ flex: 1, color: COLORS.textPrimary }}>
        {text}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.bannerAction}>
          <AppText variant="bodyStrong" style={{ color: fg }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, hint }: { icon: FeatherName; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={36} color={COLORS.textMuted} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {hint ? (
        <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  money: { fontVariant: ['tabular-nums'] },
  sectionLabel: { marginBottom: SPACE.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  iconButton: {
    width: TOUCH.min,
    height: TOUCH.min,
    borderRadius: TOUCH.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTile: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  chipSelected: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipRow: { flexGrow: 0, flexShrink: 0 },
  chipRowContent: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs, alignItems: 'center' },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  segmentActive: { backgroundColor: COLORS.bgSurface, borderWidth: 1, borderColor: COLORS.borderStrong },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 56,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgCard,
  },
  optionRowSelected: { borderColor: COLORS.gold, backgroundColor: COLORS.goldSubtle },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: COLORS.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.gold },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 28, textAlign: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: SPACE.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  bannerAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: SPACE.sm },
  empty: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xxl },
  divider: { height: 1, backgroundColor: COLORS.borderSubtle },
});
