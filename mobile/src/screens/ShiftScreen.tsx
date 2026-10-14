import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Alert } from '../ui/alert';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { errorMessage } from '../services/api';
import { Shift, addCashDrop, closeShift, fetchShifts, openShift, printZReport } from '../services/opsApi';
import { AppText, Banner, Button, Card, Divider, EmptyState, SectionLabel, Sheet, SheetActions, formatMoney } from '../ui';

const amountOnly = (t: string) => t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 9);

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

/** "Over ₹X" / "Short ₹X" / "Exact" */
function differenceLabel(diff: number): { text: string; tone: 'success' | 'danger' | 'primary' } {
  const rounded = Math.round(diff * 100) / 100;
  if (rounded > 0) return { text: `Over ${formatMoney(rounded)}`, tone: 'success' };
  if (rounded < 0) return { text: `Short ${formatMoney(-rounded)}`, tone: 'danger' };
  return { text: 'Exact', tone: 'primary' };
}

/** Labelled amount / text input */
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
  testID?: string;
}> = ({ label, value, onChange, numeric, placeholder, maxLength, testID }) => (
  <View style={styles.field}>
    <AppText variant="label" tone="secondary">
      {label}
    </AppText>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={(t) => onChange(numeric ? amountOnly(t) : t)}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      maxLength={maxLength}
      accessibilityLabel={label}
      testID={testID}
    />
  </View>
);

/** One cell of the totals grid */
const Stat: React.FC<{ label: string; value: string; money?: boolean }> = ({ label, value, money }) => (
  <View style={styles.stat}>
    <AppText variant="caption" tone="muted">
      {label}
    </AppText>
    <AppText variant="bodyStrong" tone={money ? 'gold' : 'primary'} money>
      {value}
    </AppText>
  </View>
);

