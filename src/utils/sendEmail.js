import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM || 'CareerStart <noreply@careerstart.co.ke>';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

async function safeSendEmail(payload) {
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY not set. Email not sent.');
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const result = await resend.emails.send(payload);
    if (result.error) {
      console.error('[Resend] send error:', result.error);
      return { ok: false, error: String(result.error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('[Resend] Exception while sending email:', msg);
    return { ok: false, error: msg };
  }
}

export async function sendVerificationEmail(to, name, verificationUrl) {
  const html = `
    <p>Hi ${name},</p>
    <p>Please verify your email by clicking the link below:</p>
    <p><a href="${verificationUrl}">Verify my email</a></p>
    <p>The link expires in 24 hours.</p>
    <p>— CareerStart</p>
  `;

  const text = `Hi ${name},

Please verify your email by clicking this link:
${verificationUrl}

The link expires in 24 hours.

— CareerStart`;

  const { ok } = await safeSendEmail({
    from: resendFrom,
    to,
    subject: 'Verify your email — CareerStart',
    html,
    text,
  });

  return ok;
}

export async function sendOTPEmail(to, otp) {
  const html = `
    <h2>Email Verification</h2>
    <p>Your verification code is:</p>
    <h1 style="font-size: 32px; letter-spacing: 4px; margin: 16px 0;">${otp}</h1>
    <p>This code expires in 10 minutes.</p>
    <p>— CareerStart</p>
  `;

  const text = `Your verification code is: ${otp}

This code expires in 10 minutes.

— CareerStart`;

  const { ok } = await safeSendEmail({
    from: resendFrom,
    to,
    subject: 'Verify your email — CareerStart',
    html,
    text,
  });

  return ok;
}

export async function sendPasswordResetEmail(to, name, resetUrl) {
  const html = `
    <p>Hi ${name},</p>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${resetUrl}">Reset my password</a></p>
    <p>The link expires in 1 hour.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <p>— CareerStart</p>
  `;

  const text = `Hi ${name},

You requested a password reset. Click this link to set a new password:
${resetUrl}

The link expires in 1 hour.
If you didn't request this, you can safely ignore this email.

— CareerStart`;

  const result = await safeSendEmail({
    from: resendFrom,
    to,
    subject: 'Reset your password — CareerStart',
    html,
    text,
  });

  return result;
}

export async function sendWelcomeEmail(to, name) {
  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>Welcome to <strong>CareerStart</strong> — your hub for internships, attachments and early‑career opportunities.</p>
    <p>Here’s what you can do next:</p>
    <ul>
      <li><strong>Complete your profile</strong> so employers can quickly understand your skills and experience.</li>
      <li><strong>Browse live opportunities</strong> and save the ones that match your interests.</li>
      <li><strong>Apply in a few clicks</strong> and track every application from your dashboard.</li>
    </ul>
    <p>We’re excited to be part of your journey.</p>
    <p>— CareerStart Team</p>
  `;

  const text = `Hi ${name || 'there'},

Welcome to CareerStart — your hub for internships, attachments and early‑career opportunities.

Here’s what you can do next:
- Complete your profile so employers can quickly understand your skills and experience.
- Browse live opportunities and save the ones that match your interests.
- Apply in a few clicks and track every application from your dashboard.

We’re excited to be part of your journey.

— CareerStart Team`;

  return safeSendEmail({
    from: resendFrom,
    to,
    subject: 'Welcome to CareerStart',
    html,
    text,
  });
}

export async function sendApplicationReceivedEmail({ to, name, opportunityTitle }) {
  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>Thank you for submitting your application for <strong>${opportunityTitle}</strong>. We're excited to review it!</p>
    <p>We've successfully received all your documents, and we're genuinely impressed by your interest in this opportunity.</p>
    <p><strong>What happens next:</strong></p>
    <ul>
      <li><strong>Application Review:</strong> Our team will carefully evaluate your qualifications, experience, and potential fit</li>
      <li><strong>Timeline:</strong> You can expect an update within 7-10 business days</li>
      <li><strong>Real-time Tracking:</strong> Check your CareerStart dashboard anytime to see your application status</li>
      <li><strong>Stay Informed:</strong> We'll notify you via email about any updates or next steps</li>
    </ul>
    <p>In the meantime, feel free to explore other opportunities on CareerStart and continue building your profile. We'll be in touch soon!</p>
    <p>— The CareerStart Team</p>
  `;

  const text = `Hi ${name || 'there'},

Thank you for submitting your application for "${opportunityTitle}". We're excited to review it!

We've successfully received all your documents, and we're genuinely impressed by your interest in this opportunity.

What happens next:
- Application Review: Our team will carefully evaluate your qualifications, experience, and potential fit
- Timeline: You can expect an update within 7-10 business days
- Real-time Tracking: Check your CareerStart dashboard anytime to see your application status
- Stay Informed: We'll notify you via email about any updates or next steps

In the meantime, feel free to explore other opportunities on CareerStart and continue building your profile. We'll be in touch soon!

— The CareerStart Team`;

  return safeSendEmail({
    from: resendFrom,
    to,
    subject: `We've received your application for ${opportunityTitle} 📋`,
    html,
    text,
  });
}

export async function sendApplicationStatusChangedEmail({ to, name, opportunityTitle, status }) {
  const lowered = String(status || '').toLowerCase();
  let subject;
  let html;
  let text;

  if (lowered === 'shortlisted') {
    subject = `You've been shortlisted for ${opportunityTitle} 🎉`;
    html = `
      <p>Hi ${name || 'there'},</p>
      <p>Excellent news! 🎉 You've been <strong>SHORTLISTED</strong> for <strong>${opportunityTitle}</strong>.</p>
      <p>Your application stood out, and the hiring team is excited to learn more about you. Congratulations on reaching this milestone!</p>
      <p><strong>What's next:</strong></p>
      <ul>
        <li>You'll be invited for a virtual or in-person interview</li>
        <li>The hiring company or our team will send you interview details within the next 5-7 days</li>
        <li>We recommend reviewing the job description and preparing key talking points</li>
      </ul>
      <p>Keep an eye on your inbox and your CareerStart dashboard for all updates. You've got this!</p>
      <p>— The CareerStart Team</p>
    `;
    text = `Hi ${name || 'there'},

Excellent news! 🎉 You've been SHORTLISTED for "${opportunityTitle}".

Your application stood out, and the hiring team is excited to learn more about you. Congratulations on reaching this milestone!

What's next:
- You'll be invited for a virtual or in-person interview
- The hiring company or our team will send you interview details within the next 5-7 days
- We recommend reviewing the job description and preparing key talking points

Keep an eye on your inbox and your CareerStart dashboard for all updates. You've got this!

— The CareerStart Team`;
  } else if (lowered === 'accepted') {
    subject = `🎉 Congratulations! Your application for ${opportunityTitle} has been accepted`;
    html = `
      <p>Hi ${name || 'there'},</p>
      <p><strong>Congratulations! 🎉</strong> Your application for <strong>${opportunityTitle}</strong> has been <strong>ACCEPTED</strong>.</p>
      <p>This is fantastic news! We're thrilled to have you moving forward in this opportunity.</p>
      <p><strong>What happens next:</strong></p>
      <ul>
        <li>The hiring company or our team will reach out to you shortly with important details</li>
        <li>You'll receive information about onboarding, start date, and any additional requirements</li>
        <li>Be sure to check your email regularly and keep your phone accessible</li>
      </ul>
      <p>This is a big step in your career journey, and we're proud to be part of your success. Best of luck with your new opportunity!</p>
      <p>— The CareerStart Team</p>
    `;
    text = `Hi ${name || 'there'},

Congratulations! 🎉 Your application for "${opportunityTitle}" has been ACCEPTED.

This is fantastic news! We're thrilled to have you moving forward in this opportunity.

What happens next:
- The hiring company or our team will reach out to you shortly with important details
- You'll receive information about onboarding, start date, and any additional requirements
- Be sure to check your email regularly and keep your phone accessible

This is a big step in your career journey, and we're proud to be part of your success. Best of luck with your new opportunity!

— The CareerStart Team`;
  } else if (lowered === 'rejected') {
    subject = `Update on your application for ${opportunityTitle}`;
    html = `
      <p>Hi ${name || 'there'},</p>
      <p>Thank you sincerely for taking the time to apply for <strong>${opportunityTitle}</strong>. We truly appreciate your interest and effort.</p>
      <p>After a thorough review of all applications, we regret to inform you that your application was not selected for this particular role. We know this may be disappointing.</p>
      <p><strong>But please don't give up!</strong> Many highly successful professionals have faced rejection before landing their dream roles. Each application is valuable experience.</p>
      <p><strong>Keep exploring:</strong> Browse CareerStart for other roles that match your skills and interests. Your next breakthrough could be just around the corner!</p>
      <p>— The CareerStart Team</p>
    `;
    text = `Hi ${name || 'there'},

Thank you sincerely for taking the time to apply for "${opportunityTitle}". We truly appreciate your interest and effort.

After a thorough review of all applications, we regret to inform you that your application was not selected for this particular role. We know this is disappointing.

But please don't give up! Many highly successful professionals have faced rejection before landing their dream roles. Each application is valuable experience.

Keep exploring: Browse CareerStart for other roles that match your skills and interests. Your next breakthrough could be just around the corner!

— The CareerStart Team`;
  } else {
    subject = `Your application status changed: ${status}`;
    html = `
      <p>Hi ${name || 'there'},</p>
      <p>The status of your application for <strong>${opportunityTitle}</strong> has changed to <strong>${status}</strong>.</p>
      <p>Log in to your CareerStart dashboard for full details.</p>
      <p>— CareerStart Team</p>
    `;
    text = `Hi ${name || 'there'},

The status of your application for "${opportunityTitle}" has changed to: ${status}.

Log in to your CareerStart dashboard for full details.

— CareerStart Team`;
  }

  return safeSendEmail({
    from: resendFrom,
    to,
    subject,
    html,
    text,
  });
}

export async function sendAdminNewOpportunityEmail({ to, title, company }) {
  const html = `
    <p>New opportunity created on CareerStart.</p>
    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Company:</strong> ${company}</p>
  `;

  const text = `New opportunity created on CareerStart.

Title: ${title}
Company: ${company}`;

  return safeSendEmail({
    from: resendFrom,
    to,
    subject: `New opportunity posted: ${title}`,
    html,
    text,
  });
}

export async function sendAdminNewApplicationEmail({ to, opportunityTitle, applicantName, applicantEmail }) {
  const html = `
    <p>New application submitted on CareerStart.</p>
    <p><strong>Opportunity:</strong> ${opportunityTitle}</p>
    <p><strong>Applicant:</strong> ${applicantName} (${applicantEmail})</p>
  `;

  const text = `New application submitted on CareerStart.

Opportunity: ${opportunityTitle}
Applicant: ${applicantName} (${applicantEmail})`;

  return safeSendEmail({
    from: resendFrom,
    to,
    subject: `New application for ${opportunityTitle}`,
    html,
    text,
  });
}

export async function sendApplicationReminderEmail({ to, name, opportunityTitle, resumeUrl, dashboardUrl }) {
  const html = `
    <p>Hi ${name || 'there'},</p>
    <p>We noticed you started your application for <strong>${opportunityTitle}</strong> but haven't completed it yet.</p>
    <p>Don't miss this opportunity! Complete your application now to secure your spot. We want to help you land this role as quickly as possible.</p>
    <p style="margin: 20px 0;">
      <a href="${dashboardUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
        Continue Your Application
      </a>
    </p>
    <p><strong>Your resume:</strong> Ready (${resumeUrl ? 'Uploaded' : 'Pending'})</p>
    <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
    <p>— CareerStart Team</p>
  `;

  const text = `Hi ${name || 'there'},

We noticed you started your application for "${opportunityTitle}" but haven't completed it yet.

Don't miss this opportunity! Complete your application now to secure your spot. We want to help you land this role as quickly as possible.

Your resume: Ready (${resumeUrl ? 'Uploaded' : 'Pending'})

Continue your application here: ${dashboardUrl}

If you have any questions or need assistance, don't hesitate to reach out to our support team.

— CareerStart Team`;

  return safeSendEmail({
    from: resendFrom,
    to,
    subject: `Complete your application for ${opportunityTitle} — we're here to help`,
    html,
    text,
  });
}
