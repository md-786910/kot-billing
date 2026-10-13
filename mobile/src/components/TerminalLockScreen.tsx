import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

export const TerminalLockScreen: React.FC = () => {
  const { unlockTerminal, currentStaff } = usePOS();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 4) {
        attemptUnlock(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const attemptUnlock = async (pinToTry: string) => {
    setLoading(true);
    setError(null);
    const res = await unlockTerminal(pinToTry);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid Staff PIN');
      setPin('');
    }
  };

  const quickPresets = [
    { label: 'Admin (1111)', pin: '1111' },
    { label: 'Cashier (2222)', pin: '2222' },
    { label: 'Captain (3333)', pin: '3333' },
    { label: 'Chef (4444)', pin: '4444' },
    { label: 'Shisha (5555)', pin: '5555' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.lockCard}>
        {/* Brand Icon */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="fire" size={32} color={COLORS.gold} />
        </View>

        <Text style={styles.brandTitle}>LAYALI POS MOBILE</Text>
        <Text style={styles.lockSubtitle}>Terminal Locked • Enter Staff PIN</Text>

        {/* Current staff pill */}
        <View style={styles.staffPill}>
          <Text style={styles.staffPillText}>Active User: {currentStaff.name}</Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                pin.length > idx && styles.dotFilled,
                error && styles.dotError,
              ]}
            />
          ))}
        </View>

        {/* Error message */}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Number Keypad */}
        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={styles.keyBtn}
                  onPress={() => handleDigit(d)}
                  disabled={loading}
                >
                  <Text style={styles.keyDigit}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.keypadRow}>
            <TouchableOpacity style={styles.keyBtnAux} onPress={handleClear} disabled={loading}>
              <Text style={styles.keyAuxText}>CLR</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keyBtn} onPress={() => handleDigit('0')} disabled={loading}>
              <Text style={styles.keyDigit}>0</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keyBtnAux} onPress={handleDelete} disabled={loading}>
              <Feather name="delete" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Role Shortcuts */}
        <Text style={styles.presetHeading}>Quick Role Switch:</Text>
        <View style={styles.presetsGrid}>
          {quickPresets.map((p) => (
            <TouchableOpacity
              key={p.pin}
              style={styles.presetChip}
              onPress={() => {
                setPin(p.pin);
                attemptUnlock(p.pin);
              }}
              disabled={loading}
            >
              <Text style={styles.presetText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.loadingText}>Verifying Credentials...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  lockSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  staffPill: {
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    marginBottom: 16,
  },
  staffPillText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.gold,
  },
  dotError: {
    borderColor: '#ef4444',
    backgroundColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  keypad: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  keyBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  keyBtnAux: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyAuxText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  presetHeading: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  presetText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '600',
  },
});