export const ShiftScreen: React.FC = () => {
  const [current, setCurrent] = useState<Shift | null>(null);
  const [past, setPast] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Open shift
  const [openingFloat, setOpeningFloat] = useState('2000');
  const [opening, setOpening] = useState(false);

  // Cash drop sheet
  const [dropOpen, setDropOpen] = useState(false);
  const [dropAmount, setDropAmount] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [dropping, setDropping] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // Close shift sheet
  const [closeOpen, setCloseOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const [printingId, setPrintingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchShifts();
      setCurrent(res.currentShift);
      setPast(res.pastShifts.slice(0, 10));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the cash drawer'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleOpen = async () => {
    const amount = Number(openingFloat);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter the opening float.');
      return;
    }
    setOpening(true);
    setError(null);
    setSuccess(null);
    try {
      await openShift(amount);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not open the shift'));
    } finally {
      setOpening(false);
    }
  };

  const showDrop = () => {
    setDropAmount('');
    setDropReason('');
    setDropError(null);
    setDropOpen(true);
  };

  const handleDrop = async () => {
    const amount = Number(dropAmount);
    if (!(amount > 0)) return setDropError('Enter the amount taken out.');
    if (!dropReason.trim()) return setDropError('Enter a reason.');
    setDropping(true);
    setDropError(null);
    try {
      await addCashDrop(amount, dropReason.trim());
      setDropOpen(false);
      await load();
    } catch (err) {
      setDropError(errorMessage(err, 'Could not record the cash drop'));
    } finally {
      setDropping(false);
    }
  };

  const showClose = () => {
    setCounted('');
    setCloseNotes('');
    setCloseError(null);
    setCloseOpen(true);
  };

  const countedValue = Number(counted);
  const hasCount = counted.trim() !== '' && Number.isFinite(countedValue);
  const liveDiff = current && hasCount ? differenceLabel(countedValue - current.expectedCash) : null;

  const doClose = async () => {
    setClosing(true);
    setCloseError(null);
    try {
      await closeShift(countedValue, closeNotes.trim());
      setCloseOpen(false);
      setSuccess('Shift closed. Z-report is printing at the counter.');
      await load();
    } catch (err) {
      setCloseError(errorMessage(err, 'Could not close the shift'));
    } finally {
      setClosing(false);
    }
  };

  const confirmClose = () => {
    if (!current) return;
    if (!hasCount || countedValue < 0) {
      setCloseError('Enter the cash counted in the drawer.');
      return;
    }
    const diff = differenceLabel(countedValue - current.expectedCash);
    Alert.alert(
      `Close ${current.shiftNumber}?`,
      `Counted ${formatMoney(countedValue)}, expected ${formatMoney(current.expectedCash)} (${diff.text}). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Close shift', style: 'destructive', onPress: doClose },
      ]
    );
  };

  const handlePrint = async (s: Shift) => {
    setPrintingId(s.id);
    try {
      await printZReport(s.shiftNumber);
      Alert.alert('Sent to the counter printer', `Z-report for ${s.shiftNumber}.`);
    } catch (err) {
      Alert.alert('Could not print', errorMessage(err, 'Try again.'));
    } finally {
      setPrintingId(null);
    }
  };

  const totalDrops = current ? current.cashDrops.reduce((sum, d) => sum + (Number(d.amount) || 0), 0) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
            progressBackgroundColor={COLORS.bgSurface}
          />
        }
      >
        {success ? <Banner tone="success" text={success} /> : null}
        {error ? <Banner tone="danger" text={error} actionLabel="Retry" onAction={onRefresh} /> : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : current ? (
          <>
            <Card accent={COLORS.gold} testID="shift-current">
              <View style={styles.headRow}>
                <View style={styles.flex}>
                  <AppText variant="title">{current.shiftNumber}</AppText>
                  <AppText variant="caption" tone="muted">
                    Opened by {current.openedBy} · {formatTime(current.openedAt)}
                  </AppText>
                </View>
              </View>

              <View style={styles.grid}>
                <Stat label="Bills" value={String(current.ordersCount)} />
                <Stat label="Sales" value={formatMoney(current.totalSales)} money />
                <Stat label="Cash" value={formatMoney(current.totalCash)} money />
                <Stat label="UPI" value={formatMoney(current.totalUpi)} money />
                <Stat label="Card" value={formatMoney(current.totalCard)} money />
                <Stat label="Khata / credit" value={formatMoney(current.totalCredit)} money />
                <Stat label="Discounts" value={formatMoney(current.totalDiscount)} money />
                <Stat label="GST" value={formatMoney(current.totalTax)} money />
              </View>

              <Divider style={styles.divider} />
              <AppText variant="caption" tone="muted">
                Float {formatMoney(current.openingFloat)} + cash {formatMoney(current.totalCash)}
                {totalDrops > 0 ? ` − drops ${formatMoney(totalDrops)}` : ''}
              </AppText>
              <View style={styles.expectedRow}>
                <AppText variant="bodyStrong" tone="secondary">
                  Expected in drawer
                </AppText>
                <AppText variant="display" tone="gold" money testID="shift-expected">
                  {formatMoney(current.expectedCash)}
                </AppText>
              </View>
            </Card>

            {current.cashDrops.length > 0 ? (
              <Card>
                <SectionLabel>Cash drops</SectionLabel>
                {current.cashDrops.map((d, i) => (
                  <View key={`${d.timestamp}-${i}`} style={styles.dropRow}>
                    <View style={styles.flex}>
                      <AppText variant="body">{d.reason}</AppText>
                      <AppText variant="caption" tone="muted">
                        {d.staff} · {formatTime(d.timestamp)}
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong" tone="gold" money>
                      {formatMoney(d.amount)}
                    </AppText>
                  </View>
                ))}
              </Card>
            ) : null}

            <View style={styles.actions}>
              <Button label="Cash drop" variant="secondary" icon="minus-circle" onPress={showDrop} testID="shift-drop" />
              <Button label="Close shift" icon="lock" onPress={showClose} style={styles.flex} testID="shift-close" />
            </View>
          </>
        ) : (
          <Card testID="shift-none">
            <AppText variant="heading">No shift is open</AppText>
            <AppText variant="body" tone="muted" style={styles.hint}>
              Count the float in the drawer, then open a shift to start taking cash.
            </AppText>
            <Field
              label="Opening float (₹)"
              value={openingFloat}
              onChange={setOpeningFloat}
              numeric
              testID="shift-float"
            />
            <Button
              label="Open shift"
              icon="unlock"
              size="lg"
              fullWidth
              onPress={handleOpen}
              loading={opening}
              style={styles.openButton}
              testID="shift-open"
            />
          </Card>
        )}

        <SectionLabel style={styles.sectionGap}>Past shifts</SectionLabel>
        {!loading && past.length === 0 ? (
          <EmptyState icon="archive" title="No closed shifts yet" hint="Closed shifts and their Z-reports show here." />
        ) : null}
        {past.map((s) => {
          const diff = differenceLabel(Number(s.cashDifference) || 0);
          return (
            <Card key={s.id} testID={`shift-past-${s.shiftNumber}`}>
              <View style={styles.headRow}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{s.shiftNumber}</AppText>
                  <AppText variant="caption" tone="muted">
                    Closed {formatTime(s.closedAt)}
                    {s.closedBy ? ` by ${s.closedBy}` : ''}
                  </AppText>
                </View>
                <View style={styles.pastAmounts}>
                  <AppText variant="bodyStrong" tone="gold" money>
                    {formatMoney(s.totalSales)}
                  </AppText>
                  <AppText variant="caption" tone={diff.tone} money>
                    {diff.text}
                  </AppText>
                </View>
              </View>
              <Button
                label="Print Z-report"
                variant="secondary"
                icon="printer"
                onPress={() => handlePrint(s)}
                loading={printingId === s.id}
                style={styles.printButton}
                testID={`shift-print-${s.shiftNumber}`}
              />
            </Card>
          );
        })}
      </ScrollView>

      <Sheet
        visible={dropOpen}
        title="Cash drop"
        subtitle="Cash taken out of the drawer during the shift"
        onClose={() => !dropping && setDropOpen(false)}
        dismissOnBackdrop={!dropping}
        testID="shift-drop-sheet"
        footer={
          <SheetActions>
            <Button label="Cancel" variant="secondary" onPress={() => setDropOpen(false)} disabled={dropping} />
            <Button label="Record drop" onPress={handleDrop} loading={dropping} style={styles.flex} testID="shift-drop-submit" />
          </SheetActions>
        }
      >
        {dropError ? <Banner tone="danger" text={dropError} /> : null}
        <Field label="Amount (₹)" value={dropAmount} onChange={setDropAmount} numeric testID="shift-drop-amount" />
        <Field
          label="Reason"
          value={dropReason}
          onChange={setDropReason}
          placeholder="Safe deposit, petty cash…"
          maxLength={120}
          testID="shift-drop-reason"
        />
      </Sheet>

      <Sheet
        visible={closeOpen}
        title="Close shift"
        subtitle={current ? `${current.shiftNumber} · opened ${formatTime(current.openedAt)}` : undefined}
        onClose={() => !closing && setCloseOpen(false)}
        dismissOnBackdrop={!closing}
        testID="shift-close-sheet"
        footer={
          <SheetActions>
            <Button label="Cancel" variant="secondary" onPress={() => setCloseOpen(false)} disabled={closing} />
            <Button label="Close shift" onPress={confirmClose} loading={closing} style={styles.flex} testID="shift-close-submit" />
          </SheetActions>
        }
      >
        {closeError ? <Banner tone="danger" text={closeError} /> : null}
        <View style={styles.expectedRow}>
          <AppText variant="body" tone="secondary">
            Expected in drawer
          </AppText>
          <AppText variant="title" tone="gold" money>
            {formatMoney(current?.expectedCash ?? 0)}
          </AppText>
        </View>
        <Field label="Cash counted (₹)" value={counted} onChange={setCounted} numeric testID="shift-counted" />
        <View style={styles.expectedRow}>
          <AppText variant="body" tone="secondary">
            Difference
          </AppText>
          <AppText variant="heading" tone={liveDiff ? liveDiff.tone : 'muted'} money testID="shift-difference">
            {liveDiff ? liveDiff.text : 'Enter the count'}
          </AppText>
        </View>
        <Field label="Notes" value={closeNotes} onChange={setCloseNotes} maxLength={200} testID="shift-close-notes" />
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.xxl, flexGrow: 1 },
  loading: { paddingVertical: SPACE.xxxl, alignItems: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.md, marginTop: SPACE.lg },
  stat: { width: '50%', gap: 2 },
  divider: { marginVertical: SPACE.md },
  expectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.xs },
  actions: { flexDirection: 'row', gap: SPACE.md },
  hint: { marginTop: SPACE.xs, marginBottom: SPACE.md },
  openButton: { marginTop: SPACE.md },
  sectionGap: { marginTop: SPACE.md },
  pastAmounts: { alignItems: 'flex-end', gap: 2 },
  printButton: { marginTop: SPACE.md, alignSelf: 'flex-start' },
  field: { gap: SPACE.xs },
  input: {
    minHeight: TOUCH.min,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACE.md,
    color: COLORS.textPrimary,
    fontSize: TYPE.body.fontSize,
  },
});
