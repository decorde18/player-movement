# My App — Starter Shell

This repository is a Next.js app skeleton with authentication, role helpers, and UI primitives wired together for quick app starts.

## Features

- NextAuth credentials provider (bcrypt password checks)
- Server and client auth helpers (`getServerAuthSession`, `useRequireAuth`, `requireServerSession`)
- Role constants and server guards
- Route protection middleware example (`/admin`, `/dashboard`, `/protected`)
- Password reset flow (`/forgot-password`, `/reset-password`)
- Simple API proxy endpoint (`/api/proxy`) template
- Shared UI components and consistent theming

## Environment Variables

Create a `.env.local` with the following keys (example values):

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-secret

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=myapp

# Optional: where to forward proxy requests
PROXY_TARGET=https://api.example.com

# Nodemailer SMTP for password reset emails
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=your-smtp-password

# Dev helper
NEXT_PUBLIC_DEV_AUTO_SIGNIN=false
```

## Database notes

- The auth logic expects a `users` table with at least: `id`, `email`, `name`, `password_hash`, `reset_token`, `reset_token_expiry`, `roles` (JSON).
- Passwords are hashed with `bcryptjs`. The `reset-password` API hashes new passwords into `password_hash`.

## Scripts

Install and run:

```bash
npm install
npm run dev
```

## Protecting routes

- Use `requireServerSession()` in server components/pages to enforce authentication server-side.
- Use `useRequireAuth()` in client components/pages to guard client-side navigation and UI.
- Middleware demonstrates route-level protection and a simple admin check.

## Next steps

- Add DB migrations to create the `users` table and seed data.
- Add role assignment UI and admin pages.
- Swap any remaining UI controls to use shared components for full visual parity.
  This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
