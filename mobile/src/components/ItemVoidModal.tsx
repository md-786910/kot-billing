import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { AppText, Button, Card, OptionRow, SectionLabel, Sheet, SheetActions, formatMoney } from '../ui';

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

// `value` is what the server stores (shared with the web POS); `label` is what staff see
const VOID_REASONS = [
  { value: 'Guest Cancelled / Left Early', label: 'Guest cancelled or left' },
  { value: 'Punched by Mistake / Wrong Item', label: 'Entered by mistake' },
  { value: 'Food/Beverage Defective or Cold', label: 'Food or drink not right' },
  { value: 'Item Out of Stock / Kitchen 86', label: 'Out of stock' },
  { value: 'Guest Disliked Taste / Replaced', label: "Guest didn't like it" },
  { value: 'Management Courtesy Discretion', label: 'Manager courtesy' },
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
  const { voidItem, loading, can } = usePOS();
  const [selectedReason, setSelectedReason] = useState<string>(VOID_REASONS[0].value);
  const [pin, setPin] = useState<string>('');

  // Staff without void rights need a manager to approve on this phone
  const needsManagerPin = !can('order.void');

  // A manager's PIN never carries over to the next opening
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    setPin('');
  }

  const close = () => {
    setPin('');
    onClose();
  };

  const handleConfirmVoid = async () => {
    if (itemIndex === null) return;
    if (needsManagerPin && !/^\d{4,6}$/.test(pin)) {
      Alert.alert('Manager PIN required', 'Ask a manager to enter their PIN to approve this void.');
      return;
    }

    const res = await voidItem(orderId, itemIndex, selectedReason, needsManagerPin ? pin : undefined);
    if (res.busy) return; // a second tap while the first is sending
    setPin('');
    if (res.success) {
      Alert.alert('Item voided', `${itemQty}× ${itemName} removed. A void ticket was sent to the station.`);
      if (onSuccess) onSuccess();
      onClose();
    } else if (res.status === 409) {
      Alert.alert('Bill already closed', res.error || 'This bill is already closed.');
      if (onSuccess) onSuccess();
      onClose();
    } else if (res.uncertain) {
      Alert.alert('Not confirmed yet', res.error || 'Check the order before trying again.');
    } else {
      Alert.alert('Void failed', res.error || 'The void was rejected.');
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Void item"
      onClose={close}
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={close} disabled={loading} />
          <Button
            label="Void item"
            variant="danger"
            onPress={handleConfirmVoid}
            loading={loading}
            style={styles.grow}
            testID="confirm-void-item"
          />
        </SheetActions>
      }
    >
      <Card style={styles.summary}>
        <AppText variant="heading" style={styles.grow} numberOfLines={2}>
          {itemQty}× {itemName}
        </AppText>
        <AppText variant="heading" tone="danger" money>
          −{formatMoney(itemPrice * itemQty)}
        </AppText>
      </Card>

      <View style={styles.list} accessibilityRole="radiogroup">
        <SectionLabel style={styles.flushLabel}>Reason</SectionLabel>
        {VOID_REASONS.map((r) => (
          <OptionRow
            key={r.value}
            title={r.label}
            selected={selectedReason === r.value}
            onPress={() => setSelectedReason(r.value)}
          />
        ))}
      </View>

      {needsManagerPin ? (
        <View>
          <SectionLabel>Manager PIN</SectionLabel>
          <TextInput
            style={styles.pinInput}
            placeholder="4–6 digits"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
            accessibilityLabel="Manager PIN"
            testID="void-item-pin"
          />
          <AppText variant="caption" tone="muted" style={styles.hint}>
            A manager must approve this void.
          </AppText>
        </View>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  list: { gap: SPACE.sm },
  flushLabel: { marginBottom: 0 },
  pinInput: {
    minHeight: TOUCH.min,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.bgInput,
    color: COLORS.textPrimary,
    fontSize: TYPE.heading.fontSize,
    letterSpacing: 6,
  },
  hint: { marginTop: SPACE.xs },
});
