import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface VoidOrderModalProps {
  visible: boolean;
  orderId: string;
  tableName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const VOID_REASONS = [
  'Guest Walkout / Left without notice',
  'Accidental Order Creation',
  'Customer Dissatisfaction / Food Returned',
  'VIP Space Booking Cancelled',
  'Manager Special Void',
];

export const VoidOrderModal: React.FC<VoidOrderModalProps> = ({
  visible,
  orderId,
  tableName,
  onClose,
  onSuccess,
}) => {
  const { voidOrder, can, markActivity } = usePOS();
  const [selectedReason, setSelectedReason] = useState<string>(VOID_REASONS[0]);
  const [pin, setPin] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

  // Staff without void rights need a manager to approve on this phone
  const needsManagerPin = !can('order.void');

  const close = () => {
    setPin('');
    onClose();
  };

  const handleExecute = async () => {
    if (needsManagerPin && !/^\d{4,6}$/.test(pin)) {
      Alert.alert('Manager PIN required', 'Ask a manager to enter their PIN to approve this void.');
      return;
    }
    setIsVoiding(true);
    const res = await voidOrder(orderId, tableName, selectedReason, needsManagerPin ? pin : undefined);
    setIsVoiding(false);
    setPin('');

    if (res.success) {
      Alert.alert(
        'Order Voided',
        `Active order for Table ${tableName} has been voided. All kitchen tickets cancelled and table is now VACANT.`
      );
      onSuccess();
      onClose();
    } else if (res.status === 409) {
      Alert.alert('Bill already closed', res.error || 'This bill is already closed.');
      onSuccess();
      onClose();
    } else {
      Alert.alert('Void Failed', res.error || 'Failed to void order.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.modalOverlay} onTouchStart={markActivity}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="cancel" size={22} color="#ef4444" />
              <Text style={styles.modalTitle}>Cancel Order / Walkout</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeBtn} accessibilityLabel="Close">
              <Feather name="x" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Warning: This will cancel all active kitchen and shisha tickets for Table {tableName}, mark the order VOIDED in audit history, and free the table to VACANT.
            </Text>
          </View>

          <Text style={styles.fieldLabel}>Cancellation Reason:</Text>
          <View style={styles.reasonList}>
            {VOID_REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.reasonChip,
                  selectedReason === r && styles.reasonChipActive,
                ]}
                onPress={() => setSelectedReason(r)}
              >
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === r && styles.reasonTextActive,
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {needsManagerPin ? (
            <>
              <Text style={styles.fieldLabel}>Manager PIN (required)</Text>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="Manager PIN"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
              />
            </>
          ) : null}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={close} disabled={isVoiding}>
              <Text style={styles.cancelText}>Keep Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, isVoiding && { opacity: 0.6 }]}
              onPress={handleExecute}
              disabled={isVoiding}
            >
              {isVoiding ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmText}>Confirm Full Void</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 12,
  },
  warningText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  reasonList: {
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    backgroundColor: COLORS.bgSurface,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  reasonChipActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  reasonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  pinInput: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    minHeight: 48,
    color: '#ffffff',
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  closeBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
  },
  cancelBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.bgSurface,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    minHeight: 48,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
