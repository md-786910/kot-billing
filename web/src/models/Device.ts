import mongoose, { Schema, Document, Model } from 'mongoose';

// TERMINAL = web POS / cashier, MOBILE = waiter phone, DISPLAY = station screen (KDS / shisha)
export type DeviceType = 'TERMINAL' | 'MOBILE' | 'DISPLAY';
export type DeviceStation = 'Kitchen' | 'Beverage Counter' | 'Shisha Master';

export const DEVICE_TYPES: DeviceType[] = ['TERMINAL', 'MOBILE', 'DISPLAY'];
export const DEVICE_STATIONS: DeviceStation[] = ['Kitchen', 'Beverage Counter', 'Shisha Master'];

export interface IDevice extends Document {
  name: string;
  type: DeviceType;
  station?: DeviceStation | null;
  tokenHash: string;
  pairedBy?: string;
  lastSeenAt?: Date;
  /** This counter computer prints KOTs, bills and reports for every device */
  printStation: boolean;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: DEVICE_TYPES },
    station: { type: String, enum: [...DEVICE_STATIONS, null], default: null },
    tokenHash: { type: String, required: true, unique: true, select: false },
    pairedBy: { type: String },
    lastSeenAt: { type: Date },
    printStation: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DeviceModel: Model<IDevice> =
  mongoose.models.Device || mongoose.model<IDevice>('Device', DeviceSchema);

export default DeviceModel;
