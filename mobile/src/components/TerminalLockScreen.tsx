import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { errorMessage, errorStatus, fetchSignInStaff } from '../services/api';
import { StaffUser } from '../types';
import { useCooldown } from '../hooks/useCooldown';
import { AppText, Banner, Button, EmptyState } from '../ui';
import { LogoMark } from './PrivacyCover';

const MIN_PIN = 4;
const MAX_PIN = 6;
const KEY_SIZE = 72;
const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** Gold initial in a circle */
const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <View style={styles.avatar}>
    <AppText variant="heading" tone="gold">
      {name.charAt(0).toUpperCase()}
    </AppText>
  </View>
);

/** Round keypad key, at least 64dp */
const Key: React.FC<{ label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode; quiet?: boolean }> = ({
  label,
  onPress,
  disabled,
  children,
  quiet,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [styles.key, quiet && styles.keyQuiet, pressed && styles.keyPressed]}
  >
    {children}
  </Pressable>
);

export const TerminalLockScreen: React.FC = () => {
  const { signIn, checkAuth, device, authNotice, markServerReachable } = usePOS();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<{ message: string; status: number } | null>(null);
  // Only the latest staff request may update the screen
  const staffRequestRef = useRef(0);

  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set synchronously so a double tap can't send the PIN twice
  const submittingRef = useRef(false);
  const cooldown = useCooldown();

  const loadStaff = useCallback(async () => {
    const requestId = ++staffRequestRef.current;
    setStaffLoading(true);
    setStaffError(null);
    try {
      const list = await fetchSignInStaff();
      if (requestId !== staffRequestRef.current) return;
      setStaff(list);
      markServerReachable();
    } catch (err) {
      if (requestId !== staffRequestRef.current) return;
      const status = errorStatus(err);
      setStaffError({ message: errorMessage(err, 'Could not load staff'), status });
      // Device token rejected: let the app decide whether to show pairing
      if (status === 401) void checkAuth();
    } finally {
      if (requestId === staffRequestRef.current) setStaffLoading(false);
    }
  }, [checkAuth, markServerReachable]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // If boot couldn't reach the server we don't know this device yet: re-check pairing too
  const retry = () => {
    if (!device) void checkAuth();
    loadStaff();
  };

  // Functional updates so quick taps never drop digits
  const pressDigit = (digit: string) => {
    setError(null);
    setPin((p) => (p.length >= MAX_PIN ? p : p + digit));
  };
  const pressDelete = () => {
    setError(null);
    setPin((p) => p.slice(0, -1));
  };
  const pressClear = () => {
    setError(null);
    setPin('');
  };

  const chooseStaff = (user: StaffUser) => {
    setSelected(user);
    setPin('');
    setError(null);
  };

  const backToNames = () => {
    setSelected(null);
    setPin('');
    setError(null);
  };

  const submit = async () => {
    if (!selected || pin.length < MIN_PIN || submittingRef.current || cooldown.active) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    const res = await signIn(selected.id, pin);
    // On success this screen unmounts
    if (!res.success) {
      submittingRef.current = false;
      setSubmitting(false);
      setPin('');
      setError(res.error || 'Incorrect PIN');
      if (res.status === 429) cooldown.start();
    }
  };

  const canSubmit = !!selected && pin.length >= MIN_PIN && !submitting && !cooldown.active;
  const dotCount = Math.max(MIN_PIN, pin.length);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <LogoMark />
        </View>

        {!selected ? (
          <View style={styles.column}>
            <AppText variant="title" style={styles.center}>
              {"Who's signing in?"}
            </AppText>
            {authNotice && !staffError ? <Banner tone="info" text={authNotice} /> : null}

            {staffLoading ? (
              <ActivityIndicator style={styles.loading} color={COLORS.gold} />
            ) : staffError ? (
              <View style={styles.stack}>
                <Banner tone="danger" text={staffError.message} />
                <Button label="Retry" variant="secondary" icon="refresh-cw" onPress={retry} fullWidth testID="staff-retry" />
              </View>
            ) : staff.length === 0 ? (
              <View style={styles.stack}>
                <EmptyState icon="users" title="No staff yet" hint="The owner adds staff and their PINs in the web app." />
                <Button label="Refresh" variant="secondary" icon="refresh-cw" onPress={loadStaff} fullWidth />
              </View>
            ) : (
              <View style={styles.staffGrid}>
                {staff.map((user) => (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => [styles.staffCard, pressed && styles.staffCardPressed]}
                    onPress={() => chooseStaff(user)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in as ${user.name}`}
                    testID={`staff-${user.name}`}
                  >
                    <Avatar name={user.name} />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {user.name}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {roleLabel(user.role)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.column, styles.pinColumn]}>
            <View style={styles.selectedRow}>
              <Avatar name={selected.name} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {selected.name}
                </AppText>
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {roleLabel(selected.role)}
                </AppText>
              </View>
              <Button label="Change" variant="ghost" onPress={backToNames} disabled={submitting} testID="change-staff" />
            </View>

            <AppText variant="body" tone="secondary" style={styles.center}>
              Enter your PIN
            </AppText>
            <View style={styles.dotsRow} accessibilityLabel={`${pin.length} digits entered`}>
              {Array.from({ length: dotCount }).map((_, idx) => (
                <View key={idx} style={[styles.dot, pin.length > idx && styles.dotFilled, !!error && styles.dotError]} />
              ))}
            </View>
            <AppText variant="body" tone="danger" style={[styles.center, styles.error]} accessibilityLiveRegion="polite">
              {error ?? ' '}
            </AppText>

            <View style={styles.keypad}>
              {KEY_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((d) => (
                    <Key key={d} label={d} onPress={() => pressDigit(d)} disabled={submitting}>
                      <AppText variant="display">{d}</AppText>
                    </Key>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <Key label="Clear" onPress={pressClear} disabled={submitting} quiet>
                  <AppText variant="bodyStrong" tone="secondary">
                    Clear
                  </AppText>
                </Key>
                <Key label="0" onPress={() => pressDigit('0')} disabled={submitting}>
                  <AppText variant="display">0</AppText>
                </Key>
                <Key label="Delete" onPress={pressDelete} disabled={submitting} quiet>
                  <Feather name="delete" size={24} color={COLORS.textSecondary} />
                </Key>
              </View>
            </View>

            <Button
              label={cooldown.active ? `Try again in ${cooldown.secondsLeft}s` : 'Unlock'}
              icon={cooldown.active ? undefined : 'unlock'}
              size="lg"
              onPress={submit}
              disabled={!canSubmit}
              loading={submitting}
              fullWidth
              style={styles.unlock}
              testID="unlock"
            />
          </View>
        )}
      </ScrollView>

      <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.deviceName}>
        {device ? device.name : ' '}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: SPACE.xl, paddingTop: SPACE.xxl, paddingBottom: SPACE.lg },
  brand: { marginBottom: SPACE.lg },
  column: { width: '100%', maxWidth: 480, gap: SPACE.md },
  pinColumn: { maxWidth: 360, alignItems: 'center' },
  stack: { gap: SPACE.md },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  loading: { marginTop: SPACE.xxxl },
  staffGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACE.md },
  staffCard: {
    width: '48.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  staffCardPressed: { backgroundColor: COLORS.bgSurface },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.lg,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    paddingVertical: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  dotsRow: { flexDirection: 'row', gap: SPACE.lg },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: COLORS.textMuted },
  dotFilled: { borderColor: COLORS.gold, backgroundColor: COLORS.gold },
  dotError: { borderColor: COLORS.danger },
  error: { minHeight: 21 },
  keypad: { gap: SPACE.md },
  keypadRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACE.xl },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyQuiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyPressed: { backgroundColor: COLORS.borderDefault },
  unlock: { marginTop: SPACE.md, alignSelf: 'stretch' },
  deviceName: { textAlign: 'center', paddingVertical: SPACE.sm, paddingHorizontal: SPACE.lg },
});
