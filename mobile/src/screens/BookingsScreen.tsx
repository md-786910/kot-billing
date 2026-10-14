import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Alert } from '../ui/alert';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { errorMessage } from '../services/api';
import { BOOKING_VENUES, BookingVenue, PrivateBooking, createBooking, fetchBookings, releaseBooking } from '../services/opsApi';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  SectionLabel,
  Sheet,
  SheetActions,
  formatElapsed,
  formatMoney,
  minutesSince,
} from '../ui';

const TICK_MS = 30_000;
const RECENT_CLOSED = 5;

const amountOnly = (t: string) => t.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 9);

/** Labelled single-line input */
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  numeric?: boolean;
  phone?: boolean;
  multiline?: boolean;
  maxLength?: number;
  testID?: string;
}> = ({ label, value, onChange, placeholder, numeric, phone, multiline, maxLength, testID }) => (
  <View style={styles.field}>
    <AppText variant="label" tone="secondary">
      {label}
    </AppText>
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={(t) => onChange(numeric ? amountOnly(t) : t)}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={numeric ? 'decimal-pad' : phone ? 'phone-pad' : 'default'}
      multiline={multiline}
      maxLength={maxLength}
      accessibilityLabel={label}
      testID={testID}
    />
  </View>
);

/** One label/value pair inside a booking card */
const Fact: React.FC<{ label: string; value: string; money?: boolean; tone?: 'primary' | 'gold' | 'warning' }> = ({
  label,
  value,
  money,
  tone = 'primary',
}) => (
  <View style={styles.fact}>
    <AppText variant="caption" tone="muted">
      {label}
    </AppText>
    <AppText variant="bodyStrong" tone={tone} money={money}>
      {value}
    </AppText>
  </View>
);

const EMPTY_FORM = { guest: '', phone: '', rate: '500', advance: '0', hours: '2', notes: '' };

interface BookingsScreenProps {
  /** Select the venue as the table and switch to the Order tab */
  onOpenTable: (tableName: string) => void;
}

