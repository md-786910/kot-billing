import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  approvedBy?: string | null;
  target?: string | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    actorId: { type: String, default: null },
    actorName: { type: String, default: null },
    deviceId: { type: String, default: null },
    deviceName: { type: String, default: null },
    approvedBy: { type: String, default: null },
    target: { type: String, default: null },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLogModel: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLogModel;
