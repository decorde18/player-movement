"use client";

import { useState, Suspense } from "react";
import type { ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong");
      } else {
        setMessage("Password updated successfully. You can now login.");
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className='w-full max-w-md' shadow padding='lg' background='bg-surface'>
      <div className='text-center mb-8'>
        <h1 className='text-3xl font-bold text-text'>
          Create New Password
        </h1>
        <p className='text-muted mt-2'>
          Please enter your new password below.
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
          id='password'
          type='password'
          label='New Password'
          required
          placeholder='••••••••'
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPassword(e.target.value)
          }
        />

        <Input
          id='confirmPassword'
          type='password'
          label='Confirm Password'
          required
          placeholder='••••••••'
          value={confirmPassword}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setConfirmPassword(e.target.value)
          }
        />

        <Button
          type='submit'
          disabled={loading || !!message}
          className='w-full mt-2'
        >
          {loading ? "Updating..." : "Update Password"}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className='flex items-center justify-center min-h-screen bg-background text-text px-4'>
      <Suspense
        fallback={<div className='text-center p-8'>Loading form...</div>}
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
