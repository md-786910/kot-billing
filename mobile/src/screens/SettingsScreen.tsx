import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TextInput } from 'react-native';
import { Alert } from '../ui/alert';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE, roleLabel } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { AppText, Banner, Button, Card } from '../ui';

const PIN_PATTERN = /^\d{4,6}$/;
const digitsOnly = (t: string) => t.replace(/\D/g, '').slice(0, 6);

/** Labelled numeric PIN field */
const PinField: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  editable: boolean;
  testID: string;
}> = ({ label, value, onChange, editable, testID }) => (
  <View style={styles.field}>
    <AppText variant="label" tone="secondary">
      {label}
    </AppText>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(t) => onChange(digitsOnly(t))}
      placeholder="••••"
      placeholderTextColor={COLORS.textMuted}
      keyboardType="number-pad"
      maxLength={6}
      secureTextEntry
      editable={editable}
      accessibilityLabel={label}
      testID={testID}
    />
  </View>
);

export const SettingsScreen: React.FC = () => {
  const { currentStaff, device, serverUrl, changeServer, isConnected, pingStats, runPingTest, changePin, lock, unpair } = usePOS();

  // Change PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Server
  const [isTestingPing, setIsTestingPing] = useState(false);

  // Device
  const [isUnpairing, setIsUnpairing] = useState(false);

  const handleChangePin = async () => {
    setPinFeedback(null);
    if (!PIN_PATTERN.test(currentPin)) {
      setPinFeedback({ type: 'error', message: 'Enter your current PIN.' });
      return;
    }
    if (!PIN_PATTERN.test(newPin)) {
      setPinFeedback({ type: 'error', message: 'New PIN must be 4–6 digits.' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinFeedback({ type: 'error', message: "The new PINs don't match." });
      return;
    }
    if (newPin === currentPin) {
      setPinFeedback({ type: 'error', message: 'Choose a PIN different from your current one.' });
      return;
    }

    setIsChangingPin(true);
    const res = await changePin(currentPin, newPin);
    setIsChangingPin(false);
    setCurrentPin('');

    if (res.success) {
      setNewPin('');
      setConfirmPin('');
      setPinFeedback({ type: 'success', message: 'PIN changed. Use it next time you unlock.' });
    } else {
      setPinFeedback({ type: 'error', message: res.error || 'Could not change PIN.' });
    }
  };

  const handlePingTest = async () => {
    setIsTestingPing(true);
    await runPingTest();
    setIsTestingPing(false);
  };

  // The new address is entered on the pairing screen, together with a new pairing code
  const handleChangeServer = () => {
    Alert.alert(
      'Change server address?',
      'This phone will be unpaired and signed out. You will need a new pairing code from Staff & Devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change and unpair', style: 'destructive', onPress: () => void changeServer() },
      ]
    );
  };

  const handleUnpair = () => {
    Alert.alert('Unpair this phone?', 'Nobody can sign in on it until an admin creates a new pairing code in Staff & Devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          setIsUnpairing(true);
          const res = await unpair();
          // On success the app switches to the pairing screen
          if (!res.success) Alert.alert('Unpaired on this phone', res.error || '');
        },
      },
    ]);
  };

  if (!currentStaff) return null;

  const latency = pingStats ? (pingStats.message === 'Connected' ? `${pingStats.latencyMs} ms` : 'No response') : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* Signed-in staff */}
      <Card style={styles.card}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <AppText variant="title" tone="gold">
              {currentStaff.name.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>
              {currentStaff.name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {roleLabel(currentStaff.role)}
            </AppText>
          </View>
        </View>
        <Button label="Lock / switch staff" icon="lock" onPress={() => lock()} fullWidth testID="settings-lock" />
      </Card>

      {/* Change PIN */}
      <Card style={styles.card}>
        <AppText variant="heading">Change PIN</AppText>
        {pinFeedback ? <Banner tone={pinFeedback.type === 'success' ? 'success' : 'danger'} text={pinFeedback.message} /> : null}
        <PinField label="Current PIN" value={currentPin} onChange={setCurrentPin} editable={!isChangingPin} testID="pin-current" />
        <PinField label="New PIN" value={newPin} onChange={setNewPin} editable={!isChangingPin} testID="pin-new" />
        <PinField label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} editable={!isChangingPin} testID="pin-confirm" />
        <Button label="Change PIN" variant="secondary" onPress={handleChangePin} loading={isChangingPin} fullWidth testID="pin-submit" />
      </Card>

      {/* Server */}
      <Card style={styles.card}>
        <AppText variant="heading">Server</AppText>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.success : COLORS.danger }]} />
          <AppText variant="bodyStrong" tone={isConnected ? 'success' : 'danger'}>
            {isConnected ? 'Connected' : 'Offline'}
          </AppText>
          {latency ? (
            <AppText variant="caption" tone="muted" money>
              · {latency}
            </AppText>
          ) : null}
          <View style={styles.flex} />
          <Button label="Test" variant="ghost" onPress={handlePingTest} loading={isTestingPing} testID="server-test" />
        </View>
        <View>
          <AppText variant="label" tone="muted">
            Address
          </AppText>
          <AppText variant="body" tone="secondary" selectable>
            {serverUrl || 'Not set'}
          </AppText>
        </View>
        <Button label="Change server" variant="secondary" onPress={handleChangeServer} fullWidth testID="server-change" />
      </Card>

      {/* This phone */}
      <Card style={styles.card}>
        <AppText variant="heading">This phone</AppText>
        <AppText variant="body" tone="secondary">
          {device?.name ?? 'Unknown device'}
        </AppText>
        <Button
          label="Unpair this phone"
          variant="dangerGhost"
          onPress={handleUnpair}
          loading={isUnpairing}
          fullWidth
          testID="device-unpair"
        />
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  content: { padding: SPACE.lg, paddingBottom: SPACE.xxxl, gap: SPACE.lg },
  card: { gap: SPACE.md },
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: SPACE.xs },
  input: {
    height: TOUCH.min,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACE.md,
    color: COLORS.textPrimary,
    fontSize: TYPE.body.fontSize,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
