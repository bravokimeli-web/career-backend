import express from 'express';
import Opportunity from '../models/Opportunity.js';
import Application from '../models/Application.js';
import { protect, adminOnly } from '../middleware/auth.js';

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

export default router;
