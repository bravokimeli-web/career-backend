import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    type: {
      type: String,
      enum: ['payment_reminder', 'completion_reminder', 'offer', 'status_update'],
      default: 'completion_reminder',
    },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
    emailSent: { type: Boolean, default: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ applicationId: 1 });

export default mongoose.model('Message', messageSchema);
