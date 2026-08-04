"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-background text-text px-4'>
      <Card
        className='w-full max-w-md'
        shadow
        padding='lg'
        background='bg-surface'
      >
        <Link
          href='/login'
          className='inline-flex items-center text-sm font-medium text-muted hover:text-text mb-6 transition-colors'
        >
          <ArrowLeft className='w-4 h-4 mr-2' /> Back to login
        </Link>

        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-text'>Reset Password</h1>
          <p className='text-muted mt-2'>
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {error && (
          <div
            className='p-4 mb-6 text-sm text-danger rounded-lg bg-danger/10 border border-danger/20'
            role='alert'
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className='p-4 mb-6 text-sm text-success rounded-lg bg-success/10 border border-success/20'
            role='alert'
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-5'>
          <Input
            id='email'
            type='email'
            label='Email'
            required
            placeholder='user@example.com'
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
          />

          <Button
            type='submit'
            disabled={loading || !!message}
            className='w-full mt-2'
          >
            {loading ? "Sending link..." : "Send Reset Link"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
