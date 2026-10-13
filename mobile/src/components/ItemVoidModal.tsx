import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePOS } from '../context/POSContext';

interface ItemVoidModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  itemIndex: number | null;
  itemName: string;
  itemPrice: number;
  itemQty: number;
  onSuccess?: () => void;
}

const VOID_REASONS = [
  'Guest Cancelled / Left Early',
  'Punched by Mistake / Wrong Item',
  'Food/Beverage Defective or Cold',
  'Item Out of Stock / Kitchen 86',
  'Guest Disliked Taste / Replaced',
  'Management Courtesy Discretion',
];

export const ItemVoidModal: React.FC<ItemVoidModalProps> = ({
  visible,
  onClose,
  orderId,
  itemIndex,
  itemName,
  itemPrice,
  itemQty,
  onSuccess,
}) => {
  const { voidItem, loading } = usePOS();
  const [selectedReason, setSelectedReason] = useState<string>(VOID_REASONS[0]);
  const [pin, setPin] = useState<string>('');

  const handleConfirmVoid = async () => {
    if (itemIndex === null) return;
    if (!pin.trim()) {
      Alert.alert('Supervisor PIN Required', 'Please enter supervisor 4-digit PIN (Default: 1111).');
      return;
    }

    const res = await voidItem(orderId, itemIndex, selectedReason, pin.trim());
    if (res.success) {
      Alert.alert('Item Voided', `${itemQty}x ${itemName} voided. Kitchen void ticket dispatched.`);
      setPin('');
      if (onSuccess) onSuccess();
      onClose();
    } else {
      Alert.alert('Void Authorization Failed', res.error || 'Invalid supervisor PIN or action rejected.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark" size={20} color="#f87171" />
              <Text style={styles.modalTitle}>Supervisor Void Item</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Item details */}
          <View style={styles.itemSummaryBox}>
            <Text style={styles.itemSummaryName}>{itemQty}x {itemName}</Text>
            <Text style={styles.itemSummaryPrice}>Deduction: -₹{(itemPrice * itemQty).toFixed(2)}</Text>
          </View>

          <Text style={styles.sectionTitle}>Select Mandatory Void Reason:</Text>
          <ScrollView style={{ maxHeight: 150, marginVertical: 6 }} showsVerticalScrollIndicator={false}>
            {VOID_REASONS.map((r) => {
              const isSelected = selectedReason === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                  onPress={() => setSelectedReason(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>{r}</Text>
                  {isSelected ? (
                    <Ionicons name="radio-button-on" size={16} color="#f87171" />
                  ) : (
                    <Ionicons name="radio-button-off" size={16} color={COLORS.textMuted} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>Supervisor PIN:</Text>
              <Text style={styles.pinHint}>Default: 1111</Text>
            </View>
            <TextInput
              style={styles.pinInput}
              placeholder="Enter 4-digit PIN"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={pin}
              onChangeText={setPin}
            />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmVoidBtn}
              disabled={loading}
              onPress={handleConfirmVoid}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.confirmVoidBtnText}>Authorize Void</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  itemSummaryBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 10,
  },
  itemSummaryName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  itemSummaryPrice: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pinHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  reasonOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgSurface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    marginBottom: 6,
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  reasonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  reasonTextSelected: {
    color: '#fca5a5',
    fontWeight: '700',
  },
  pinInput: {
    backgroundColor: COLORS.bgPrimary,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    marginTop: 4,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.bgSurface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmVoidBtn: {
    flex: 2,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmVoidBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
