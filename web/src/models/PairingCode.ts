import mongoose, { Schema, Document, Model } from 'mongoose';
import { DEVICE_STATIONS, DEVICE_TYPES, DeviceStation, DeviceType } from './Device';

export interface IPairingCode extends Document {
  codeHash: string;
  name: string;
  type: DeviceType;
  station?: DeviceStation | null;
  createdBy: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

const PairingCodeSchema = new Schema<IPairingCode>(
  {
    codeHash: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: DEVICE_TYPES },
    station: { type: String, enum: [...DEVICE_STATIONS, null], default: null },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const PairingCodeModel: Model<IPairingCode> =
  mongoose.models.PairingCode || mongoose.model<IPairingCode>('PairingCode', PairingCodeSchema);

export default PairingCodeModel;
