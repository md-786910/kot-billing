import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons, FontAwesome5, Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { Order } from '../types';
import { usePOS } from '../context/POSContext';

interface MobileBillingModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSettledSuccess: () => void;
}

const DISCOUNT_REASONS = [
  'VIP Guest Courtesy',
  'Captain Sample / NC',
  'Manager Discretion',
  'Happy Hour Special',
  'Service Recovery',
];

export const MobileBillingModal: React.FC<MobileBillingModalProps> = ({
  visible,
  order,
  onClose,
  onSettledSuccess,
}) => {
  const { settleBill } = usePOS();

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Split'>('Cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>(DISCOUNT_REASONS[0]);
  const [showReceiptPreview, setShowReceiptPreview] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // Split amounts
  const [splitCash, setSplitCash] = useState<string>('0');
  const [splitOnline, setSplitOnline] = useState<string>('0');

  // Active items (excluding voided)
  const activeItems = useMemo(() => {
    if (!order) return [];
    return order.items.filter((it) => !it.isVoided);
  }, [order]);

  const itemsSubtotal = useMemo(() => {
    return activeItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  }, [activeItems]);

  const discountNum = Number(discountAmount) || 0;
  const afterDiscount = Math.max(0, itemsSubtotal - discountNum);
  const taxAmount = Math.round((afterDiscount * 0.05) * 100) / 100; // 5% GST
  const cgstAmount = Math.round((taxAmount / 2) * 100) / 100; // 2.5% CGST
  const sgstAmount = Math.round((taxAmount / 2) * 100) / 100; // 2.5% SGST
  const grandTotal = Math.round(afterDiscount + taxAmount);

  // Cash change return
  const cashGivenNum = Number(cashTendered) || 0;
  const changeToReturn = Math.max(0, cashGivenNum - grandTotal);

  const handleSettle = async () => {
    if (!order) return;

    let payload: any = {
      orderId: order.id,
      discount: discountNum,
      discountReason: discountNum > 0 ? discountReason : undefined,
      taxPercent: 5,
    };

    if (paymentMethod === 'Split') {
      const c = Number(splitCash) || 0;
      const o = Number(splitOnline) || 0;
      if (c + o < grandTotal) {
        Alert.alert('Incomplete Split Tender', `Total paid (₹${c + o}) is less than bill total (₹${grandTotal}).`);
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

    setIsSettling(true);
    const res = await settleBill(payload);
    setIsSettling(false);

    if (res.success) {
      Alert.alert(
        'Bill Settled Successfully',
        `Table ${order.tableName} bill of ₹${grandTotal} settled via ${paymentMethod}. Table is now VACANT.`
      );
      onSettledSuccess();
      onClose();
    } else {
      Alert.alert('Settlement Failed', res.error || 'Could not settle bill.');
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="receipt" size={20} color={COLORS.gold} />
                <Text style={styles.headerTitle}>Settle Table Bill</Text>
              </View>
              <Text style={styles.headerSub}>
                {order.tableName} • Ref #{order.orderNumber || order.id.slice(-6).toUpperCase()}
              </Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Feather name="x" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* 1. RECEIPT PREVIEW TOGGLE */}
            <TouchableOpacity
              style={styles.receiptToggleBar}
              onPress={() => setShowReceiptPreview((prev) => !prev)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FontAwesome5 name="print" size={13} color={COLORS.gold} />
                <Text style={styles.receiptToggleText}>
                  {showReceiptPreview ? 'Hide 80mm Receipt Print' : 'Preview 80mm Thermal Receipt'}
                </Text>
              </View>
              <Ionicons
                name={showReceiptPreview ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>

            {/* 80mm Thermal Receipt Preview Card */}
            {showReceiptPreview && (
              <View style={styles.thermalReceiptBox}>
                <Text style={styles.receiptHeader}>*** LAYALI LOUNGE & CAFE ***</Text>
                <Text style={styles.receiptCenter}>Tax Invoice / Cash Memo</Text>
                <Text style={styles.receiptCenter}>GSTIN: 07AAAAA0000A1Z5</Text>
                <Text style={styles.receiptDivider}>--------------------------------</Text>
                <Text style={styles.receiptMeta}>Table: {order.tableName}  |  Order: {order.orderNumber || order.id}</Text>
                <Text style={styles.receiptMeta}>Server: {order.staffName || 'Staff'}  |  Date: {new Date().toLocaleTimeString()}</Text>
                <Text style={styles.receiptDivider}>--------------------------------</Text>

                {activeItems.map((it, idx) => (
                  <View key={idx} style={styles.receiptItemRow}>
                    <Text style={styles.receiptItemName}>{it.qty}x {it.name}</Text>
                    <Text style={styles.receiptItemPrice}>₹{(it.price * it.qty).toFixed(2)}</Text>
                  </View>
                ))}

                <Text style={styles.receiptDivider}>--------------------------------</Text>
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>Subtotal:</Text>
                  <Text style={styles.receiptItemPrice}>₹{itemsSubtotal.toFixed(2)}</Text>
                </View>
                {discountNum > 0 && (
                  <View style={styles.receiptItemRow}>
                    <Text style={[styles.receiptItemName, { color: '#f87171' }]}>Discount ({discountReason}):</Text>
                    <Text style={[styles.receiptItemPrice, { color: '#f87171' }]}>-₹{discountNum.toFixed(2)}</Text>
                  </View>
                )}
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>CGST (2.5%):</Text>
                  <Text style={styles.receiptItemPrice}>₹{cgstAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>SGST (2.5%):</Text>
                  <Text style={styles.receiptItemPrice}>₹{sgstAmount.toFixed(2)}</Text>
                </View>
                <Text style={styles.receiptDivider}>================================</Text>
                <View style={styles.receiptItemRow}>
                  <Text style={[styles.receiptItemName, { fontWeight: '900' }]}>GRAND TOTAL:</Text>
                  <Text style={[styles.receiptItemPrice, { fontWeight: '900', color: COLORS.gold }]}>₹{grandTotal.toFixed(2)}</Text>
                </View>
                <Text style={styles.receiptDivider}>================================</Text>
                <Text style={styles.receiptCenter}>Thank You for Dining with Us!</Text>
              </View>
            )}

            {/* 2. ORDER ITEMS BREAKDOWN */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Ordered Items ({activeItems.length})</Text>
              {activeItems.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {it.qty}x {it.name}
                    </Text>
                    <Text style={styles.itemStation}>{it.station}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{(it.price * it.qty).toFixed(2)}</Text>
                </View>
              ))}
            </View>

            {/* 3. DISCOUNT SECTION */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Bill Discount (Optional)</Text>
              <View style={styles.discountRow}>
                <TextInput
                  style={styles.discountInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  value={discountAmount}
                  onChangeText={setDiscountAmount}
                />
                <Text style={styles.rupeeTag}>₹</Text>
              </View>

              {discountNum > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.fieldLabel}>Discount Reason:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                    {DISCOUNT_REASONS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.reasonChip,
                          discountReason === r && styles.reasonChipActive,
                        ]}
                        onPress={() => setDiscountReason(r)}
                      >
                        <Text
                          style={[
                            styles.reasonChipText,
                            discountReason === r && styles.reasonChipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 4. BILL TOTALS SUMMARY */}
            <View style={styles.totalsCard}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryVal}>₹{itemsSubtotal.toFixed(2)}</Text>
              </View>
              {discountNum > 0 && (
                <View style={styles.summaryLine}>
                  <Text style={[styles.summaryLabel, { color: '#f87171' }]}>Discount</Text>
                  <Text style={[styles.summaryVal, { color: '#f87171' }]}>-₹{discountNum.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>CGST (2.5%) + SGST (2.5%)</Text>
                <Text style={styles.summaryVal}>₹{taxAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.grandTotalDivider} />
              <View style={styles.summaryLine}>
                <Text style={styles.grandTotalLabel}>Total Amount Due</Text>
                <Text style={styles.grandTotalVal}>₹{grandTotal.toFixed(2)}</Text>
              </View>
            </View>

            {/* 5. PAYMENT METHOD SELECTION */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Select Payment Tender</Text>
              <View style={styles.tenderTabs}>
                {(['Cash', 'UPI', 'Card', 'Split'] as const).map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.tenderTab,
                      paymentMethod === method && styles.tenderTabActive,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <MaterialCommunityIcons
                      name={
                        method === 'Cash'
                          ? 'cash'
                          : method === 'UPI'
                          ? 'qrcode-scan'
                          : method === 'Card'
                          ? 'credit-card'
                          : 'call-split'
                      }
                      size={18}
                      color={paymentMethod === method ? '#ffffff' : COLORS.textMuted}
                    />
                    <Text
                      style={[
                        styles.tenderTabText,
                        paymentMethod === method && styles.tenderTabTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* CASH CHANGE RETURN CALCULATOR */}
              {paymentMethod === 'Cash' && (
                <View style={styles.cashBox}>
                  <Text style={styles.fieldLabel}>Cash Handed by Guest (₹):</Text>
                  <TextInput
                    style={styles.cashInput}
                    keyboardType="numeric"
                    placeholder={`e.g. ${grandTotal}`}
                    placeholderTextColor={COLORS.textMuted}
                    value={cashTendered}
                    onChangeText={setCashTendered}
                  />

                  {cashGivenNum > 0 && (
                    <View style={styles.changeReturnRow}>
                      <Text style={styles.changeLabel}>Change to Return:</Text>
                      <Text
                        style={[
                          styles.changeVal,
                          changeToReturn > 0 ? { color: '#34d399' } : { color: COLORS.textMuted },
                        ]}
                      >
                        ₹{changeToReturn.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* UPI QR NOTICE */}
              {paymentMethod === 'UPI' && (
                <View style={styles.upiBox}>
                  <MaterialCommunityIcons name="qrcode" size={28} color={COLORS.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upiTitle}>Scan Dynamic UPI QR</Text>
                    <Text style={styles.upiSub}>
                      Ask guest to scan restaurant counter UPI QR for exact ₹{grandTotal}
                    </Text>
                  </View>
                </View>
              )}

              {/* SPLIT TENDER INPUTS */}
              {paymentMethod === 'Split' && (
                <View style={styles.splitBox}>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.fieldLabel}>Cash Portion (₹):</Text>
                    <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      value={splitCash}
                      onChangeText={setSplitCash}
                    />
                  </View>
                  <View>
                    <Text style={styles.fieldLabel}>UPI / Card Portion (₹):</Text>
                    <TextInput
                      style={styles.cashInput}
                      keyboardType="numeric"
                      value={splitOnline}
                      onChangeText={setSplitOnline}
                    />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSettling}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settleBtn, isSettling && { opacity: 0.7 }]}
              onPress={handleSettle}
              disabled={isSettling}
            >
              {isSettling ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={18} color="#ffffff" />
                  <Text style={styles.settleText}>Settle & Free Table (₹{grandTotal})</Text>
                </>
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
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    maxHeight: '90%',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    marginVertical: 10,
  },
  receiptToggleBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  receiptToggleText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  thermalReceiptBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  receiptHeader: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  receiptCenter: {
    color: '#333333',
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  receiptDivider: {
    color: '#666666',
    fontSize: 9,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginVertical: 4,
  },
  receiptMeta: {
    color: '#333333',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  receiptItemName: {
    color: '#000000',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  receiptItemPrice: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  itemStation: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  itemPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
  },
  discountInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 8,
  },
  rupeeTag: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  reasonChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  reasonChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: COLORS.gold,
  },
  reasonChipText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  reasonChipTextActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  totalsCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 14,
    marginBottom: 12,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 3,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  summaryVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  grandTotalDivider: {
    height: 1,
    backgroundColor: COLORS.borderDefault,
    marginVertical: 8,
  },
  grandTotalLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  grandTotalVal: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: '900',
  },
  tenderTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tenderTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.bgPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tenderTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryHover,
  },
  tenderTabText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tenderTabTextActive: {
    color: '#ffffff',
  },
  cashBox: {
    marginTop: 12,
    backgroundColor: COLORS.bgPrimary,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  cashInput: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  changeReturnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  changeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  changeVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  upiBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 10,
    padding: 12,
  },
  upiTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  upiSub: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  splitBox: {
    marginTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORS.bgSurface,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  settleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.kitchen,
    paddingVertical: 12,
    borderRadius: 12,
  },
  settleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
