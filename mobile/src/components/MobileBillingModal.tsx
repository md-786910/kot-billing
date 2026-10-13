import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Pressable, TextInput, TextInputProps, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { Order } from '../types';
import { usePOS } from '../context/POSContext';
import { newIdempotencyKey } from '../services/api';
import { AppText, Banner, Button, Card, Chip, Divider, SectionLabel, Sheet, SheetActions, formatMoney } from '../ui';

interface MobileBillingModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSettledSuccess: () => void;
}

// Discount (as % of subtotal) staff may give without a manager's approval — mirrors the server
const DISCOUNT_LIMIT_PERCENT = 10;

// `value` is what the server stores (shared with the web POS); `label` is what staff see
const DISCOUNT_REASONS = [
  { value: 'VIP Guest Courtesy', label: 'VIP courtesy' },
  { value: 'Captain Sample / NC', label: 'Sample / no charge' },
  { value: 'Manager Discretion', label: 'Manager discretion' },
  { value: 'Happy Hour Special', label: 'Happy hour' },
  { value: 'Service Recovery', label: 'Service recovery' },
];

type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Split';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const PAYMENT_METHODS: { key: PaymentMethod; icon: IconName }[] = [
  { key: 'Cash', icon: 'cash' },
  { key: 'UPI', icon: 'qrcode-scan' },
  { key: 'Card', icon: 'credit-card-outline' },
  { key: 'Split', icon: 'call-split' },
];

