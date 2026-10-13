import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import {
  AppText,
  Banner,
  Button,
  Chip,
  ChipRow,
  Divider,
  EmptyState,
  SectionLabel,
  Sheet,
  SheetActions,
  Stepper,
  formatMoney,
} from '../ui';

interface ReviewKOTModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_NOTES = ['Less spicy', 'Extra crispy', 'No onion', 'Less ice', 'Serve first'];
const SHISHA_DURATIONS = [30, 45, 60];

type SendError = { tone: 'warning' | 'danger'; text: string };

export const ReviewKOTModal: React.FC<ReviewKOTModalProps> = ({ visible, onClose, onSuccess }) => {
  const { selectedTable, cart, cartTotal, hasShishaInCart, punchKOT, loading, updateCartQty } = usePOS();

  const [notes, setNotes] = useState('');
  const [shishaDuration, setShishaDuration] = useState(45);
  const [error, setError] = useState<SendError | null>(null);

  // Each time the sheet opens, start without a stale error
  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const handleSubmit = async () => {
    setError(null);
    const res = await punchKOT({
      guestName: '',
      guestPhone: '',
      notes: notes.trim(),
      shishaAdvance: 0,
      duration: hasShishaInCart ? shishaDuration : undefined,
    });

    // A second tap while the first is sending is ignored
    if (res.busy) return;
    if (res.success) {
      setNotes('');
      onSuccess();
    } else if (res.uncertain) {
      // Timed out or still processing: data was refreshed and the cart kept with the same key,
      // so sending again can't create a second KOT
      setError({ tone: 'warning', text: `Not confirmed yet. ${res.error || 'Check the Ordered tab before sending again.'}` });
    } else {
      setError({ tone: 'danger', text: res.error || "Couldn't send to the kitchen. Try again." });
    }
  };

  const appendNote = (note: string) => setNotes((prev) => (prev.trim() ? `${prev.trim()}, ${note}` : note));

  const footer = (
    <View style={styles.footer}>
      {error ? <Banner tone={error.tone} text={error.text} /> : null}
      <View style={styles.totalRow}>
        <AppText variant="bodyStrong" tone="secondary">
          Total
        </AppText>
        <AppText variant="title" tone="gold" money>
          {formatMoney(cartTotal)}
        </AppText>
      </View>
      <SheetActions>
        <Button
          label="Send to kitchen"
          icon="send"
          size="lg"
          onPress={handleSubmit}
          loading={loading}
          disabled={cart.length === 0}
          style={styles.grow}
          testID="send-kot"
        />
      </SheetActions>
    </View>
  );

  return (
    <Sheet visible={visible} title="Review order" subtitle={selectedTable} onClose={onClose} footer={footer} testID="review-sheet">
      {cart.length === 0 ? (
        <EmptyState icon="shopping-bag" title="Nothing to send" hint="Add items from the menu first." />
      ) : (
        <View>
          {cart.map((it, idx) => (
            <View key={it.id}>
              {idx > 0 ? <Divider /> : null}
              <View style={styles.line}>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong" numberOfLines={2}>
                    {it.name}
                  </AppText>
                  <AppText variant="caption" tone="muted" money>
                    {formatMoney(it.price)} each
                  </AppText>
                </View>
                <Stepper value={it.qty} itemName={it.name} onChange={(next) => updateCartQty(it.id, next - it.qty)} />
                <AppText variant="bodyStrong" money style={styles.amount} numberOfLines={1}>
                  {formatMoney(it.price * it.qty)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      )}

      {hasShishaInCart ? (
        <View>
          <SectionLabel>Shisha time</SectionLabel>
          <ChipRow style={styles.bleed}>
            {SHISHA_DURATIONS.map((dur) => (
              <Chip
                key={dur}
                label={`${dur} min`}
                selected={shishaDuration === dur}
                onPress={() => setShishaDuration(dur)}
                testID={`shisha-${dur}`}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <View>
        <SectionLabel>Note for the kitchen</SectionLabel>
        <ChipRow style={styles.bleed}>
          {QUICK_NOTES.map((note) => (
            <Chip key={note} label={note} onPress={() => appendNote(note)} testID={`note-${note}`} />
          ))}
        </ChipRow>
        <TextInput
          style={styles.notesInput}
          placeholder="Note for the kitchen"
          placeholderTextColor={COLORS.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          accessibilityLabel="Note for the kitchen"
          testID="kot-notes"
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  grow: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  amount: { minWidth: 64, textAlign: 'right' },
  // ChipRow pads its content by SPACE.lg; offset that so chips line up with the rest of the sheet
  bleed: { marginHorizontal: -SPACE.lg },
  notesInput: {
    ...TYPE.body,
    minHeight: TOUCH.min,
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    textAlignVertical: 'top',
  },
  footer: { gap: SPACE.md },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
