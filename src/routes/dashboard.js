import express from 'express';
import crypto from 'crypto';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import User from '../models/User.js';
import PageVisitor from '../models/PageVisitor.js';
import Referral from '../models/Referral.js';
import { protect, adminOnly } from '../middleware/auth.js';
import { sendEncouragementEmail } from '../utils/sendEmail.js';

const router = express.Router();

// GET /dashboard/stats — counts for dashboard (admin sees all; student sees own)
router.get('/stats', protect, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const [opportunitiesCount, applicationsCount, myApplicationsCount] = await Promise.all([
      Opportunity.countDocuments(isAdmin ? {} : { isActive: true }),
      isAdmin ? Application.countDocuments() : Application.countDocuments({ userId: req.user._id }),
      Application.countDocuments({ userId: req.user._id }),
    ]);
    res.json({
      opportunities: opportunitiesCount,
      applications: applicationsCount,
      myApplications: myApplicationsCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /dashboard/activity — recent activity (e.g. recent applications)
router.get('/activity', protect, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const apps = await Application.find({ userId: req.user._id })
      .populate('opportunityId', 'title company')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const activity = apps.map((a) => ({
      id: a._id,
      type: 'application',
      createdAt: a.createdAt,
      opportunity: a.opportunityId,
      status: a.status,
    }));
    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /dashboard/applications-status — admin only: applications with timestamps grouped by status
router.get('/applications-status', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const filterStatus = req.query.status; // Optional filter: 'pending', 'completed'

    // Pending statuses: applications that haven't been finalized
    const pendingStatuses = ['pending_payment', 'submitted', 'under_review'];
    // Completed statuses: applications with final outcome
    const completedStatuses = ['shortlisted', 'rejected', 'accepted'];

    let query = {};
    if (filterStatus === 'pending') {
      query.status = { $in: pendingStatuses };
    } else if (filterStatus === 'completed') {
      query.status = { $in: completedStatuses };
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('opportunityId', 'title company type')
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Application.countDocuments(query),
    ]);

    // Transform data with timestamps and status categorization
    const formattedApplications = applications.map((app) => ({
      _id: app._id,
      applicant: {
        name: app.userId?.name,
        email: app.userId?.email,
      },
      opportunity: {
        title: app.opportunityId?.title,
        company: app.opportunityId?.company,
        type: app.opportunityId?.type,
      },
      status: app.status,
      statusType: pendingStatuses.includes(app.status) ? 'pending' : 'completed',
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      amountPaid: app.amountPaid,
      hasResume: !!app.resumeUrl,
      hasCoverLetter: !!app.coverLetter,
    }));

    res.json({
      applications: formattedApplications,
      total,
      page,
      pages: Math.ceil(total / limit),
      stats: {
        pending: applications.filter((a) => pendingStatuses.includes(a.status)).length,
        completed: applications.filter((a) => completedStatuses.includes(a.status)).length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /dashboard/track-visit — record a page visit (public endpoint, can be auth or anon)
router.post('/track-visit', async (req, res) => {
  try {
    const { page, sessionId, timeSpent, referral } = req.body;
    
    const userId = req.user?._id || null;
    const isAuthenticated = !!req.user;
    
    const visitor = new PageVisitor({
      userId,
      page: page || 'landing',
      sessionId: sessionId || null,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.connection.remoteAddress,
      referrer: req.headers['referer'],
      referral: referral || null,
      isAuthenticated,
      timeSpent: timeSpent || 0,
    });
    
    await visitor.save();
    // increment referral counter if present
    if (referral) {
      Referral.findOneAndUpdate({ code: referral }, { $inc: { clicks: 1 } }).exec().catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    // Don't fail page load if tracking fails
    res.status(500).json({ ok: false });
  }
});


// GET /dashboard/analytics — admin only: visitor and activity analytics
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Total visitors
    const totalVisitors = await PageVisitor.countDocuments({
      createdAt: { $gte: startDate },
    });
    
    // Anonymous visitors (not logged in)
    const anonVisitors = await PageVisitor.countDocuments({
      isAuthenticated: false,
      createdAt: { $gte: startDate },
    });
    
    // Authenticated users who haven't applied
    const appliedUserIds = await Application.distinct('userId');
    const usersNotApplied = await User.find({
      _id: { $nin: appliedUserIds },
      role: { $in: ['student', 'graduate'] },
      createdAt: { $gte: startDate },
    })
      .select('_id name email createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    // Users who signed up but didn't apply (with their visit info)
    const usersNotAppliedIds = usersNotApplied.map(u => u._id);
    const usersNotAppliedVisits = await PageVisitor.find({
      userId: { $in: usersNotAppliedIds },
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email')
      .lean();
    
    // Visitors by page
    const visitorsByPage = await PageVisitor.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$page', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    // Recent activity: signups and visits
    const recentSignups = await User.find({
      role: { $in: ['student', 'graduate'] },
      createdAt: { $gte: startDate },
    })
      .select('name email createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    res.json({
      period: `${days} days`,
      analytics: {
        totalVisitors,
        anonVisitors,
        authenticatedVisitors: totalVisitors - anonVisitors,
        usersNotAppliedCount: usersNotApplied.length,
        visitorsByPage,
        avgTimeSpent: await PageVisitor.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: null, avgTime: { $avg: '$timeSpent' } } },
        ]).then(res => res[0]?.avgTime || 0),
      },
      usersNotApplied: usersNotApplied.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        joinedAt: u.createdAt,
        visits: usersNotAppliedVisits.filter(v => v.userId?._id?.equals(u._id)).length,
      })),
      recentSignups,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /dashboard/visitors — admin only: detailed visitor list
router.get('/visitors', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filterType = req.query.type; // 'anonymous' | 'logged-in' | 'not-applied'
    
    let query = {};
    
    if (filterType === 'anonymous') {
      query.isAuthenticated = false;
    } else if (filterType === 'logged-in') {
      query.isAuthenticated = true;
    } else if (filterType === 'not-applied') {
      const appliedUserIds = await Application.distinct('userId');
      const users = await User.find({
        _id: { $nin: appliedUserIds },
        role: { $in: ['student', 'graduate'] },
      }).select('_id');
      query.userId = { $in: users.map(u => u._id) };
      query.isAuthenticated = true;
    }
    
    const [visitors, total] = await Promise.all([
      PageVisitor.find(query)
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PageVisitor.countDocuments(query),
    ]);
    
    res.json({
      visitors: visitors.map(v => ({
        _id: v._id,
        userName: v.userId?.name || 'Anonymous',
        userEmail: v.userId?.email || '—',
        page: v.page,
        referral: v.referral || null,
        timeSpent: v.timeSpent,
        isAuthenticated: v.isAuthenticated,
        userAgent: v.userAgent,
        visitedAt: v.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /dashboard/referrals — admin only: list referral codes
router.get('/referrals', protect, adminOnly, async (req, res) => {
  try {
    const referrals = await Referral.find({})
      .sort({ createdAt: -1 })
      .lean();
    res.json({ referrals: referrals.map(r => ({
      _id: r._id,
      code: r.code,
      description: r.description,
      clicks: r.clicks || 0,
      createdAt: r.createdAt,
      createdBy: r.createdBy,
    })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /dashboard/referrals — admin only: create a new referral code
router.post('/referrals', protect, adminOnly, async (req, res) => {
  try {
    const { description } = req.body || {};
    // generate short unique code
    const genCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
    let code = genCode();
    // ensure uniqueness
    let attempts = 0;
    while (await Referral.findOne({ code }) && attempts < 5) {
      code = genCode();
      attempts += 1;
    }
    const referral = new Referral({ code, description, createdBy: req.user._id });
    await referral.save();
    res.status(201).json({ referral });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /dashboard/send-encouragement — admin only: send encouragement email to user who hasn't applied
router.post('/send-encouragement/:userId', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify user exists and hasn't applied
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check user hasn't already applied
    const hasApplied = await Application.findOne({ userId });
    if (hasApplied) {
      return res.status(400).json({ message: 'User has already applied' });
    }
    
    // Fetch current opportunity count for dynamic messaging
    const opportunitiesCount = await Opportunity.countDocuments({ isActive: true });
    
    // Send encouragement email with live count
    const result = await sendEncouragementEmail(user.email, user.name, opportunitiesCount);
    
    if (!result.ok) {
      return res.status(500).json({ message: 'Failed to send email', error: result.error });
    }
    
    res.json({ message: 'Encouragement email sent successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