export const MobileBillingModal: React.FC<MobileBillingModalProps> = ({
  visible,
  order,
  onClose,
  onSettledSuccess,
}) => {
  const { settleBill, can } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>(DISCOUNT_REASONS[0].value);
  const [showReceiptPreview, setShowReceiptPreview] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [approvalPin, setApprovalPin] = useState<string>('');
  // The server asked for a manager PIN although our (possibly stale) totals didn't need one
  const [pinRequiredByServer, setPinRequiredByServer] = useState<boolean>(false);

  // Split amounts
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitOnline, setSplitOnline] = useState<string>('0');

  // One key per settlement: reused for retries so a bill is never paid twice, replaced after success
  const settleKeyRef = useRef<string | null>(null);
  // Set synchronously so a double tap can't send two settlements
  const settlingRef = useRef(false);

  const resetEntry = useCallback(() => {
    setPaymentMethod('Cash');
    setCashTendered('');
    setDiscountAmount('0');
    setDiscountReason(DISCOUNT_REASONS[0].value);
    setShowReceiptPreview(false);
    setApprovalPin('');
    setPinRequiredByServer(false);
    setSplitCash('0');
    setSplitOnline('0');
    settleKeyRef.current = null;
  }, []);

  // Nothing typed here (especially a manager's PIN) carries over to the next opening or another bill
  const orderId = order?.id;
  useEffect(() => {
    resetEntry();
  }, [visible, orderId, resetEntry]);

  // The bill was closed elsewhere (or the table emptied): don't leave an invisible modal open
  useEffect(() => {
    if (visible && !order) onClose();
  }, [visible, order, onClose]);

  // Active items (excluding voided)
  const activeItems = useMemo(() => {
    if (!order) return [];
    return order.items.filter((it) => !it.isVoided);
  }, [order]);

  const itemsSubtotal = useMemo(() => {
    return activeItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [activeItems]);

  const discountNum = Math.max(0, Number(discountAmount) || 0);
  const needsApproval =
    (discountNum > (itemsSubtotal * DISCOUNT_LIMIT_PERCENT) / 100 && !can('bill.discount.unlimited')) ||
    pinRequiredByServer;
  const afterDiscount = Math.max(0, itemsSubtotal - discountNum);
  const taxAmount = Math.round((afterDiscount * 0.05) * 100) / 100; // 5% GST
  const cgstAmount = Math.round((taxAmount / 2) * 100) / 100; // 2.5% CGST
  const sgstAmount = Math.round((taxAmount / 2) * 100) / 100; // 2.5% SGST
  const grandTotal = Math.round(afterDiscount + taxAmount);

  // Cash change return
  const cashGivenNum = Number(cashTendered) || 0;
  const changeToReturn = Math.max(0, cashGivenNum - grandTotal);

  // Quick cash amounts: exact, then the next ₹100 and ₹500 notes above the total
  const quickCash = useMemo(() => {
    const next100 = Math.floor(grandTotal / 100) * 100 + 100;
    const next500 = Math.floor(grandTotal / 500) * 500 + 500;
    const options = [{ label: 'Exact', amount: grandTotal }, { label: formatMoney(next100), amount: next100 }];
    if (next500 !== next100) options.push({ label: formatMoney(next500), amount: next500 });
    return options;
  }, [grandTotal]);

  const splitPaid = (Number(splitCash) || 0) + (Number(splitOnline) || 0);
  const reasonLabel = DISCOUNT_REASONS.find((r) => r.value === discountReason)?.label ?? discountReason;

  const handleSettle = async () => {
    if (!order || settlingRef.current) return;
    if (discountNum > itemsSubtotal) {
      Alert.alert('Discount too high', 'The discount cannot be more than the bill subtotal.');
      return;
    }
    if (needsApproval && !/^\d{4,6}$/.test(approvalPin)) {
      Alert.alert(
        'Manager PIN required',
        `Discounts above ${DISCOUNT_LIMIT_PERCENT}% need a manager to enter their PIN.`
      );
      return;
    }

    let payload: any = {
      orderId: order.id,
      discount: discountNum,
      discountReason: discountNum > 0 ? discountReason : undefined,
      taxPercent: 5,
      approvalPin: needsApproval ? approvalPin : undefined,
      idempotencyKey: (settleKeyRef.current ??= newIdempotencyKey()),
    };

    if (paymentMethod === 'Split') {
      const c = Number(splitCash) || 0;
      const o = Number(splitOnline) || 0;
      if (c + o < grandTotal) {
        Alert.alert('Split is short', `Paid ${formatMoney(c + o)} of ${formatMoney(grandTotal)}.`);
        return;
      }
      payload.payments = [
        { amount: c, method: 'Cash' },
        { amount: o, method: 'UPI' },
      ];
    } else {
      payload.payment = {
        amount: grandTotal,
        method: paymentMethod,
      };
    }

    settlingRef.current = true;
    setIsSettling(true);
    const res = await settleBill(payload);
    settlingRef.current = false;
    setIsSettling(false);
    setApprovalPin('');

    if (res.busy) return;
    if (res.success) {
      settleKeyRef.current = null;
      Alert.alert(
        'Bill settled',
        `${order.tableName} paid ${formatMoney(grandTotal)} by ${paymentMethod === 'Split' ? 'split payment' : paymentMethod}. The table is free.`
      );
      onSettledSuccess();
      onClose();
    } else if (res.uncertain) {
      // Timed out or still processing: data was refreshed; the same key makes a retry safe
      Alert.alert('Not confirmed yet', res.error || 'Check the table before trying again.');
    } else if (res.status === 403 && /manager pin required/i.test(res.error ?? '')) {
      setPinRequiredByServer(true);
      Alert.alert('Manager PIN required', 'Ask a manager to enter their PIN below, then tap Settle again.');
    } else if (res.status === 409) {
      Alert.alert('Already settled', res.error || 'This bill is already settled.');
      onSettledSuccess();
      onClose();
    } else {
      Alert.alert("Couldn't settle", res.error || 'Could not settle bill.');
    }
  };

  if (!order) return null;

  return (
    <Sheet
      visible={visible}
      title={`Bill · ${order.tableName}`}
      subtitle={`#${order.orderNumber || order.id.slice(-6).toUpperCase()}`}
      onClose={onClose}
      footer={
        <SheetActions>
          <Button label="Cancel" variant="secondary" onPress={onClose} disabled={isSettling} />
          <Button
            label="Settle"
            trailing={formatMoney(grandTotal)}
            onPress={handleSettle}
            loading={isSettling}
            style={styles.grow}
            testID="confirm-settle"
          />
        </SheetActions>
      }
    >
      {/* 1. Items */}
      <View>
        <SectionLabel>Items</SectionLabel>
        <Card style={styles.listCard}>
          {activeItems.length === 0 ? (
            <AppText variant="body" tone="muted">
              No items on this bill
            </AppText>
          ) : (
            activeItems.map((it, idx) => (
              <View key={idx} style={styles.row}>
                <AppText variant="body" style={styles.grow} numberOfLines={2}>
                  {it.qty}× {it.name}
                </AppText>
                <AppText variant="body" money>
                  {formatMoney(it.price * it.qty)}
                </AppText>
              </View>
            ))
          )}
        </Card>
      </View>

      {/* 2. Discount */}
      <View style={styles.section}>
        <Field
          label="Discount (₹)"
          keyboardType="numeric"
          placeholder="0"
          value={discountAmount === '0' ? '' : discountAmount}
          onChangeText={(t) => {
            setDiscountAmount(t);
            setPinRequiredByServer(false);
          }}
          accessibilityLabel="Discount in rupees"
          testID="discount-input"
        />

        {discountNum > 0 && (
          <View>
            <SectionLabel>Reason</SectionLabel>
            <View style={styles.chipWrap}>
              {DISCOUNT_REASONS.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  selected={discountReason === r.value}
                  onPress={() => setDiscountReason(r.value)}
                />
              ))}
            </View>
          </View>
        )}

        {needsApproval && (
          <Field
            label="Manager PIN"
            hint={
              pinRequiredByServer
                ? 'The server needs a manager to approve this discount.'
                : `Over ${DISCOUNT_LIMIT_PERCENT}% of the bill needs a manager's approval.`
            }
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={approvalPin}
            onChangeText={(t) => setApprovalPin(t.replace(/\D/g, '').slice(0, 6))}
            style={styles.pinInput}
            accessibilityLabel="Manager PIN"
            testID="discount-pin"
          />
        )}
      </View>

      {/* 3. Summary */}
      <Card style={styles.listCard}>
        <SummaryRow label="Subtotal" amount={formatMoney(itemsSubtotal)} />
        {discountNum > 0 && <SummaryRow label="Discount" amount={`−${formatMoney(discountNum)}`} />}
        <SummaryRow label="CGST 2.5%" amount={formatMoney(cgstAmount)} />
        <SummaryRow label="SGST 2.5%" amount={formatMoney(sgstAmount)} />
        <Divider style={styles.divider} />
        <View style={styles.row}>
          <AppText variant="heading" style={styles.grow}>
            Total
          </AppText>
          <AppText variant="title" tone="gold" money>
            {formatMoney(grandTotal)}
          </AppText>
        </View>
      </Card>

      {/* 4. Payment */}
      <View style={styles.section}>
        <View>
          <SectionLabel>Payment</SectionLabel>
          <View style={styles.tiles} accessibilityRole="radiogroup">
            {PAYMENT_METHODS.map((m) => (
              <PayTile
                key={m.key}
                label={m.key}
                icon={m.icon}
                selected={paymentMethod === m.key}
                onPress={() => setPaymentMethod(m.key)}
              />
            ))}
          </View>
        </View>

        {paymentMethod === 'Cash' && (
          <>
            <Field
              label="Cash received"
              keyboardType="numeric"
              placeholder={String(grandTotal)}
              value={cashTendered}
              onChangeText={setCashTendered}
              accessibilityLabel="Cash received in rupees"
              testID="cash-received"
            />
            <View style={styles.chipWrap}>
              {quickCash.map((q) => (
                <Chip
                  key={q.label}
                  label={q.label}
                  selected={cashGivenNum === q.amount}
                  onPress={() => setCashTendered(String(q.amount))}
                />
              ))}
            </View>
            {cashGivenNum > 0 &&
              (cashGivenNum >= grandTotal ? (
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.grow}>
                    Change to return
                  </AppText>
                  <AppText variant="heading" tone={changeToReturn > 0 ? 'success' : 'secondary'} money>
                    {formatMoney(changeToReturn)}
                  </AppText>
                </View>
              ) : (
                <View style={styles.row}>
                  <AppText variant="bodyStrong" tone="warning" style={styles.grow}>
                    Short by
                  </AppText>
                  <AppText variant="heading" tone="warning" money>
                    {formatMoney(grandTotal - cashGivenNum)}
                  </AppText>
                </View>
              ))}
          </>
        )}

        {paymentMethod === 'UPI' && (
          <Banner tone="info" text={`Ask the guest to scan the counter UPI QR for ${formatMoney(grandTotal)}.`} />
        )}

        {paymentMethod === 'Split' && (
          <>
            <Field
              label="Cash part (₹)"
              keyboardType="numeric"
              placeholder="0"
              value={splitCash === '0' ? '' : splitCash}
              onChangeText={setSplitCash}
              accessibilityLabel="Cash part in rupees"
              testID="split-cash"
            />
            <Field
              label="UPI / card part (₹)"
              keyboardType="numeric"
              placeholder="0"
              value={splitOnline === '0' ? '' : splitOnline}
              onChangeText={setSplitOnline}
              accessibilityLabel="UPI or card part in rupees"
              testID="split-online"
            />
            <View style={styles.row}>
              <AppText variant="body" tone="secondary" style={styles.grow}>
                Paid {formatMoney(splitPaid)} of {formatMoney(grandTotal)}
              </AppText>
              {splitPaid < grandTotal ? (
                <AppText variant="bodyStrong" tone="warning" money>
                  {formatMoney(grandTotal - splitPaid)} left
                </AppText>
              ) : (
                <AppText variant="bodyStrong" tone="success">
                  Covered
                </AppText>
              )}
            </View>
          </>
        )}
      </View>

      {/* 5. Receipt preview */}
      <Button
        label={showReceiptPreview ? 'Hide receipt' : 'Preview receipt'}
        variant="secondary"
        icon={showReceiptPreview ? 'chevron-up' : 'printer'}
        onPress={() => setShowReceiptPreview((prev) => !prev)}
        testID="toggle-receipt"
      />

      {showReceiptPreview && (
        <View style={styles.receipt}>
          <View style={styles.receiptHead}>
            <AppText variant="bodyStrong">Layali Lounge & Cafe</AppText>
            <AppText variant="caption" tone="muted">
              Tax invoice
            </AppText>
          </View>
          <Divider style={styles.divider} />
          <AppText variant="caption" tone="secondary">
            {order.tableName} · Order {order.orderNumber || order.id}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {order.staffName || 'Staff'} · {new Date().toLocaleTimeString()}
          </AppText>
          <Divider style={styles.divider} />

          {activeItems.map((it, idx) => (
            <ReceiptRow key={idx} label={`${it.qty}× ${it.name}`} amount={formatMoney(it.price * it.qty)} />
          ))}

          <Divider style={styles.divider} />
          <ReceiptRow label="Subtotal" amount={formatMoney(itemsSubtotal)} />
          {discountNum > 0 && <ReceiptRow label={`Discount (${reasonLabel})`} amount={`−${formatMoney(discountNum)}`} />}
          <ReceiptRow label="CGST 2.5%" amount={formatMoney(cgstAmount)} />
          <ReceiptRow label="SGST 2.5%" amount={formatMoney(sgstAmount)} />
          <Divider style={styles.divider} />
          <View style={styles.row}>
            <AppText variant="bodyStrong" style={styles.grow}>
              Grand total
            </AppText>
            <AppText variant="bodyStrong" tone="gold" money>
              {formatMoney(grandTotal)}
            </AppText>
          </View>
          <Divider style={styles.divider} />
          <AppText variant="caption" tone="muted" style={styles.center}>
            Thank you for dining with us
          </AppText>
        </View>
      )}
    </Sheet>
  );
};

