import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '../../ui/alert';
import { COLORS, RADIUS, SPACE } from '../../constants/theme';
import { usePOS } from '../../context/POSContext';
import { errorMessage } from '../../services/api';
import { createPairingCode, fetchDevices, PairedDevice, revokeDevice, setPrintStation } from '../../services/adminApi';
import { AppText, Badge, Banner, Button, Card, EmptyState, OptionRow, SectionLabel, Sheet, SheetActions } from '../../ui';
import { Field } from './AdminSettingsScreen';

type PairType = 'TERMINAL' | 'MOBILE';

function typeLabel(type: string) {
  return type === 'TERMINAL' ? 'Counter computer' : type === 'MOBILE' ? 'Staff phone' : 'Display';
}

function lastSeenLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Not seen yet';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Last seen yesterday' : `Last seen ${days} days ago`;
}

/** 24-hour hh:mm */
function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function AdminDevicesScreen() {
  const { can, checkAuth } = usePOS();
  const allowed = can('device.manage');

  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices(await fetchDevices());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load devices'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
    else setLoading(false);
  }, [allowed, load]);

  const run = async (device: PairedDevice, action: () => Promise<void>, fallback: string) => {
    setBusyId(device.id);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setActionError(errorMessage(err, fallback));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmPrintStation = (device: PairedDevice) => {
    if (busyId) return;
    Alert.alert(
      `Use ${device.name} for printing?`,
      'This computer will print KOTs, bills and reports for every device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use for printing',
          onPress: async () => {
            if (await run(device, () => setPrintStation(device.id), 'Could not set the print station')) await load();
          },
        },
      ]
    );
  };

  const confirmRevoke = (device: PairedDevice) => {
    if (busyId) return;
    const message = device.isCurrent
      ? 'This is the phone you are using. It will be signed out and return to the pairing screen.'
      : 'Everyone on it is signed out now. It needs a new pairing code to be used again.';
    Alert.alert(`Revoke ${device.name}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          if (!(await run(device, () => revokeDevice(device.id), 'Could not revoke the device'))) return;
          // This phone is no longer paired: the auth check sends the app back to pairing
          if (device.isCurrent) await checkAuth();
          else await load();
        },
      },
    ]);
  };

  if (!allowed) {
    return (
      <View style={styles.container}>
        <EmptyState icon="lock" title="Admins only" hint="Ask the owner to pair or remove devices." />
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

  const hasPrintStation = devices.some((d) => d.printStation);

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
        {!hasPrintStation && !loadError ? (
          <Banner tone="warning" text="No print station yet. Choose the counter computer with the thermal printer." />
        ) : null}

        <Button label="Pair a device" icon="link" fullWidth onPress={() => setPairing(true)} testID="pair-device" />

        {loadError ? <Banner tone="danger" text={loadError} actionLabel="Retry" onAction={() => void load()} /> : null}
        {actionError ? <Banner tone="danger" text={actionError} actionLabel="Dismiss" onAction={() => setActionError(null)} /> : null}

        {devices.length === 0 && !loadError ? <EmptyState icon="monitor" title="No devices paired" /> : null}

        {devices.map((d) => (
          <Card key={d.id} testID={`device-${d.name}`} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardText}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {d.name}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {typeLabel(d.type)}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {d.isCurrent ? 'Using it now' : lastSeenLabel(d.lastSeenAt)}
                </AppText>
              </View>
              <View style={styles.badges}>
                {d.isCurrent ? <Badge label="This phone" fg={COLORS.gold} bg={COLORS.goldSubtle} /> : null}
                {d.printStation ? <Badge label="Prints for everyone" fg={COLORS.info} bg={COLORS.infoBg} /> : null}
              </View>
            </View>
            <View style={styles.actions}>
              {d.type === 'TERMINAL' && !d.printStation ? (
                <Button
                  label="Use for printing"
                  icon="printer"
                  variant="secondary"
                  onPress={() => confirmPrintStation(d)}
                  loading={busyId === d.id}
                  disabled={!!busyId && busyId !== d.id}
                  style={styles.grow}
                  testID={`print-station-${d.name}`}
                />
              ) : null}
              <Button
                label="Revoke"
                variant="dangerGhost"
                onPress={() => confirmRevoke(d)}
                disabled={!!busyId}
                testID={`revoke-${d.name}`}
                accessibilityLabel={`Revoke ${d.name}`}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      <PairSheet visible={pairing} onClose={() => setPairing(false)} onDone={load} />
    </View>
  );
}

function PairSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PairType>('MOBILE');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setType('MOBILE');
      setCode(null);
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const getCode = async () => {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a device name');
    setBusy(true);
    setError(null);
    try {
      setCode(await createPairingCode({ name: trimmed, type }));
    } catch (err) {
      setError(errorMessage(err, 'Could not create a pairing code'));
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    onClose();
    void onDone();
  };

  if (code) {
    const expires = clockTime(code.expiresAt);
    return (
      <Sheet
        visible={visible}
        title="Pairing code"
        subtitle={`${name.trim()} · ${typeLabel(type)}`}
        onClose={finish}
        dismissOnBackdrop={false}
        testID="pair-sheet"
        footer={<Button label="Done" size="lg" fullWidth onPress={finish} testID="pair-done" />}
      >
        <AppText variant="body" tone="secondary">
          {type === 'TERMINAL'
            ? 'On the counter computer, open the POS and enter this code.'
            : 'On the staff phone, open this app and enter this code.'}
        </AppText>
        <View style={styles.codeBox}>
          <AppText variant="display" tone="gold" money selectable style={styles.code} testID="pair-code" accessibilityLabel={`Code ${code.code.split('').join(' ')}`}>
            {code.code}
          </AppText>
          <AppText variant="caption" tone="muted">
            {expires ? `Single use · expires at ${expires}` : 'Single use · expires in 10 minutes'}
          </AppText>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet
      visible={visible}
      title="Pair a device"
      onClose={onClose}
      testID="pair-sheet"
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Get code" onPress={getCode} loading={busy} style={styles.grow} testID="pair-get-code" />
        </SheetActions>
      }
    >
      <Field
        label="Device name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        maxLength={40}
        placeholder={type === 'TERMINAL' ? 'Front counter' : 'Captain phone 1'}
        testID="pair-name-input"
      />
      <View style={styles.group}>
        <SectionLabel>Type</SectionLabel>
        <OptionRow
          title="Staff phone"
          subtitle="Captains and managers taking orders"
          selected={type === 'MOBILE'}
          onPress={() => setType('MOBILE')}
          testID="pair-type-MOBILE"
        />
        <OptionRow
          title="Counter computer"
          subtitle="Billing desk, can print for everyone"
          selected={type === 'TERMINAL'}
          onPress={() => setType('TERMINAL')}
          testID="pair-type-TERMINAL"
        />
      </View>
      {error ? <Banner tone="danger" text={error} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.xxl },
  card: { gap: SPACE.md },
  cardHead: { flexDirection: 'row', gap: SPACE.md },
  cardText: { flex: 1, gap: SPACE.xs },
  badges: { alignItems: 'flex-end', gap: SPACE.xs },
  actions: { flexDirection: 'row', gap: SPACE.sm, justifyContent: 'flex-end' },
  grow: { flex: 1 },
  group: { gap: SPACE.sm },
  codeBox: {
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xxl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.bgCard,
  },
  code: { letterSpacing: SPACE.sm },
});
