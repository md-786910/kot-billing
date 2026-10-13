import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISettings extends Document {
  loungeName: string;
  tagline: string;
  address: string;
  phone: string;
  gstNumber: string;
  taxPercent: number;
  soundAlerts: boolean;
  shishaDefaultDuration: number;
  upiId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    loungeName: { type: String, default: 'LAYALI SHISHA LOUNGE' },
    tagline: { type: String, default: 'PREMIUM LOUNGE & CAFE' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    taxPercent: { type: Number, default: 5 },
    soundAlerts: { type: Boolean, default: true },
    shishaDefaultDuration: { type: Number, default: 45 },
    upiId: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SettingsModel: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default SettingsModel;
