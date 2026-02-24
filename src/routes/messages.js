import express from 'express';
import Message from '../models/Message.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /messages — get all messages for the authenticated user
router.get('/', protect, async (req, res, next) => {
  try {
    const messages = await Message.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('opportunityId', 'title')
      .lean();

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

// GET /messages/:id — get a single message
router.get('/:id', protect, async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('opportunityId', 'title');

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Ensure user owns this message
    if (message.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this message' });
    }

    res.json(message);
  } catch (error) {
    next(error);
  }
});

// PATCH /messages/:id/read — mark message as read
router.patch('/:id/read', protect, async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Ensure user owns this message
    if (message.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this message' });
    }

    message.read = true;
    await message.save();

    res.json({ read: true });
  } catch (error) {
    next(error);
  }
});

export default router;
