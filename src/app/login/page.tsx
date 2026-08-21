"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { signIn, signOut } from "next-auth/react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const devAutoSignIn = process.env.NEXT_PUBLIC_DEV_AUTO_SIGNIN === "true";

  useEffect(() => {
    async function attemptDevAutoSignIn() {
      if (devAutoSignIn) {
        await signOut({ redirect: false });
        const res = await signIn("credentials", { redirect: false });
        if (!res?.error) {
          router.push("/");
          return;
        }
      }
    }
    attemptDevAutoSignIn();
  }, [router, devAutoSignIn]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError("Invalid Email or Password");
      setLoading(false);
    } else {
      window.location.href = "/";
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
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-text'>Welcome Back</h1>
          <p className='text-muted mt-2'>
            Sign in to your account to continue
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

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <div />
              <Link
                href='/forgot-password'
                className='text-sm font-medium text-primary hover:text-accent transition-colors'
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id='password'
              type='password'
              label='Password'
              required
              placeholder='••••••••'
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
            />
          </div>

          <Button type='submit' disabled={loading} className='w-full mt-2'>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
