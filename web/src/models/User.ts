import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'CAPTAIN' | 'KITCHEN_CHEF' | 'SHISHA_MASTER';

export const USER_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'CAPTAIN', 'KITCHEN_CHEF', 'SHISHA_MASTER'];

export interface IUser extends Document {
  name: string;
  role: UserRole;
  phone?: string;
  username?: string; // Password sign-in (owner / managers)
  passwordHash?: string;
  pinHash?: string; // 4-6 digit PIN for paired terminals & phones
  pin?: string; // Legacy plaintext PIN, migrated to pinHash on startup
  failedAttempts: number;
  lockedUntil?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: USER_ROLES, default: 'CAPTAIN', index: true },
    phone: { type: String, trim: true },
    username: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    pinHash: { type: String, select: false },
    pin: { type: String, select: false },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
