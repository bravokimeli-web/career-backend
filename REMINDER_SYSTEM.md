# Application Reminder System Documentation

## Overview

The Application Reminder System automatically sends follow-up emails to users who have started an application but haven't completed payment or the application process. This helps recover incomplete applications and encourage users to secure opportunities quickly.

## Features Implemented

### 1. **Message Model** (`src/models/Message.js`)
Stores all reminder notifications and messages sent to users with the following fields:
- `userId`: Reference to the user who receives the message
- `applicationId`: Reference to the incomplete application
- `opportunityId`: Reference to the opportunity being applied for
- `type`: Message type (payment_reminder, completion_reminder, offer, status_update)
- `subject`: Email subject line
- `content`: Message body
- `read`: Track if user has read the message in the app
- `emailSent`: Track if email was successfully sent
- `sentAt`: Timestamp when the reminder was sent

### 2. **Reminder Email Function** (`src/utils/sendEmail.js`)
New `sendApplicationReminderEmail()` function that:
- Sends a professional, encouraging email to users
- Includes a direct link to continue their application
- References the opportunity title and resume status
- Uses Resend email service

### 3. **Automated Scheduler** (`src/utils/scheduler.js`)
Runs automatically every 6 hours and:
- Finds all applications with status `pending_payment` created more than 3 days ago
- Checks if reminders have already been sent (limit: 2 per application)
- Sends email reminders to users
- Creates Message records to track sent reminders
- Logs all activities with detailed information

## Configuration

### Reminder Settings
In `src/utils/scheduler.js`, customize the `REMINDER_CONFIG`:

```javascript
const REMINDER_CONFIG = {
  'pending_payment': {
    days: 3,           // Send reminder after 3 days of pending payment
    maxReminders: 2,   // Maximum 2 reminders per application
  },
};
```

### Scheduler Frequency
Current schedule: Runs every 6 hours (`0 */6 * * *`)

To change the frequency, modify the cron schedule in `initializeScheduler()`:
- Every hour: `0 * * * *`
- Every 12 hours: `0 */12 * * *`
- Once daily at 2 AM: `0 2 * * *`
- Custom: Use standard cron syntax

## API Endpoints

### GET `/api/messages`
Retrieves all messages for the authenticated user, sorted by newest first.

**Response:**
```json
[
  {
    "_id": "...",
    "userId": "...",
    "applicationId": "...",
    "opportunityId": { "title": "Software Engineer Intern" },
    "type": "payment_reminder",
    "subject": "Complete your application for Software Engineer Intern — we're here to help",
    "content": "You have a pending application that needs to be completed...",
    "read": false,
    "emailSent": true,
    "sentAt": "2026-02-24T10:30:00Z",
    "createdAt": "2026-02-24T10:30:00Z"
  }
]
```

### GET `/api/messages/:id`
Retrieves a specific message (must be user's own message).

### PATCH `/api/messages/:id/read`
Marks a message as read in the application.

## Database Changes

New collection created:
- `messages` - Stores all user messages and reminders

Indexes added:
- `userId` + `createdAt` (for efficient message retrieval)
- `applicationId` (for tracking reminders per application)

## Email Configuration

Ensure your `.env` file contains:
```
RESEND_API_KEY=your_resend_api_key
RESEND_FROM="CareerStart <noreply@careerstart.co.ke>"
FRONTEND_URL=your_frontend_url
```

The system uses the `FRONTEND_URL` to generate the dashboard link in reminder emails.

## How It Works - Step by Step

1. **User starts application** → Application created with status `pending_payment`
2. **3 days pass** → Scheduler runs and finds old pending applications
3. **Scheduler sends email** → User receives reminder email with dashboard link
4. **Message recorded** → Message stored in database (visible in API)
5. **User is reminded** → If no action after 6 days → 2nd reminder sent
6. **After 2 reminders** → No more reminders sent for that application

## Monitoring

The scheduler logs all activity to the console:

```
[Scheduler] Initializing application reminder scheduler...
[Scheduler] Reminder scheduler started (runs every 6 hours)
[Scheduler] Running application reminder check...
[Scheduler] Found 5 pending applications to check
[Scheduler] Reminder sent to user@example.com for Software Engineer Intern
[Scheduler] Reminder check complete. Sent 2 reminders.
```

## Manual Testing

To manually trigger the reminder check (for testing purposes), you can call:

```javascript
import { triggerReminderCheck } from './src/utils/scheduler.js';
await triggerReminderCheck();
```

Or add an admin endpoint to trigger it via API.

## Dependencies Added

- `node-cron@^3.0.3` - For scheduling background tasks

Run `npm install` to install the new dependency.

## Future Enhancements

Possible improvements:
1. Add support for different reminder statuses (completed, refunded, etc.)
2. Customize reminder message based on days pending
3. Add SMS reminders in addition to email
4. Admin dashboard to view and manage reminders
5. Allow users to unsubscribe from reminders
6. A/B testing different reminder messages
7. Analytics on reminder click-through rates

## Troubleshooting

**Reminders not sending?**
- Check that `RESEND_API_KEY` is set in `.env`
- Verify `FRONTEND_URL` is correct
- Check server logs for errors in scheduler output
- Ensure MongoDB is connected

**Too many reminders?**
- Adjust `maxReminders` in REMINDER_CONFIG
- Increase `days` threshold to wait longer before first reminder

**Want to disable reminders temporarily?**
- Comment out `initializeScheduler()` in `src/index.js`
- Or set `maxReminders: 0` in REMINDER_CONFIG
