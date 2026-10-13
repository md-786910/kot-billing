import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { StaffUser } from '../types';

export const SettingsScreen: React.FC = () => {
  const {
    currentStaff,
    setCurrentStaff,
    staffUsers,
    serverUrl,
    updateServerUrl,
    isConnected,
    pingStats,
    runPingTest,
    changePin,
    refreshData,
    tables,
    menu,
    kots,
    lockTerminal,
  } = usePOS();

  // Reset PIN Form State
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Server Config State
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl);
  const [isTestingPing, setIsTestingPing] = useState(false);

  // Switch Staff Modal
  const [isSwitchStaffOpen, setIsSwitchStaffOpen] = useState(false);

  // App Preferences
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<'5s' | '10s' | '30s'>('10s');

  const handleUpdatePin = async () => {
    setPinFeedback(null);
    if (!currentPin) {
      setPinFeedback({ type: 'error', message: 'Please enter your current 4-digit PIN.' });
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setPinFeedback({ type: 'error', message: 'New PIN must be exactly 4 digits (e.g. 1234).' });
      return;
    }
    if (newPin !== confirmPin) {
      setPinFeedback({ type: 'error', message: 'New PIN and Confirmation PIN do not match.' });
      return;
    }

    setIsChangingPin(true);
    const res = await changePin(currentPin, newPin);
    setIsChangingPin(false);

    if (res.success) {
      setPinFeedback({ type: 'success', message: res.message || 'Staff PIN updated successfully!' });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setPinFeedback({ type: 'error', message: res.error || 'Failed to update PIN.' });
    }
  };

  const handleSaveServerUrl = async () => {
    updateServerUrl(customServerUrl);
    await refreshData();
    await runPingTest();
    Alert.alert('Server Config Saved', `Connected to: ${customServerUrl}`);
  };

  const handlePingTest = async () => {
    setIsTestingPing(true);
    await runPingTest();
    setIsTestingPing(false);
  };

  const handleSelectStaff = (staff: StaffUser) => {
    setCurrentStaff(staff);
    setIsSwitchStaffOpen(false);
    Alert.alert('Staff Switched', `Active terminal staff is now ${staff.name} (${staff.role})`);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '#f59e0b';
      case 'MANAGER':
        return '#3b82f6';
      case 'CASHIER':
        return '#10b981';
      case 'CAPTAIN':
        return COLORS.gold;
      case 'KITCHEN_CHEF':
        return '#ef4444';
      case 'SHISHA_MASTER':
        return '#ec4899';
      default:
        return COLORS.textMuted;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. STAFF IDENTITY CARD */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account-tie" size={36} color={COLORS.gold} />
            <View style={styles.activeDot} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.staffName}>{currentStaff.name}</Text>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${getRoleBadgeColor(currentStaff.role)}22`, borderColor: getRoleBadgeColor(currentStaff.role) },
                ]}
              >
                <Text style={[styles.roleText, { color: getRoleBadgeColor(currentStaff.role) }]}>
                  {currentStaff.role}
                </Text>
              </View>
            </View>
            <Text style={styles.staffMeta}>ID: #{currentStaff.id.slice(-6).toUpperCase()} • Phone: {currentStaff.phone || '9876543212'}</Text>
            <Text style={styles.staffStatus}>● Active on Duty • Floor Lounge</Text>
          </View>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity
            style={styles.switchStaffBtn}
            onPress={() => setIsSwitchStaffOpen(true)}
          >
            <MaterialCommunityIcons name="account-switch" size={16} color="#ffffff" />
            <Text style={styles.switchStaffText}>Switch Staff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lockBtn}
            onPress={lockTerminal}
          >
            <Feather name="lock" size={15} color="#fca5a5" />
            <Text style={styles.lockText}>Lock Terminal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. RESET STAFF PIN / PASSWORD SECTION */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="shield-key" size={20} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Reset Staff PIN / Password</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Update your rapid 4-digit security PIN used for punching orders, kitchen voids, and station logins.
        </Text>

        {pinFeedback && (
          <View
            style={[
              styles.feedbackBanner,
              pinFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            <MaterialCommunityIcons
              name={pinFeedback.type === 'success' ? 'check-circle' : 'alert-circle'}
              size={18}
              color={pinFeedback.type === 'success' ? '#10b981' : '#ef4444'}
            />
            <Text
              style={[
                styles.feedbackText,
                { color: pinFeedback.type === 'success' ? '#34d399' : '#f87171' },
              ]}
            >
              {pinFeedback.message}
            </Text>
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Current 4-Digit PIN</Text>
          <TextInput
            style={styles.pinInput}
            value={currentPin}
            onChangeText={setCurrentPin}
            placeholder="e.g. 3333"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
          />
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>New 4-Digit PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="e.g. 5678"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>

          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Confirm New PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="e.g. 5678"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.savePinBtn, isChangingPin && { opacity: 0.7 }]}
          onPress={handleUpdatePin}
          disabled={isChangingPin}
        >
          {isChangingPin ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save-check" size={18} color="#ffffff" />
              <Text style={styles.savePinText}>Update Security PIN</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. SERVER & NETWORK DIAGNOSTIC HUB */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="server" size={18} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Backend Server & Network Diagnostic</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Configure your Next.js Mongoose backend address and verify live latency ping over Wi-Fi.
        </Text>

        {/* Status banner */}
        <View style={styles.statusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={[
                styles.dotLarge,
                { backgroundColor: isConnected ? COLORS.vacant : COLORS.occupied },
              ]}
            />
            <Text style={styles.statusLabel}>
              {isConnected ? 'Server Connected' : 'Server Offline'}
            </Text>
          </View>

          <View style={styles.pingBadge}>
            <Feather name="activity" size={12} color={COLORS.gold} />
            <Text style={styles.pingText}>
              {pingStats ? `${pingStats.latencyMs}ms` : 'Ping: N/A'}
            </Text>
          </View>
        </View>

        {/* Server input */}
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>Server Base URL</Text>
          <TextInput
            style={styles.textInput}
            value={customServerUrl}
            onChangeText={setCustomServerUrl}
            placeholder="http://10.180.104.168:3001"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
        </View>

        {/* Quick Presets */}
        <Text style={styles.inputLabel}>Quick Wi-Fi Presets:</Text>
        <View style={styles.presetRow}>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setCustomServerUrl('http://10.180.104.168:3001')}
          >
            <Text style={styles.presetText}>LAN: 10.180.104.168:3001</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setCustomServerUrl('http://localhost:3001')}
          >
            <Text style={styles.presetText}>Localhost: 3001</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.serverActions}>
          <TouchableOpacity
            style={styles.pingBtn}
            onPress={handlePingTest}
            disabled={isTestingPing}
          >
            {isTestingPing ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color={COLORS.gold} />
                <Text style={styles.pingBtnText}>Test Latency</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveServerBtn} onPress={handleSaveServerUrl}>
            <Feather name="check" size={15} color="#ffffff" />
            <Text style={styles.saveServerText}>Save & Reconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. RESTAURANT & LOUNGE OPERATIONAL INFO */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <MaterialCommunityIcons name="storefront" size={20} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Restaurant & Lounge Overview</Text>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>Brand</Text>
            <Text style={styles.infoVal}>Layali Lounge & Cafe</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>GSTIN / Tax ID</Text>
            <Text style={styles.infoVal}>07AAAAA0000A1Z5</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>Tax Rate</Text>
            <Text style={styles.infoVal}>5% GST (2.5% C + 2.5% S)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>Active Tables</Text>
            <Text style={styles.infoVal}>{tables.length} Total Floors</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>Menu Catalog</Text>
            <Text style={styles.infoVal}>{menu.length} Live Items</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoKey}>Active KOTs</Text>
            <Text style={styles.infoVal}>
              {kots.filter((k) => k.status !== 'SERVED').length} Preparing
            </Text>
          </View>
        </View>
      </View>

      {/* 5. APP PREFERENCES & TOGGLES */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="options-outline" size={20} color={COLORS.gold} />
          <Text style={styles.cardTitle}>Terminal & Audio Preferences</Text>
        </View>

        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefTitle}>Haptic Feedback on Punch</Text>
            <Text style={styles.prefSubtitle}>Vibrate device when adding items or modifying cart</Text>
          </View>
          <Switch
            value={hapticEnabled}
            onValueChange={setHapticEnabled}
            trackColor={{ false: '#334155', true: COLORS.gold }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefTitle}>Kitchen Ready Audio Chime</Text>
            <Text style={styles.prefSubtitle}>Sound bell when kitchen or bar ticket is marked ready</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#334155', true: COLORS.kitchen }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={[styles.prefRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefTitle}>Auto-Sync Interval</Text>
            <Text style={styles.prefSubtitle}>Frequency of background table and KOT updates</Text>
          </View>
          <View style={styles.intervalGroup}>
            {(['5s', '10s', '30s'] as const).map((inv) => (
              <TouchableOpacity
                key={inv}
                style={[
                  styles.intervalBtn,
                  autoRefreshInterval === inv && styles.intervalBtnActive,
                ]}
                onPress={() => setAutoRefreshInterval(inv)}
              >
                <Text
                  style={[
                    styles.intervalText,
                    autoRefreshInterval === inv && styles.intervalTextActive,
                  ]}
                >
                  {inv}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* FOOTER BUILD INFO */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Layali POS Mobile • Build 2026.10 • Turbopack Engine</Text>
        <Text style={styles.footerSubText}>MongoDB Atlas Live Synchronized • Expo SDK 57</Text>
      </View>

      {/* SWITCH STAFF MODAL */}
      <Modal visible={isSwitchStaffOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="account-switch" size={22} color={COLORS.gold} />
                <Text style={styles.modalTitle}>Select Active Staff</Text>
              </View>
              <TouchableOpacity onPress={() => setIsSwitchStaffOpen(false)}>
                <Feather name="x" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Tap an authorized staff member to switch active waiter/terminal credentials:
            </Text>

            <View style={styles.staffList}>
              {staffUsers.length > 0 ? (
                staffUsers.map((staff) => (
                  <TouchableOpacity
                    key={staff.id}
                    style={[
                      styles.staffItem,
                      currentStaff.name === staff.name && styles.staffItemActive,
                    ]}
                    onPress={() => handleSelectStaff(staff)}
                  >
                    <View style={styles.staffAvatar}>
                      <Text style={styles.staffInitial}>{staff.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffItemName}>{staff.name}</Text>
                      <Text style={styles.staffItemRole}>{staff.role}</Text>
                    </View>
                    {currentStaff.name === staff.name && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.gold} />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>Loading staff accounts...</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setIsSwitchStaffOpen(false)}
            >
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  },
  avatarContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.vacant,
    borderWidth: 2,
    borderColor: COLORS.bgCard,
  },
  staffName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  staffMeta: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  staffStatus: {
    color: COLORS.vacant,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  switchStaffBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingVertical: 10,
    borderRadius: 10,
  },
  switchStaffText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  lockText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  pinInput: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    letterSpacing: 4,
    fontWeight: '700',
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  savePinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  savePinText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSurface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  dotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pingText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  serverActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pingBtnText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  saveServerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.kitchen,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveServerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  infoItem: {
    width: '48%',
    backgroundColor: COLORS.bgSurface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  infoKey: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  infoVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  prefTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  prefSubtitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  intervalGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  intervalBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  intervalBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  intervalText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  intervalTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  footerSubText: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 14,
  },
  staffList: {
    gap: 8,
    marginBottom: 14,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSurface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  staffItemActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  staffAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInitial: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  staffItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  staffItemRole: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 10,
  },
  closeModalBtn: {
    backgroundColor: COLORS.bgSurface,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  closeModalText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
