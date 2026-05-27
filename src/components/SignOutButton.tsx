"use client";

import React from "react";
import { signOut } from "next-auth/react";
import Button from "@/components/ui/Button";

export default function SignOutButton() {
  return (
    <Button
      variant='outline'
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}
