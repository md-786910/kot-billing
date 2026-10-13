import mongoose, { Schema, Document, Model } from 'mongoose';

export type BookingStatus = 'ACTIVE' | 'CLOSED';
export type VenueType = 'VIP Lounge' | 'Couple Cabin';

export interface IPrivateBooking extends Document {
  bookingNumber: string;
  venue: VenueType;
  guest: string;
  phone: string;
  rate: number; // hourly rate
  advance: number; // advance deposit
  hours: number; // estimated hours
  notes?: string;
  status: BookingStatus;
  start: Date;
  end?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PrivateBookingSchema = new Schema<IPrivateBooking>(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    venue: {
      type: String,
      required: true,
      enum: ['VIP Lounge', 'Couple Cabin'],
      index: true,
    },
    guest: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    advance: { type: Number, default: 0, min: 0 },
    hours: { type: Number, required: true, min: 0.5 },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
    start: { type: Date, default: Date.now },
    end: { type: Date },
  },
  { timestamps: true }
);

PrivateBookingSchema.index({ status: 1, start: -1 });

export const PrivateBookingModel: Model<IPrivateBooking> =
  mongoose.models.PrivateBooking ||
  mongoose.model<IPrivateBooking>('PrivateBooking', PrivateBookingSchema);

export default PrivateBookingModel;
