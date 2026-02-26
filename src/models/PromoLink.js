import mongoose from 'mongoose';

const promoLinkSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

promoLinkSchema.index({ code: 1 });

export default mongoose.model('PromoLink', promoLinkSchema);
