import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '../ui/alert';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { usePrintStatus } from '../hooks/usePrintStatus';
import { errorMessage, errorStatus } from '../services/api';
import { PrintJob, PrintJobStatus, retryPrintJob } from '../services/printApi';
import { AppText, Badge, Banner, Button, EmptyState, Sheet } from '../ui';

const STATUS: Record<PrintJobStatus, { label: string; fg: string; bg: string }> = {
  PENDING: { label: 'Waiting', fg: COLORS.warning, bg: COLORS.warningBg },
  PRINTING: { label: 'Printing', fg: COLORS.info, bg: COLORS.infoBg },
  PRINTED: { label: 'Printed', fg: COLORS.success, bg: COLORS.successBg },
  FAILED: { label: 'Failed', fg: COLORS.danger, bg: COLORS.dangerBg },
};

/** "9:05 pm" */
function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Recent slips sent to the counter printer, with retry for failed ones and reprint for printed ones. */
export const PrintQueueSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({ visible, onClose }) => {
  const { can } = usePOS();
  const { status, problem, message, tone, refresh } = usePrintStatus();
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const canRetry = can('order.create');

  // Fresh list every time the sheet opens
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const station = status?.station;
  const subtitle = !status
    ? 'Loading…'
    : !station?.configured
    ? 'No counter printer set'
    : `${station.name ?? 'Counter printer'} · ${station.online ? 'Online' : 'Offline'}`;

  const retry = async (job: PrintJob) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(job.id);
    try {
      await retryPrintJob(job.id);
    } catch (err) {
      if (errorStatus(err) === 409) Alert.alert('Already waiting', 'This slip is already waiting to print.');
      else Alert.alert("Couldn't send to the printer", errorMessage(err, 'Try again.'));
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const jobs = status?.jobs ?? [];

  return (
    <Sheet
      visible={visible}
      title="Print queue"
      subtitle={subtitle}
      onClose={onClose}
      testID="print-queue"
      footer={<Button label="Refresh" variant="secondary" icon="refresh-cw" onPress={() => refresh()} fullWidth testID="print-queue-refresh" />}
    >
      {problem && message ? <Banner tone={tone} text={message} /> : null}

      {jobs.length === 0 ? (
        <EmptyState icon="printer" title="Nothing printed yet" hint="Slips sent to the counter printer in the last 12 hours show here." />
      ) : (
        jobs.map((job) => {
          const s = STATUS[job.status] ?? STATUS.PENDING;
          const meta = [clockTime(job.createdAt), job.requestedBy, job.requestedFrom].filter(Boolean).join(' · ');
          const action = job.status === 'FAILED' ? 'Retry' : job.status === 'PRINTED' ? 'Print again' : null;
          return (
            <View key={job.id} style={styles.job} testID={`print-job-${job.id}`}>
              <View style={styles.row}>
                <AppText variant="bodyStrong" numberOfLines={2} style={styles.flex}>
                  {job.label}
                </AppText>
                <Badge label={s.label} fg={s.fg} bg={s.bg} />
              </View>
              {meta ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {meta}
                </AppText>
              ) : null}
              {job.status === 'FAILED' && job.error ? (
                <AppText variant="caption" tone="danger">
                  {job.error}
                </AppText>
              ) : null}
              {action && canRetry ? (
                <Button
                  label={action}
                  variant="secondary"
                  icon={job.status === 'FAILED' ? 'rotate-cw' : 'printer'}
                  onPress={() => retry(job)}
                  loading={busyId === job.id}
                  disabled={!!busyId && busyId !== job.id}
                  style={styles.action}
                  testID={`print-retry-${job.id}`}
                  accessibilityLabel={`${action}: ${job.label}`}
                />
              ) : null}
            </View>
          );
        })
      )}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  job: {
    gap: SPACE.xs,
    padding: SPACE.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },
  action: { alignSelf: 'flex-start', marginTop: SPACE.xs },
});
