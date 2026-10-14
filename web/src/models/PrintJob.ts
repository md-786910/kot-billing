import mongoose, { Schema, Document, Model } from 'mongoose';

export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'PRINTED' | 'FAILED';

export interface IPrintJob extends Document {
  kind: 'kot' | 'cancel' | 'bill' | 'zreport';
  /** Everything needed to render the slip (see lib/print/render.ts) */
  payload: Record<string, unknown>;
  label: string;
  status: PrintJobStatus;
  requestedBy?: string;
  requestedFrom?: string;
  claimedBy?: string | null;
  claimedAt?: Date | null;
  printedAt?: Date | null;
  attempts: number;
  error?: string;
  createdAt: Date;
}

const PrintJobSchema = new Schema<IPrintJob>(
  {
    kind: { type: String, enum: ['kot', 'cancel', 'bill', 'zreport'], required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    label: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'PRINTING', 'PRINTED', 'FAILED'], default: 'PENDING', index: true },
    requestedBy: { type: String },
    requestedFrom: { type: String },
    claimedBy: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

PrintJobSchema.index({ status: 1, createdAt: 1 });
// Keep a week of print history
PrintJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });

export const PrintJobModel: Model<IPrintJob> =
  mongoose.models.PrintJob || mongoose.model<IPrintJob>('PrintJob', PrintJobSchema);

export default PrintJobModel;
