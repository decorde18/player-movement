import nodemailer from 'nodemailer';

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  // Use a fallback or console mock if DEV and BYPASS are active
  if (process.env.AUTH_BYPASS_ENABLED === "true") {
      console.log("-----------------------------------------");
      console.log(`[DUMMY EMAIL] Password reset requested for: ${email}`);
      console.log(`[DUMMY EMAIL] Reset Link: ${resetLink}`);
      console.log("-----------------------------------------");
      return { success: true, message: "Email mocked in console" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL || 'noreply@example.com',
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the link below to verify.</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: 'Could not send email' };
  }
}
