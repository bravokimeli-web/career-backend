import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

referralSchema.index({ code: 1 });
referralSchema.index({ createdBy: 1 });

export default mongoose.model('Referral', referralSchema);
