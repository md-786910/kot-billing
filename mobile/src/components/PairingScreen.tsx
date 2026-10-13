import React, { useRef, useState } from 'react';
import { StyleSheet, View, TextInput, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { COLORS, RADIUS, SERVER_URL_PLACEHOLDER, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { useCooldown } from '../hooks/useCooldown';
import { AppText, Banner, Button } from '../ui';
import { LogoMark } from './PrivacyCover';

export const PairingScreen: React.FC = () => {
  const { pair, serverUrl, authNotice } = usePOS();
  const [url, setUrl] = useState(serverUrl);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  // Set synchronously: the button and the keyboard's Done key could otherwise both submit the code
  const pairingRef = useRef(false);
  const codeRef = useRef<TextInput>(null);
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
        <View style={styles.column}>
          <View style={styles.intro}>
            <LogoMark />
            <AppText variant="title" style={styles.center}>
              Pair this phone
            </AppText>
            <AppText variant="body" tone="secondary" style={styles.center}>
              In the web app, open Staff & Devices, choose Pair a device, then Waiter phone. Enter the code here.
            </AppText>
          </View>

          {authNotice ? <Banner tone="warning" text={authNotice} /> : null}

          <View style={styles.field}>
            <AppText variant="label" tone="secondary">
              Server address
            </AppText>
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
              onSubmitEditing={() => codeRef.current?.focus()}
              submitBehavior="submit"
              editable={!pairing}
              accessibilityLabel="Server address"
              testID="pair-server"
            />
          </View>

          <View style={styles.field}>
            <AppText variant="label" tone="secondary">
              Pairing code
            </AppText>
            <TextInput
              ref={codeRef}
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
              accessibilityLabel="Pairing code"
              testID="pair-code"
            />
          </View>

          {error ? <Banner tone="danger" text={error} /> : null}

          <Button
            label={cooldown.active ? `Try again in ${cooldown.secondsLeft}s` : 'Pair device'}
            size="lg"
            onPress={handlePair}
            disabled={!canPair}
            loading={pairing}
            fullWidth
            testID="pair-submit"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bgPrimary },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: SPACE.xl },
  column: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: SPACE.lg },
  intro: { alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  center: { textAlign: 'center' },
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
  codeInput: {
    fontSize: TYPE.title.fontSize,
    fontWeight: TYPE.title.fontWeight,
    letterSpacing: SPACE.xs,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