/** Labelled 48dp text input */
function Field({ label, hint, style, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <TextInput placeholderTextColor={COLORS.textMuted} {...input} style={[styles.input, style]} />
      {hint ? (
        <AppText variant="caption" tone="warning" style={styles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="body" tone="secondary" style={styles.grow}>
        {label}
      </AppText>
      <AppText variant="body" money>
        {amount}
      </AppText>
    </View>
  );
}

function ReceiptRow({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.grow} numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="caption" money>
        {amount}
      </AppText>
    </View>
  );
}

/** One of four equal payment tiles; selected = gold border on a gold tint */
function PayTile({
  label,
  icon,
  selected,
  onPress,
}: {
  label: PaymentMethod;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`pay-${label.toLowerCase()}`}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.tileSelected,
        pressed && !selected && { backgroundColor: COLORS.borderDefault },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={selected ? COLORS.gold : COLORS.textSecondary} />
      <AppText variant="label" tone={selected ? 'gold' : 'secondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  center: { textAlign: 'center' },
  section: { gap: SPACE.md },
  listCard: { gap: SPACE.sm, padding: SPACE.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  divider: { marginVertical: SPACE.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  input: {
    minHeight: TOUCH.min,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.bgInput,
    color: COLORS.textPrimary,
    fontSize: TYPE.body.fontSize,
  },
  pinInput: { fontSize: TYPE.heading.fontSize, letterSpacing: 6 },
  hint: { marginTop: SPACE.xs },
  tiles: { flexDirection: 'row', gap: SPACE.sm },
  tile: {
    flex: 1,
    minHeight: TOUCH.large,
    paddingVertical: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.bgSurface,
  },
  tileSelected: { borderColor: COLORS.gold, backgroundColor: COLORS.goldSubtle },
  receipt: {
    gap: SPACE.xs,
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.bgInput,
  },
  receiptHead: { alignItems: 'center' },
});
