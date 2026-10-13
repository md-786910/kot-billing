import mongoose, { Schema, Document, Model } from 'mongoose';

export type TableStatus = 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED';
export type TableType = 'regular' | 'private';

export interface ITable extends Document {
  name: string;
  floor: string;
  type: TableType;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string | null;
  hourlyRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    floor: { type: String, required: true, default: 'Main Floor', index: true },
    type: { type: String, enum: ['regular', 'private'], default: 'regular' },
    capacity: { type: Number, default: 4 },
    status: {
      type: String,
      enum: ['VACANT', 'OCCUPIED', 'BILL_PRINTED', 'RESERVED'],
      default: 'VACANT',
      index: true,
    },
    currentOrderId: { type: String, default: null },
    hourlyRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

TableSchema.index({ status: 1, floor: 1 });

export const TableModel: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>('Table', TableSchema);

export default TableModel;
