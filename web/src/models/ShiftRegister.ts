import mongoose, { Schema, Document, Model } from 'mongoose';

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface ICashDrop {
  amount: number;
  reason: string;
  staff: string;
  timestamp: Date;
}

export interface IShiftRegister extends Document {
  shiftNumber: string;
  openedBy: string;
  openingFloat: number;
  status: ShiftStatus;
  openedAt: Date;
  closedAt?: Date;
  closedBy?: string;
  closingCashActual?: number;
  expectedCash?: number;
  cashDifference?: number;
  totalSales: number;
  totalCash: number;
  totalUpi: number;
  totalCard: number;
  totalCredit: number;
  totalDiscount: number;
  totalTax: number;
  ordersCount: number;
  cashDrops: ICashDrop[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashDropSchema = new Schema<ICashDrop>(
  {
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    staff: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ShiftRegisterSchema = new Schema<IShiftRegister>(
  {
    shiftNumber: { type: String, required: true, unique: true, index: true },
    openedBy: { type: String, required: true },
    openingFloat: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: String },
    closingCashActual: { type: Number },
    expectedCash: { type: Number },
    cashDifference: { type: Number },
    totalSales: { type: Number, default: 0 },
    totalCash: { type: Number, default: 0 },
    totalUpi: { type: Number, default: 0 },
    totalCard: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    ordersCount: { type: Number, default: 0 },
    cashDrops: { type: [CashDropSchema], default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ShiftRegisterModel: Model<IShiftRegister> =
  mongoose.models.ShiftRegister ||
  mongoose.model<IShiftRegister>('ShiftRegister', ShiftRegisterSchema);

export default ShiftRegisterModel;
