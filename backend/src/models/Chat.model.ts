import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  type: 'private' | 'group';
  participants: mongoose.Types.ObjectId[];
  groupName?: string;
  groupAvatar?: string;
  admin?: mongoose.Types.ObjectId;
  lastMessage?: mongoose.Types.ObjectId;
  pinnedMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    type: {
      type: String,
      enum: ['private', 'group'],
      required: true,
    },
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    }],
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    pinnedMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
  },
);

ChatSchema.index({ participants: 1 });
ChatSchema.index({ type: 1 });

export default mongoose.model<IChat>('Chat', ChatSchema);
