"use client"

import Button from "@/components/ui/Button"
import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application Error Captured:", error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--background)] p-4 text-center">
      <div className="max-w-md space-y-6">
        <h2 className="text-4xl font-bold tracking-tight text-[var(--destructive)]">Something went wrong!</h2>
        <p className="text-[var(--muted-foreground)]">
          An unexpected error has occurred in the application. Our technical team has been notified.
        </p>
        <div className="flex justify-center gap-4">
          <Button
           variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
          <Button variant="default" onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}
