import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../../ui/alert';
import { COLORS, SPACE, roleLabel } from '../../constants/theme';
import { usePOS } from '../../context/POSContext';
import { errorMessage } from '../../services/api';
import { createStaff, fetchStaff, StaffMember, updateStaff } from '../../services/adminApi';
import { UserRole } from '../../types';
import { AppText, Badge, Banner, Button, Card, Divider, EmptyState, OptionRow, SectionLabel, Sheet, SheetActions } from '../../ui';
import { Field } from './AdminSettingsScreen';

const ROLES: { key: UserRole; subtitle: string }[] = [
  { key: 'ADMIN', subtitle: 'Everything, including staff, devices and settings' },
  { key: 'MANAGER', subtitle: 'Voids, discounts, stock and reports' },
  { key: 'CASHIER', subtitle: 'Orders, bills and shifts' },
];

const PIN_PATTERN = /^\d{4,6}$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;

function usesPassword(role: UserRole) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function AdminStaffScreen() {
  const { can, currentStaff } = usePOS();
  const allowed = can('staff.manage');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** null = closed, 'new' = add, otherwise the member being edited */
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchStaff();
      setStaff(list);
      setLoadError(null);
      // Keep an open edit sheet in step with the server (e.g. after Unlock)
      setEditing((e) => (e && e !== 'new' ? list.find((s) => s.id === e.id) ?? null : e));
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load staff'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
    else setLoading(false);
  }, [allowed, load]);

  if (!allowed) {
    return (
      <View style={styles.container}>
        <EmptyState icon="lock" title="Admins only" hint="Ask the owner to add or change staff." />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }
      >
        <Button label="Add staff" icon="user-plus" fullWidth onPress={() => setEditing('new')} testID="add-staff" />
        <AppText variant="caption" tone="muted">
          Everyone signs in with a PIN. Owner and managers can also have a username and password for the web dashboard.
        </AppText>

        {loadError ? <Banner tone="danger" text={loadError} actionLabel="Retry" onAction={() => void load()} /> : null}

        {staff.length === 0 && !loadError ? <EmptyState icon="users" title="No staff yet" hint="Add your first staff member." /> : null}

        {staff.map((s) => (
          <Card
            key={s.id}
            onPress={() => setEditing(s)}
            testID={`staff-${s.name}`}
            accessibilityLabel={`${s.name}, ${roleLabel(s.role)}${s.isLocked ? ', locked' : ''}${s.isActive ? '' : ', inactive'}. Edit`}
            style={styles.card}
          >
            <View style={styles.cardText}>
              <AppText variant="bodyStrong" tone={s.isActive ? 'primary' : 'muted'} numberOfLines={1}>
                {s.name}
                {s.id === currentStaff?.id ? ' (you)' : ''}
              </AppText>
              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                {roleLabel(s.role)}
                {s.username ? ` · @${s.username}` : ''}
              </AppText>
            </View>
            <View style={styles.badges}>
              {s.isLocked ? <Badge label="Locked" fg={COLORS.danger} bg={COLORS.dangerBg} /> : null}
              {!s.isActive ? <Badge label="Inactive" fg={COLORS.textMuted} bg={COLORS.bgSurface} /> : null}
            </View>
          </Card>
        ))}
      </ScrollView>

      <StaffSheet
        member={editing}
        isSelf={editing !== null && editing !== 'new' && editing.id === currentStaff?.id}
        onClose={() => setEditing(null)}
        onChanged={load}
      />
    </View>
  );
}