export const BookingsScreen: React.FC<BookingsScreenProps> = ({ onOpenTable }) => {
  const { can } = usePOS();
  const canOrder = can('order.create');

  const [bookings, setBookings] = useState<PrivateBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // New booking sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [venue, setVenue] = useState<BookingVenue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await fetchBookings());
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load bookings'));
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the elapsed time current between refreshes
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = useMemo(() => bookings.filter((b) => b.status === 'ACTIVE'), [bookings]);
  const closed = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'CLOSED')
        .sort((a, b) => new Date(b.end ?? b.start).getTime() - new Date(a.end ?? a.start).getTime())
        .slice(0, RECENT_CLOSED),
    [bookings]
  );
  const busyVenues = useMemo(() => new Set(active.map((b) => b.venue)), [active]);

  const openSheet = () => {
    setForm(EMPTY_FORM);
    setVenue(BOOKING_VENUES.find((v) => !busyVenues.has(v)) ?? null);
    setFormError(null);
    setSheetOpen(true);
  };

  const setField = (key: keyof typeof EMPTY_FORM) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const rate = Number(form.rate);
    const advance = Number(form.advance || 0);
    const hours = Number(form.hours);
    if (!venue) return setFormError('Choose a venue.');
    if (!form.guest.trim()) return setFormError('Enter the guest name.');
    if (!form.phone.trim()) return setFormError('Enter a phone number.');
    if (!Number.isFinite(rate) || rate < 0) return setFormError('Enter the rate per hour.');
    if (!Number.isFinite(advance) || advance < 0) return setFormError('Enter a valid advance.');
    if (!Number.isFinite(hours) || hours <= 0) return setFormError('Enter the booked hours.');

    setSaving(true);
    setFormError(null);
    try {
      await createBooking({
        venue,
        guest: form.guest.trim(),
        phone: form.phone.trim(),
        rate,
        advance,
        hours,
        notes: form.notes.trim(),
      });
      setSheetOpen(false);
      await load();
    } catch (err) {
      // 409: the venue already has an active booking; the server message says which
      setFormError(errorMessage(err, 'Could not create the booking'));
    } finally {
      setSaving(false);
    }
  };

  const confirmRelease = (b: PrivateBooking) => {
    Alert.alert(`Release ${b.venue}?`, `${b.guest}'s booking will be closed and the space freed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Release',
        style: 'destructive',
        onPress: async () => {
          setReleasingId(b.id);
          try {
            await releaseBooking(b.bookingNumber);
            await load();
          } catch (err) {
            Alert.alert('Could not release', errorMessage(err, 'Try again.'));
          } finally {
            setReleasingId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.list}
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
        {loadError ? <Banner tone="danger" text={loadError} actionLabel="Retry" onAction={onRefresh} /> : null}

        <SectionLabel>Active bookings</SectionLabel>
        {active.length === 0 && !loading ? (
          <EmptyState icon="calendar" title="No active bookings" hint="Book the VIP Lounge or Couple Cabin for a group." />
        ) : null}

        {active.map((b) => {
          const overtime = minutesSince(b.start, now) > b.hours * 60;
          return (
            <Card key={b.id} accent={COLORS.gold} testID={`booking-${b.bookingNumber}`}>
              <View style={styles.cardHead}>
                <View style={styles.flex}>
                  <AppText variant="heading">{b.venue}</AppText>
                  <AppText variant="body" tone="secondary" numberOfLines={1}>
                    {b.guest} · {b.phone}
                  </AppText>
                </View>
                <Badge label={b.bookingNumber} fg={COLORS.gold} bg={COLORS.goldSubtle} />
              </View>

              <View style={styles.facts}>
                <Fact label="Rate" value={`${formatMoney(b.rate)}/hr`} money tone="gold" />
                <Fact label="Advance" value={formatMoney(b.advance)} money tone="gold" />
                <Fact label="Elapsed" value={formatElapsed(b.start, now)} tone={overtime ? 'warning' : 'primary'} />
                <Fact label="Booked" value={`${b.hours} h`} />
              </View>

              {b.notes ? (
                <AppText variant="caption" tone="muted" style={styles.notes}>
                  {b.notes}
                </AppText>
              ) : null}

              <View style={styles.cardActions}>
                <Button
                  label="Release"
                  variant="dangerGhost"
                  icon="log-out"
                  onPress={() => confirmRelease(b)}
                  loading={releasingId === b.id}
                  testID={`booking-release-${b.bookingNumber}`}
                />
                {canOrder ? (
                  <Button
                    label="Take order"
                    variant="secondary"
                    icon="edit-3"
                    onPress={() => onOpenTable(b.venue)}
                    style={styles.flex}
                    testID={`booking-order-${b.bookingNumber}`}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}

        {closed.length > 0 ? (
          <>
            <SectionLabel style={styles.sectionGap}>Recently closed</SectionLabel>
            {closed.map((b) => (
              <Card key={b.id} style={styles.closedCard} testID={`booking-closed-${b.bookingNumber}`}>
                <View style={styles.cardHead}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" tone="secondary">
                      {b.venue} · {b.guest}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {b.bookingNumber}
                      {b.end ? ` · ${formatElapsed(b.start, new Date(b.end).getTime())}` : ''}
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" tone="muted" money>
                    {formatMoney(b.rate)}/hr
                  </AppText>
                </View>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="New booking" icon="plus" size="lg" fullWidth onPress={openSheet} testID="booking-new" />
      </View>

      <Sheet
        visible={sheetOpen}
        title="New booking"
        subtitle="The space is billed per hour from now"
        onClose={() => !saving && setSheetOpen(false)}
        dismissOnBackdrop={!saving}
        testID="booking-sheet"
        footer={
          <SheetActions>
            <Button label="Cancel" variant="secondary" onPress={() => setSheetOpen(false)} disabled={saving} testID="booking-cancel" />
            <Button label="Book" onPress={submit} loading={saving} style={styles.flex} testID="booking-submit" />
          </SheetActions>
        }
      >
        {formError ? <Banner tone="danger" text={formError} /> : null}

        <View style={styles.field}>
          <AppText variant="label" tone="secondary">
            Venue
          </AppText>
          <View style={styles.chips}>
            {BOOKING_VENUES.map((v) => (
              <Chip
                key={v}
                label={busyVenues.has(v) ? `${v} (booked)` : v}
                selected={venue === v}
                onPress={() => setVenue(v)}
                testID={`booking-venue-${v === 'VIP Lounge' ? 'vip' : 'cabin'}`}
              />
            ))}
          </View>
        </View>

        <Field label="Guest name" value={form.guest} onChange={setField('guest')} maxLength={80} testID="booking-guest" />
        <Field label="Phone" value={form.phone} onChange={setField('phone')} phone maxLength={20} testID="booking-phone" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field label="Rate per hour (₹)" value={form.rate} onChange={setField('rate')} numeric testID="booking-rate" />
          </View>
          <View style={styles.flex}>
            <Field label="Hours" value={form.hours} onChange={setField('hours')} numeric testID="booking-hours" />
          </View>
        </View>
        <Field label="Advance (₹)" value={form.advance} onChange={setField('advance')} numeric testID="booking-advance" />
        <Field label="Notes" value={form.notes} onChange={setField('notes')} multiline maxLength={200} testID="booking-notes" />

        <Divider />
        <View style={styles.estimate}>
          <AppText variant="body" tone="secondary">
            Estimated room charge
          </AppText>
          <AppText variant="heading" tone="gold" money>
            {formatMoney((Number(form.rate) || 0) * (Number(form.hours) || 0))}
          </AppText>
        </View>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  list: { gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.xxl, flexGrow: 1 },
  sectionGap: { marginTop: SPACE.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.sm, marginTop: SPACE.md },
  fact: { width: '50%', gap: 2 },
  notes: { marginTop: SPACE.sm },
  cardActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  closedCard: { backgroundColor: COLORS.bgSecondary, paddingVertical: SPACE.md },
  footer: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
  field: { gap: SPACE.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  row: { flexDirection: 'row', gap: SPACE.md },
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
  inputMultiline: { minHeight: TOUCH.large + SPACE.xxl, paddingTop: SPACE.md, textAlignVertical: 'top' },
  estimate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
