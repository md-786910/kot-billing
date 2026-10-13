import mongoose, { Schema, Document, Model } from 'mongoose';
import { Station } from './MenuItem';

export type OrderStatus = 'OPEN' | 'SETTLED' | 'VOIDED' | 'MERGED';

export interface IOrderItem {
  invoiceNumber?: string;
  name: string;
  price: number;
  station: Station;
  category: string;
  qty: number;
  notes?: string;
  kotId?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: string;
}

export interface IPaymentRecord {
  id?: string;
  amount: number;
  method: 'Cash' | 'UPI' | 'Card' | 'Credit Account';
  creditRef?: string;
  timestamp: Date;
}

export interface ITableTransferRecord {
  fromTable: string;
  toTable: string;
  timestamp: Date;
  staff: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  tableId?: string;
  tableName: string;
  guestName?: string;
  guestPhone?: string;
  staffName?: string;
  bookingId?: string | null;
  shiftId?: string;
  status: OrderStatus;
  items: IOrderItem[];
  notes?: string;
  shishaAdvance: number;
  duration: number; // minutes for shisha
  discountType: 'percentage' | 'flat';
  discountPercent: number;
  discountAmount: number;
  discountReason?: string;
  taxPercent: number;
  payments: IPaymentRecord[];
  tableTransferHistory: ITableTransferRecord[];
  closed: boolean;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    station: {
      type: String,
      required: true,
      enum: ['Kitchen', 'Beverage Counter', 'Shisha Master'],
    },
    category: { type: String, default: '' },
    qty: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '' },
    kotId: { type: String },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String, default: '' },
    voidedAt: { type: Date },
    voidedBy: { type: String },
  },
  { _id: false }
);

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    amount: { type: Number, required: true },
    method: {
      type: String,
      required: true,
      enum: ['Cash', 'UPI', 'Card', 'Credit Account'],
    },
    creditRef: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TableTransferRecordSchema = new Schema<ITableTransferRecord>(
  {
    fromTable: { type: String, required: true },
    toTable: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    staff: { type: String, default: 'Captain 1' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    // GST invoice serial, assigned when the bill is settled, e.g. "2026-27/0012"
    invoiceNumber: { type: String, unique: true, sparse: true },
    tableId: { type: String },
    tableName: { type: String, required: true, index: true },
    guestName: { type: String, default: '' },
    guestPhone: { type: String, default: '' },
    staffName: { type: String, default: 'Captain 1' },
    bookingId: { type: String, default: null },
    shiftId: { type: String },
    status: {
      type: String,
      enum: ['OPEN', 'SETTLED', 'VOIDED', 'MERGED'],
      default: 'OPEN',
      index: true,
    },
    items: { type: [OrderItemSchema], default: [] },
    notes: { type: String, default: '' },
    shishaAdvance: { type: Number, default: 0 },
    duration: { type: Number, default: 45 },
    discountType: { type: String, enum: ['percentage', 'flat'], default: 'flat' },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountReason: { type: String, default: '' },
    taxPercent: { type: Number, default: 5 },
    payments: { type: [PaymentRecordSchema], default: [] },
    tableTransferHistory: { type: [TableTransferRecordSchema], default: [] },
    closed: { type: Boolean, default: false, index: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// High-speed compound queries for POS active list, table tracking and settlements
OrderSchema.index({ closed: 1, createdAt: -1 });
OrderSchema.index({ tableName: 1, closed: 1 });
// A table can only have one running bill
OrderSchema.index({ tableName: 1 }, { unique: true, partialFilterExpression: { closed: false }, name: 'one_open_order_per_table' });
OrderSchema.index({ status: 1, createdAt: -1 });

export const OrderModel: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default OrderModel;
