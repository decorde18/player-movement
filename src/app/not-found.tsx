"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <main className='flex h-screen flex-col items-center justify-center bg-gray-100 text-center px-4'>
      <h1 className='text-6xl font-bold text-gray-800'>404</h1>
      <p className='mt-4 text-xl text-gray-600'>Page not found</p>
      <p className='mt-2 text-gray-500'>
        Sorry, we couldn’t find the page you were looking for.
      </p>
      <Link
        href='/'
        className='mt-6 inline-block rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 transition'
      >
        Go back home
      </Link>
    </main>
  );
}

