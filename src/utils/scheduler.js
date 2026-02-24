import cron from 'node-cron';
import Application from '../models/Application.js';
import Message from '../models/Message.js';
import Opportunity from '../models/Opportunity.js';
import { sendApplicationReminderEmail } from './sendEmail.js';

// Reminder configuration
const REMINDER_CONFIG = {
  'pending_payment': {
    days: 3, // Send reminder after 3 days of pending payment
    maxReminders: 2, // Max 2 reminders per application
  },
};

export async function initializeScheduler() {
  console.log('[Scheduler] Initializing application reminder scheduler...');

  // Run every 6 hours (0 */6 * * *)
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Running application reminder check...');
    try {
      await checkAndSendReminders();
    } catch (error) {
      console.error('[Scheduler] Error in reminder check:', error.message);
    }
  });

  console.log('[Scheduler] Reminder scheduler started (runs every 6 hours)');
}

async function checkAndSendReminders() {
  try {
    // Find all pending_payment applications created more than the reminder threshold
    const config = REMINDER_CONFIG['pending_payment'];
    const thresholdDate = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000);

    const applications = await Application.find({
      status: 'pending_payment',
      createdAt: { $lte: thresholdDate },
    })
      .populate('userId', 'name email')
      .populate('opportunityId', 'title')
      .lean();

    if (applications.length === 0) {
      console.log('[Scheduler] No pending applications found');
      return;
    }

    console.log(`[Scheduler] Found ${applications.length} pending applications to check`);

    let remindersSent = 0;

    for (const app of applications) {
      try {
        const config = REMINDER_CONFIG['pending_payment'];
        
        // Check how many reminders have already been sent for this application
        const existingReminders = await Message.countDocuments({
          applicationId: app._id,
          type: 'payment_reminder',
        });

        if (existingReminders >= config.maxReminders) {
          console.log(`[Scheduler] Max reminders reached for application ${app._id}`);
          continue; // Already sent max reminders
        }

        const user = app.userId;
        const opportunity = app.opportunityId;

        if (!user || !opportunity) {
          console.warn(`[Scheduler] User or Opportunity not found for application ${app._id}`);
          continue;
        }

        // Construct dashboard URL
        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`;

        // Send reminder email
        const emailResult = await sendApplicationReminderEmail({
          to: user.email,
          name: user.name,
          opportunityTitle: opportunity.title,
          resumeUrl: app.resumeUrl,
          dashboardUrl,
        });

        if (emailResult.ok) {
          // Create message record in database
          const message = new Message({
            userId: app.userId,
            applicationId: app._id,
            opportunityId: app.opportunityId,
            type: 'payment_reminder',
            subject: `Complete your application for ${opportunity.title}`,
            content: `You have a pending application that needs to be completed. Please proceed with payment to secure your opportunity.`,
            emailSent: true,
            sentAt: new Date(),
          });

          await message.save();
          remindersSent++;
          console.log(`[Scheduler] Reminder sent to ${user.email} for ${opportunity.title}`);
        } else {
          console.warn(`[Scheduler] Failed to send email to ${user.email}`);
        }
      } catch (err) {
        console.error(`[Scheduler] Error processing application ${app._id}:`, err.message);
      }
    }

    console.log(`[Scheduler] Reminder check complete. Sent ${remindersSent} reminders.`);
  } catch (error) {
    console.error('[Scheduler] Fatal error in checkAndSendReminders:', error.message);
  }
}

// Manual trigger function for testing/admin use
export async function triggerReminderCheck() {
  console.log('[Scheduler] Manual reminder check triggered');
  await checkAndSendReminders();
}