function StaffSheet({
  member,
  isSelf,
  onClose,
  onChanged,
}: {
  member: StaffMember | 'new' | null;
  isSelf: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const isNew = member === 'new';
  const existing = member && member !== 'new' ? member : null;
  const memberKey = member === 'new' ? 'new' : member?.id ?? null;

  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('CASHIER');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'unlock' | 'active' | null>(null);

  // Reset the form when a different member (or "new") is opened, not when the list reloads
  useEffect(() => {
    if (!memberKey) return;
    setName(existing?.name ?? '');
    setRole(existing?.role ?? 'CASHIER');
    setPhone(existing?.phone ?? '');
    setPin('');
    setUsername(existing?.username ?? '');
    setPassword('');
    setError(null);
    setBusy(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey]);

  const showLogin = usesPassword(role) || !!username || !!existing?.username;
  // The server keeps the current password when only the username changes
  const keepsPassword = !!existing?.hasPassword;

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setError(null);
  };

  const save = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    const user = username.trim().toLowerCase();
    if (!trimmedName) return setError('Enter a name');
    if ((isNew || pin) && !PIN_PATTERN.test(pin)) return setError('PIN must be 4–6 digits');
    if (user && !USERNAME_PATTERN.test(user)) return setError('Username: 3+ letters, numbers, . _ -');
    if (user && password && password.length < 8) return setError('Password must be at least 8 characters');
    if (user && !password && !keepsPassword) return setError('Set a password for this username (8+ characters)');

    setBusy('save');
    setError(null);
    try {
      if (isNew) {
        await createStaff({
          name: trimmedName,
          role,
          phone: phone.trim(),
          pin,
          ...(user ? { username: user, password } : {}),
        });
      } else if (existing) {
        const changes: Parameters<typeof updateStaff>[1] = {};
        if (trimmedName !== existing.name) changes.name = trimmedName;
        if (role !== existing.role) changes.role = role;
        if (phone.trim() !== existing.phone) changes.phone = phone.trim();
        if (pin) changes.pin = pin;
        if (user !== existing.username) changes.username = user;
        if (user && password) changes.password = password;
        if (Object.keys(changes).length > 0) await updateStaff(existing.id, changes);
      }
      await onChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err, isNew ? 'Could not add staff' : 'Could not save changes'));
    } finally {
      setBusy(null);
    }
  };

  const unlock = async () => {
    if (!existing || busy) return;
    setBusy('unlock');
    setError(null);
    try {
      await updateStaff(existing.id, { unlock: true });
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Could not unlock'));
    } finally {
      setBusy(null);
    }
  };

  const setActive = async (isActive: boolean) => {
    if (!existing) return;
    setBusy('active');
    setError(null);
    try {
      await updateStaff(existing.id, { isActive });
      await onChanged();
      if (!isActive) onClose();
    } catch (err) {
      setError(errorMessage(err, isActive ? 'Could not activate' : 'Could not deactivate'));
    } finally {
      setBusy(null);
    }
  };

  const confirmActive = () => {
    if (!existing || busy) return;
    if (existing.isActive) {
      Alert.alert(`Deactivate ${existing.name}?`, 'They are signed out everywhere and cannot sign in until activated again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void setActive(false) },
      ]);
    } else {
      Alert.alert(`Activate ${existing.name}?`, 'They can sign in again with their PIN.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Activate', onPress: () => void setActive(true) },
      ]);
    }
  };

  const roleOptions = existing && !ROLES.some((r) => r.key === existing.role) ? [...ROLES, { key: existing.role, subtitle: 'Current role' }] : ROLES;

  return (
    <Sheet
      visible={member !== null}
      title={isNew ? 'Add staff' : `Edit ${existing?.name ?? ''}`}
      subtitle={existing ? roleLabel(existing.role) : undefined}
      onClose={onClose}
      dismissOnBackdrop={false}
      testID="staff-sheet"
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button
            label={isNew ? 'Add staff' : 'Save'}
            onPress={save}
            loading={busy === 'save'}
            disabled={!!busy && busy !== 'save'}
            style={styles.grow}
            testID="save-staff"
          />
        </SheetActions>
      }
    >
      {existing?.isLocked ? <Banner tone="warning" text="Locked after too many wrong PINs or passwords." /> : null}
      {existing && !existing.isActive ? <Banner tone="info" text="Inactive. This person cannot sign in." /> : null}

      <Field label="Name" value={name} onChangeText={edit(setName)} maxLength={60} autoCapitalize="words" testID="staff-name-input" />

      <View style={styles.group}>
        <SectionLabel>Role</SectionLabel>
        {roleOptions.map((r) => (
          <OptionRow
            key={r.key}
            title={roleLabel(r.key)}
            subtitle={r.subtitle}
            selected={role === r.key}
            onPress={() => edit(setRole)(r.key)}
            testID={`staff-role-${r.key}`}
          />
        ))}
        {isSelf && existing && role !== existing.role ? (
          <AppText variant="caption" tone="warning">
            Changing your own role signs you out.
          </AppText>
        ) : null}
      </View>

      <Field label="Phone" value={phone} onChangeText={edit(setPhone)} keyboardType="phone-pad" maxLength={20} placeholder="Optional" testID="staff-phone-input" />

      <Field
        label={isNew ? 'PIN' : 'New PIN'}
        value={pin}
        onChangeText={(v) => edit(setPin)(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        autoComplete="off"
        hint={isNew ? '4–6 digits. Tell the staff member privately.' : 'Leave empty to keep the current PIN'}
        testID="staff-pin-input"
      />

      {showLogin ? (
        <View style={styles.group}>
          <Divider />
          <AppText variant="caption" tone="muted">
            Password sign-in for the web dashboard and reports. Optional.
          </AppText>
          <Field
            label="Username"
            value={username}
            onChangeText={(v) => edit(setUsername)(v.toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={40}
            hint={existing?.username ? 'Leave empty to remove password sign-in' : 'Letters, numbers, . _ -'}
            testID="staff-username-input"
          />
          {username.trim() ? (
            <Field
              label={keepsPassword ? 'New password' : 'Password'}
              value={password}
              onChangeText={edit(setPassword)}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="newPassword"
              hint={keepsPassword ? 'Leave empty to keep the current password' : 'At least 8 characters'}
              testID="staff-password-input"
            />
          ) : null}
        </View>
      ) : null}

      {error ? <Banner tone="danger" text={error} /> : null}

      {existing ? (
        <View style={styles.group}>
          <Divider />
          {existing.isLocked ? (
            <Button
              label="Unlock"
              icon="unlock"
              variant="secondary"
              onPress={unlock}
              loading={busy === 'unlock'}
              disabled={!!busy && busy !== 'unlock'}
              testID="staff-unlock"
            />
          ) : null}
          {!isSelf ? (
            <Button
              label={existing.isActive ? 'Deactivate' : 'Activate'}
              icon={existing.isActive ? 'user-x' : 'user-check'}
              variant="dangerGhost"
              onPress={confirmActive}
              loading={busy === 'active'}
              disabled={!!busy && busy !== 'active'}
              testID="staff-toggle-active"
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  cardText: { flex: 1, gap: SPACE.xs },
  badges: { alignItems: 'flex-end', gap: SPACE.xs },
  grow: { flex: 1 },
  group: { gap: SPACE.sm },
});
