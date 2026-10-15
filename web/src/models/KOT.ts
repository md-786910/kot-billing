import mongoose, { Schema, Document, Model } from 'mongoose';
import { Station } from './MenuItem';

export type KOTStatus = 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface IKOTItem {
  name: string;
  price: number;
  qty: number;
  notes?: string;
}

export interface IKOT extends Document {
  kotNumber: string;
  orderId: string;
  orderNumber: string;
  tableName: string;
  guestName?: string;
  station: Station;
  items: IKOTItem[];
  notes?: string;
  duration?: number;
  status: KOTStatus;
  startedAt?: Date;
  readyAt?: Date;
  servedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KOTItemSchema = new Schema<IKOTItem>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const KOTSchema = new Schema<IKOT>(
  {
    kotNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    tableName: { type: String, required: true, index: true },
    guestName: { type: String, default: '' },
    station: {
      type: String,
      required: true,
      enum: ['Kitchen', 'Beverage Counter', 'Shisha Master'],
      index: true,
    },
    items: { type: [KOTItemSchema], default: [] },
    notes: { type: String, default: '' },
    duration: { type: Number },
    status: {
      type: String,
      enum: ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'],
      default: 'NEW',
      index: true,
    },
    startedAt: { type: Date },
    readyAt: { type: Date },
    servedAt: { type: Date },
  },
  { timestamps: true }
);

// High-speed compound queries for Kitchen/Bar/Shisha station monitors
KOTSchema.index({ station: 1, status: 1, createdAt: -1 });
KOTSchema.index({ status: 1, createdAt: -1 });
KOTSchema.index({ orderNumber: 1 });
// RECENT list: the createdAt branch of its $or needs its own index
KOTSchema.index({ createdAt: -1 });

export const KOTModel: Model<IKOT> =
  mongoose.models.KOT || mongoose.model<IKOT>('KOT', KOTSchema);

export default KOTModel;
