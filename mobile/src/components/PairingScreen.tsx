import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS, SERVER_URL_PLACEHOLDER } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { useCooldown } from '../hooks/useCooldown';

export const PairingScreen: React.FC = () => {
  const { pair, serverUrl, authNotice } = usePOS();
  const [url, setUrl] = useState(serverUrl);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  // Set synchronously: the button and the keyboard's Done key could otherwise both submit the code
  const pairingRef = useRef(false);
  const cooldown = useCooldown();

  const canPair = url.trim().length > 0 && code.length === 6 && !pairing && !cooldown.active;

  const handlePair = async () => {
    if (!canPair || pairingRef.current) return;
    pairingRef.current = true;
    setPairing(true);
    setError(null);
    const res = await pair(url, code);
    // On success the app moves on to the lock screen and this unmounts
    if (!res.success) {
      pairingRef.current = false;
      setPairing(false);
      setError(res.error || 'Pairing failed');
      if (res.status === 401) setCode('');
      // Retrying while rate limited only extends the server's wait
      if (res.status === 429) cooldown.start();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="cellphone-link" size={28} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>Pair this phone</Text>
          <Text style={styles.subtitle}>
            On the web app, open Staff & Devices, choose Pair a device → Waiter phone, and enter it here.
          </Text>

          {authNotice ? <Text style={styles.notice}>{authNotice}</Text> : null}

          <Text style={styles.label}>Server address</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              setError(null);
            }}
            placeholder={SERVER_URL_PLACEHOLDER}
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="next"
            editable={!pairing}
          />

          <Text style={styles.label}>Pairing code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(t) => {
              setCode(t.replace(/\D/g, '').slice(0, 6));
              setError(null);
            }}
            placeholder="000000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handlePair}
            editable={!pairing}
          />

          {error ? (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={16} color="#f87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.pairBtn, !canPair && styles.pairBtnDisabled]}
            onPress={handlePair}
            disabled={!canPair}
            accessibilityRole="button"
          >
            {pairing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : cooldown.active ? (
              <Text style={styles.pairBtnText}>Try again in {cooldown.secondsLeft}s</Text>
            ) : (
              <Text style={styles.pairBtnText}>Pair device</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 20,
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
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  notice: {
    color: COLORS.gold,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: COLORS.goldSubtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 14,
    color: COLORS.textPrimary,
    fontSize: 16,
    marginBottom: 16,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: '#f87171',
    fontSize: 14,
  },
  pairBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairBtnDisabled: {
    opacity: 0.4,
  },
  pairBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
