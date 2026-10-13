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

interface ReviewKOTModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_NOTES = [
  '🌶️ Less Spicy',
  '🍟 Extra Crispy',
  '🧊 Cold Ice',
  '🔥 Double Coal',
  '💧 Mineral Base',
  '🧄 No Onion/Garlic',
  '🍃 Paan+Mint Mix',
  '🍋 Extra Lemon',
];

export const ReviewKOTModal: React.FC<ReviewKOTModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const {
    selectedTable,
    cart,
    cartTotal,
    hasShishaInCart,
    punchKOT,
    loading,
    markActivity,
  } = usePOS();

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [shishaDuration, setShishaDuration] = useState(45);
  const [shishaAdvance, setShishaAdvance] = useState('0');

  const handleSubmit = async () => {
    const res = await punchKOT({
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      notes: notes.trim(),
      shishaAdvance: Number(shishaAdvance || 0),
      duration: hasShishaInCart ? shishaDuration : undefined,
    });

    if (res.success) {
      Alert.alert('Success', `KOT sent to kitchen for ${selectedTable}`);
      setNotes('');
      setGuestName('');
      setGuestPhone('');
      onSuccess();
    } else {
      Alert.alert('Error', res.error || 'Failed to dispatch KOT');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay} onTouchStart={markActivity}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review KOT · {selectedTable}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
            {cart.map((it) => (
              <View key={it.id} style={styles.reviewItemRow}>
                <Text style={styles.reviewItemQty}>{it.qty}x</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewItemName}>{it.name}</Text>
                  <Text style={styles.reviewItemStation}>{it.station}</Text>
                </View>
                <Text style={styles.reviewItemPrice}>₹{(it.price * it.qty).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
          >
            {QUICK_NOTES.map((chip) => (
              <TouchableOpacity
                key={chip}
                style={styles.chipBtn}
                onPress={() => {
                  setNotes((prev) => (prev.trim() ? `${prev}, ${chip}` : chip));
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.chipBtnText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput
            style={styles.notesInput}
            placeholder="Kitchen notes (e.g., Less spicy, Paan mix)..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
          />

          {hasShishaInCart && (
            <View style={styles.shishaOptionsRow}>
              <Text style={styles.shishaOptionsLabel}>Shisha Duration:</Text>
              {[30, 45, 60].map((dur) => (
                <TouchableOpacity
                  key={dur}
                  style={[styles.durBtn, shishaDuration === dur && styles.durBtnActive]}
                  onPress={() => setShishaDuration(dur)}
                >
                  <Text
                    style={[
                      styles.durBtnText,
                      shishaDuration === dur && styles.durBtnTextActive,
                    ]}
                  >
                    {dur}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.modalSummaryRow}>
            <Text style={styles.modalTotalLabel}>Order Subtotal:</Text>
            <Text style={styles.modalTotalVal}>₹{cartTotal.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={styles.dispatchKOTBtn}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.dispatchKOTBtnText}>PUNCH KOT TO KITCHEN</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 16,
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    paddingBottom: 10,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  reviewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  reviewItemQty: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewItemName: {
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  reviewItemStation: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  reviewItemPrice: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    fontSize: 12,
    marginTop: 8,
  },
  shishaOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  shishaOptionsLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  durBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  durBtnActive: {
    backgroundColor: COLORS.gold,
  },
  durBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  durBtnTextActive: {
    color: '#000000',
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 10,
  },
  modalTotalLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalTotalVal: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  dispatchKOTBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  dispatchKOTBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipBtn: {
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  chipBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
});
