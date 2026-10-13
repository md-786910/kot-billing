import mongoose, { Schema, Document, Model } from 'mongoose';

export type Station = 'Kitchen' | 'Beverage Counter' | 'Shisha Master';

export interface IMenuItem extends Document {
  name: string;
  price: number;
  station: Station;
  category: string;
  isAvailable: boolean;
  prepTimeMin: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true, trim: true, index: true },
    price: { type: Number, required: true, min: 0 },
    station: {
      type: String,
      required: true,
      enum: ['Kitchen', 'Beverage Counter', 'Shisha Master'],
      index: true,
    },
    category: { type: String, required: true, trim: true, index: true },
    isAvailable: { type: Boolean, default: true, index: true },
    prepTimeMin: { type: Number, default: 15 },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

MenuItemSchema.index({ category: 1, isAvailable: 1 });
MenuItemSchema.index({ station: 1, isAvailable: 1 });

export const MenuItemModel: Model<IMenuItem> =
  mongoose.models.MenuItem || mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);

export default MenuItemModel;
