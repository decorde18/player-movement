import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });
    if (!user) {
      // Return 200 even if not found to prevent email enumeration attacks
      return NextResponse.json({ message: 'If that email is in our system, we have sent a reset link to it.' }, { status: 200 });
    }

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Token expires in 1 hour
    const tokenExpiry = new Date(Date.now() + 3600000); 

    // Store token in database
    await db.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry: tokenExpiry,
      },
    });

    // Send the email
    const emailResponse = await sendPasswordResetEmail(email, resetToken);
    
    if (!emailResponse.success) {
       return NextResponse.json({ message: 'Failed to send reset email. Please try again later.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'If that email is in our system, we have sent a reset link to it.' }, { status: 200 });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: 'Something went wrong' }, { status: 500 });
  }
}
