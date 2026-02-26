import mongoose from 'mongoose';

const pageVisitorSchema = new mongoose.Schema(
  {
    // userId is optional - null means unauthenticated visitor
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    
    // Page visited (e.g., 'browse', 'landing', 'dashboard')
    page: { type: String, required: true },
    
    // Session identifier for anonymous visitors
    sessionId: { type: String },
    
    // Device/browser info
    userAgent: { type: String },
    ipAddress: { type: String },
    
    // Referrer
    referrer: { type: String },

    // Promotional code or campaign identifier (from tracking links)
    promoCode: { type: String },
    
    // Whether user is authenticated
    isAuthenticated: { type: Boolean, default: false },
    
    // Time spent on page (in seconds)
    timeSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for common queries
pageVisitorSchema.index({ page: 1, createdAt: -1 });
pageVisitorSchema.index({ userId: 1, createdAt: -1 });
pageVisitorSchema.index({ sessionId: 1, createdAt: -1 });
pageVisitorSchema.index({ createdAt: -1 });

export default mongoose.model('PageVisitor', pageVisitorSchema);
