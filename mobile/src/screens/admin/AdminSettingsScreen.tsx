import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { COLORS, RADIUS, SPACE, TOUCH, TYPE } from '../../constants/theme';
import { usePOS } from '../../context/POSContext';
import { errorMessage } from '../../services/api';
import { fetchSettings, GST_RATES, LoungeSettings, saveSettings } from '../../services/adminApi';
import { AppText, Banner, Button, Chip, SectionLabel } from '../../ui';

/** Labelled 48dp text input shared by the admin screens */
export function Field({
  label,
  hint,
  style,
  multiline,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View>
      <SectionLabel>{label}</SectionLabel>
      <TextInput
        placeholderTextColor={COLORS.textMuted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        multiline={multiline}
        {...input}
        style={[fieldStyles.input, multiline && fieldStyles.multiline, input.editable === false && fieldStyles.readOnly, style]}
      />
      {hint ? (
        <AppText variant="caption" tone="muted" style={fieldStyles.hint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
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
  multiline: { minHeight: TOUCH.min * 2, paddingTop: SPACE.md, paddingBottom: SPACE.md, textAlignVertical: 'top' },
  readOnly: { color: COLORS.textSecondary, backgroundColor: COLORS.bgCard },
  hint: { marginTop: SPACE.xs },
});

type Form = {
  loungeName: string;
  tagline: string;
  address: string;
  phone: string;
  gstNumber: string;
  taxPercent: number;
  shishaMinutes: string;
  kotStaffCopy: boolean;
  kotAdminCopy: boolean;
};

function toForm(s: LoungeSettings): Form {
  return {
    loungeName: s.loungeName,
    tagline: s.tagline,
    address: s.address,
    phone: s.phone,
    gstNumber: s.gstNumber,
    taxPercent: s.taxPercent,
    shishaMinutes: String(s.shishaDefaultDuration),
    kotStaffCopy: s.kotStaffCopy,
    kotAdminCopy: s.kotAdminCopy,
  };
}

export function AdminSettingsScreen() {
  const { can } = usePOS();
  const canEdit = can('settings.manage');

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setForm(toForm(s));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load the lounge details'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setResult(null);
  };

  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    setResult(null);
    try {
      // Sent as typed; the server checks GSTIN format, GST rate and shisha minutes and explains what is wrong
      const minutes = form.shishaMinutes.trim();
      await saveSettings({
        loungeName: form.loungeName,
        tagline: form.tagline,
        address: form.address,
        phone: form.phone,
        gstNumber: form.gstNumber.trim().toUpperCase(),
        taxPercent: form.taxPercent,
        shishaDefaultDuration: /^\d+$/.test(minutes) ? Number(minutes) : 0,
        kotStaffCopy: form.kotStaffCopy,
        kotAdminCopy: form.kotAdminCopy,
      });
      setResult({ tone: 'success', text: 'Saved. New bills use these details.' });
      await load();
    } catch (err) {
      setResult({ tone: 'danger', text: errorMessage(err, 'Could not save the lounge details') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (!form) {
    return (
      <View style={[styles.container, styles.content]}>
        <Banner tone="danger" text={loadError ?? 'Could not load the lounge details'} actionLabel="Retry" onAction={() => void load()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }
      >
        {!canEdit ? <Banner tone="info" text="Only an admin can change these details." /> : null}
        {loadError ? <Banner tone="warning" text={loadError} actionLabel="Retry" onAction={() => void load()} /> : null}

        <AppText variant="caption" tone="muted">
          Printed at the top of every bill and KOT.
        </AppText>

        <Field
          label="Lounge name"
          value={form.loungeName}
          onChangeText={(v) => set('loungeName', v)}
          maxLength={80}
          editable={canEdit}
          testID="settings-lounge-name"
        />
        <Field
          label="Tagline"
          value={form.tagline}
          onChangeText={(v) => set('tagline', v)}
          maxLength={80}
          placeholder="Optional"
          editable={canEdit}
          testID="settings-tagline"
        />
        <Field
          label="Address"
          value={form.address}
          onChangeText={(v) => set('address', v)}
          maxLength={200}
          multiline
          editable={canEdit}
          testID="settings-address"
        />
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={(v) => set('phone', v)}
          maxLength={30}
          keyboardType="phone-pad"
          editable={canEdit}
          testID="settings-phone"
        />
        <Field
          label="GSTIN"
          value={form.gstNumber}
          onChangeText={(v) => set('gstNumber', v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
          hint="15 characters, as on your GST certificate"
          editable={canEdit}
          testID="settings-gstin"
        />

        <View>
          <SectionLabel>GST rate</SectionLabel>
          <View style={styles.chipWrap}>
            {GST_RATES.map((rate) => (
              <Chip
                key={rate}
                label={`${rate}%`}
                selected={form.taxPercent === rate}
                onPress={() => canEdit && set('taxPercent', rate)}
                testID={`gst-rate-${rate}`}
              />
            ))}
          </View>
        </View>

        <Field
          label="Default shisha time (minutes)"
          value={form.shishaMinutes}
          onChangeText={(v) => set('shishaMinutes', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          hint="15 to 180 minutes"
          editable={canEdit}
          testID="settings-shisha-minutes"
        />

        {/* Every KOT prints the station copy; staff and admin copies are optional */}
        <View>
          <SectionLabel>KOT copies</SectionLabel>
          <View style={styles.chipWrap}>
            <Chip label="Station copy (always)" selected onPress={() => {}} testID="kot-copy-station" />
            <Chip
              label="Staff copy"
              selected={form.kotStaffCopy}
              onPress={() => canEdit && set('kotStaffCopy', !form.kotStaffCopy)}
              testID="kot-copy-staff"
            />
            <Chip
              label="Admin copy"
              selected={form.kotAdminCopy}
              onPress={() => canEdit && set('kotAdminCopy', !form.kotAdminCopy)}
              testID="kot-copy-admin"
            />
          </View>
        </View>
      </ScrollView>

      {canEdit ? (
        <View style={styles.footer}>
          {result ? <Banner tone={result.tone} text={result.text} /> : null}
          <Button label="Save" size="lg" fullWidth loading={saving} onPress={save} testID="save-settings" />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.xxl },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  footer: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.lg,
    gap: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
});
