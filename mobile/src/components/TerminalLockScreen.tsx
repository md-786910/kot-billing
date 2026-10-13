import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { errorMessage, errorStatus, fetchSignInStaff } from '../services/api';
import { StaffUser } from '../types';

const MIN_PIN = 4;
const MAX_PIN = 6;
const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export const TerminalLockScreen: React.FC = () => {
  const { signIn, checkAuth, device, authNotice } = usePOS();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      setStaff(await fetchSignInStaff());
    } catch (err) {
      setStaffError(errorMessage(err, 'Could not load staff'));
      // Device token rejected: let the app decide whether to show pairing
      if (errorStatus(err) === 401) void checkAuth();
    } finally {
      setStaffLoading(false);
    }
  }, [checkAuth]);

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
    if (!selected || pin.length < MIN_PIN || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await signIn(selected.id, pin);
    // On success this screen unmounts
    if (!res.success) {
      setSubmitting(false);
      setPin('');
      setError(res.error || 'Incorrect PIN');
    }
  };

  const canSubmit = !!selected && pin.length >= MIN_PIN && !submitting;
  const dotCount = Math.max(MIN_PIN, pin.length);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="fire" size={28} color={COLORS.gold} />
          </View>
          <Text style={styles.brandTitle}>LAYALI</Text>
        </View>

        {!selected ? (
          <>
            <Text style={styles.heading}>Who's signing in?</Text>
            {authNotice && !staffError ? <Text style={styles.notice}>{authNotice}</Text> : null}

            {staffLoading ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.gold} />
            ) : staffError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{staffError}</Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={retry}>
                  <Feather name="refresh-cw" size={16} color={COLORS.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : staff.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.emptyText}>
                  No staff can sign in yet. The owner adds staff and their PINs in the web app.
                </Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={loadStaff}>
                  <Feather name="refresh-cw" size={16} color={COLORS.textPrimary} />
                  <Text style={styles.secondaryBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.staffGrid}>
                {staff.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.staffTile}
                    onPress={() => chooseStaff(user)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in as ${user.name}`}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Text style={styles.staffRole} numberOfLines={1}>
                        {roleLabel(user.role)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.pinArea}>
            <View style={styles.selectedRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{selected.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {selected.name}
                </Text>
                <Text style={styles.staffRole}>{roleLabel(selected.role)}</Text>
              </View>
              <TouchableOpacity style={styles.changeBtn} onPress={backToNames} disabled={submitting}>
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.pinLabel}>Enter your PIN</Text>
            <View style={styles.dotsRow} accessibilityLabel={`${pin.length} digits entered`}>
              {Array.from({ length: dotCount }).map((_, idx) => (
                <View
                  key={idx}
                  style={[styles.dot, pin.length > idx && styles.dotFilled, !!error && styles.dotError]}
                />
              ))}
            </View>
            <Text style={styles.errorText}>{error ?? ' '}</Text>

            <View style={styles.keypad}>
              {KEY_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={styles.keyBtn}
                      onPress={() => pressDigit(d)}
                      disabled={submitting}
                      accessibilityLabel={d}
                    >
                      <Text style={styles.keyDigit}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              <View style={styles.keypadRow}>
                <TouchableOpacity
                  style={styles.keyBtnAux}
                  onPress={pressClear}
                  disabled={submitting}
                  accessibilityLabel="Clear"
                >
                  <Text style={styles.keyAuxText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keyBtn}
                  onPress={() => pressDigit('0')}
                  disabled={submitting}
                  accessibilityLabel="0"
                >
                  <Text style={styles.keyDigit}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.keyBtnAux}
                  onPress={pressDelete}
                  disabled={submitting}
                  accessibilityLabel="Delete"
                >
                  <Feather name="delete" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.unlockBtn, !canSubmit && styles.unlockBtnDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="unlock" size={18} color="#ffffff" />
                  <Text style={styles.unlockText}>Unlock</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Text style={styles.deviceName} numberOfLines={1}>
        {device ? device.name : ' '}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  notice: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  staffGrid: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 8,
  },
  staffTile: {
    width: '48.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.goldSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: '800',
  },
  staffName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  staffRole: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  errorBoxText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  secondaryBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  secondaryBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  pinArea: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  selectedRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 14,
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 20,
  },
  changeBtn: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBtnText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  pinLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
  },
  dotFilled: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold,
  },
  dotError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  keypad: {
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  keyBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '600',
  },
  keyBtnAux: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyAuxText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  unlockBtn: {
    width: '100%',
    minHeight: 52,
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlockBtnDisabled: {
    opacity: 0.4,
  },
  unlockText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  deviceName: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
