import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN_CHEF' | 'SHISHA_MASTER';

export interface IUser extends Document {
  name: string;
  pin: string; // 4-digit PIN for rapid login on terminals & phones
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    pin: { type: String, required: true, trim: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ['ADMIN', 'MANAGER', 'CASHIER', 'CAPTAIN', 'KITCHEN_CHEF', 'SHISHA_MASTER'],
      default: 'CAPTAIN',
      index: true,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
