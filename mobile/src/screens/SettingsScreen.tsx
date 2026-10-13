import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, roleLabel, SERVER_URL_PLACEHOLDER } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { normalizeServerUrl } from '../services/api';

const PIN_PATTERN = /^\d{4,6}$/;
const digitsOnly = (t: string) => t.replace(/\D/g, '').slice(0, 6);

export const SettingsScreen: React.FC = () => {
  const {
    currentStaff,
    device,
    serverUrl,
    changeServer,
    isConnected,
    pingStats,
    runPingTest,
    changePin,
    lock,
    unpair,
  } = usePOS();

  // Change PIN
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Server
  const [urlInput, setUrlInput] = useState(serverUrl);
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

  const handleSaveServer = () => {
    const next = normalizeServerUrl(urlInput);
    if (!next) {
      Alert.alert('Server address', 'Enter the server address.');
      return;
    }
    if (next === serverUrl) {
      setUrlInput(next);
      return;
    }
    Alert.alert(
      'Change server address?',
      'This phone will be unpaired and signed out. You will need a new pairing code from Admin → Devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change and unpair', style: 'destructive', onPress: () => void changeServer(next) },
      ]
    );
  };

  const handleUnpair = () => {
    Alert.alert(
      'Unpair this phone?',
      'Nobody can sign in on it until an admin creates a new pairing code in Admin → Devices.',
      [
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
      ]
    );
  };

  if (!currentStaff) return null;

  const urlChanged = normalizeServerUrl(urlInput) !== serverUrl;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Signed-in staff */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{currentStaff.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName} numberOfLines={1}>
              {currentStaff.name}
            </Text>
            <Text style={styles.staffMeta}>{roleLabel(currentStaff.role)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => lock()} accessibilityRole="button">
          <Feather name="lock" size={18} color="#ffffff" />
          <Text style={styles.primaryBtnText}>Lock / Switch staff</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>The next person picks their name and enters their own PIN.</Text>
      </View>

      {/* Change PIN */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="shield-key-outline" size={20} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Change PIN</Text>
        </View>

        {pinFeedback && (
          <View style={[styles.feedbackBanner, pinFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
            <Feather
              name={pinFeedback.type === 'success' ? 'check-circle' : 'alert-circle'}
              size={16}
              color={pinFeedback.type === 'success' ? '#34d399' : '#f87171'}
            />
            <Text style={[styles.feedbackText, { color: pinFeedback.type === 'success' ? '#34d399' : '#f87171' }]}>
              {pinFeedback.message}
            </Text>
          </View>
        )}

        <Text style={styles.inputLabel}>Current PIN</Text>
        <TextInput
          style={styles.pinInput}
          value={currentPin}
          onChangeText={(t) => setCurrentPin(digitsOnly(t))}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry
          editable={!isChangingPin}
        />

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>New PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={newPin}
              onChangeText={(t) => setNewPin(digitsOnly(t))}
              placeholder="4–6 digits"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              editable={!isChangingPin}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Confirm new PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={confirmPin}
              onChangeText={(t) => setConfirmPin(digitsOnly(t))}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              editable={!isChangingPin}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, isChangingPin && styles.btnDisabled]}
          onPress={handleChangePin}
          disabled={isChangingPin}
        >
          {isChangingPin ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryBtnText}>Change PIN</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Server */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="server-outline" size={18} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Server</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? COLORS.vacant : COLORS.occupied }]} />
            <Text style={styles.statusLabel}>{isConnected ? 'Connected' : 'Offline'}</Text>
          </View>
          {pingStats ? (
            <Text style={styles.pingText}>
              {pingStats.message === 'Connected' ? `${pingStats.latencyMs} ms` : 'No response'}
            </Text>
          ) : null}
        </View>

        <Text style={styles.inputLabel}>Server address</Text>
        <TextInput
          style={styles.textInput}
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder={SERVER_URL_PLACEHOLDER}
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handlePingTest} disabled={isTestingPing}>
            {isTestingPing ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <Text style={styles.secondaryBtnText}>Test</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { flex: 1 }, !urlChanged && styles.btnDisabled]}
            onPress={handleSaveServer}
            disabled={!urlChanged}
          >
            <Text style={styles.secondaryBtnText}>Change server</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Changing the address unpairs this phone; pair it again with a new code.</Text>
      </View>

      {/* This device */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.gold} />
          <Text style={styles.cardTitle}>This device</Text>
        </View>
        <Text style={styles.deviceName}>{device?.name ?? 'Unknown device'}</Text>

        <TouchableOpacity
          style={[styles.dangerBtn, isUnpairing && styles.btnDisabled]}
          onPress={handleUnpair}
          disabled={isUnpairing}
        >
          {isUnpairing ? (
            <ActivityIndicator size="small" color="#f87171" />
          ) : (
            <Text style={styles.dangerBtnText}>Unpair this device</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>Layali POS Mobile</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.goldSubtle,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: '800',
  },
  staffName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  staffMeta: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  hint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  pinInput: {
    minHeight: 48,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  textInput: {
    minHeight: 48,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginBottom: 12,
  },
  primaryBtn: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    minHeight: 48,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSurface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  pingText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  deviceName: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginBottom: 14,
  },
  dangerBtn: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  dangerBtnText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
