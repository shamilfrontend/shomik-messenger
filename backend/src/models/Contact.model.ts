import mongoose, { Schema, Document } from 'mongoose';

export interface IContact extends Document {
  userId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

ContactSchema.index({ userId: 1, contactId: 1 }, { unique: true });
ContactSchema.index({ userId: 1 });

export default mongoose.model<IContact>('Contact', ContactSchema);
