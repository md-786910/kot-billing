import React, { useState } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';
import { Alert } from '../ui/alert';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { AppText, Banner, Button, OptionRow, SectionLabel, Sheet, SheetActions } from '../ui';

interface VoidOrderModalProps {
  visible: boolean;
  orderId: string;
  tableName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// `value` is what the server stores; `label` is what staff see
const VOID_REASONS = [
  { value: 'Guest Walkout / Left without notice', label: 'Guest walked out' },
  { value: 'Accidental Order Creation', label: 'Opened by mistake' },
  { value: 'Customer Dissatisfaction / Food Returned', label: 'Guest unhappy, food returned' },
  { value: 'VIP Space Booking Cancelled', label: 'Booking cancelled' },
  { value: 'Manager Special Void', label: 'Manager decision' },
];

export const VoidOrderModal: React.FC<VoidOrderModalProps> = ({
  visible,
  orderId,
  tableName,
  onClose,
  onSuccess,
}) => {
  const { voidOrder, can } = usePOS();
  const [selectedReason, setSelectedReason] = useState<string>(VOID_REASONS[0].value);
  const [pin, setPin] = useState<string>('');
  const [isVoiding, setIsVoiding] = useState<boolean>(false);

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

  const handleExecute = async () => {
    if (needsManagerPin && !/^\d{4,6}$/.test(pin)) {
      Alert.alert('Manager PIN required', 'Ask a manager to enter their PIN to approve this void.');
      return;
    }
    setIsVoiding(true);
    const res = await voidOrder(orderId, tableName, selectedReason, needsManagerPin ? pin : undefined);
    setIsVoiding(false);
    if (res.busy) return; // another action is still sending
    setPin('');

    if (res.success) {
      Alert.alert('Order cancelled', `${tableName} is free and its open tickets are cancelled.`);
      onSuccess();
      onClose();
    } else if (res.status === 409) {
      Alert.alert('Bill already closed', res.error || 'This bill is already closed.');
      onSuccess();
      onClose();
    } else if (res.uncertain) {
      Alert.alert('Not confirmed yet', res.error || 'Check the table before trying again.');
    } else {
      Alert.alert("Couldn't cancel order", res.error || 'Failed to void order.');
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Cancel whole order"
      subtitle={tableName}
      onClose={close}
      footer={
        <SheetActions>
          <Button label="Keep order" variant="secondary" onPress={close} disabled={isVoiding} />
          <Button
            label="Cancel order"
            variant="danger"
            onPress={handleExecute}
            loading={isVoiding}
            style={styles.grow}
            testID="confirm-void-order"
          />
        </SheetActions>
      }
    >
      <Banner tone="warning" text={`All open tickets for ${tableName} are cancelled and the table is freed.`} />

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
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="4–6 digits"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            accessibilityLabel="Manager PIN"
            testID="void-order-pin"
          />
          <AppText variant="caption" tone="muted" style={styles.hint}>
            A manager must approve this cancellation.
          </AppText>
        </View>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
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
