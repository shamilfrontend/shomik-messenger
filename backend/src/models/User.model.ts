import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  contacts: mongoose.Types.ObjectId[];
  params?: {
    messageTextSize?: number;
    theme?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    contacts: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    params: {
      messageTextSize: {
        type: Number,
        default: 14,
        min: 12,
        max: 20,
      },
      theme: {
        type: String,
        enum: ['system', 'light', 'dark'],
        default: 'system',
      },
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });

export default mongoose.model<IUser>('User', UserSchema);
