import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISession extends Document {
  tokenHash: string;
  userId: string;
  deviceId?: string | null; // Staff PIN sessions are bound to the device they were opened on
  method: 'PASSWORD' | 'PIN';
  expiresAt: Date;
  lastUsedAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    deviceId: { type: String, default: null, index: true },
    method: { type: String, enum: ['PASSWORD', 'PIN'], required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Purge sessions a day after they expire
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const SessionModel: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

export default SessionModel;
