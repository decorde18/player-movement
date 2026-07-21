"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Construction, ArrowLeft, Home, type LucideIcon } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PlannedFeature {
  label: string;
  icon?: LucideIcon;
}

interface ToBeCreatedProps {
  title?: string;
  description?: string;
  /** Optional — only shown if you pass at least one feature. Leave it out entirely for a plain "coming soon" state. */
  plannedFeatures?: PlannedFeature[];
  /** Where "Go Back" should land if there's no browser history (e.g. someone opened this page directly) */
  fallbackHref?: string;
}

export default function ToBeCreated({
  title = "Coming Soon",
  description = "This page is currently under development. Our team is building something amazing here. Please check back later!",
  plannedFeatures,
  fallbackHref = "/",
}: ToBeCreatedProps) {
  const router = useRouter();

  const handleBack = () => {
    // If the user landed here directly (no history), router.back() silently
    // no-ops and they get stuck. Fall back to a known route instead.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <div className="relative flex min-h-[70vh] w-full flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Background radial soft light — now positioned relative to this wrapper, not the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden opacity-30"
      >
        <div className="h-[400px] w-[400px] rounded-full bg-primary/20 blur-[80px]" />
      </div>

      <Card
        variant="default"
        padding="lg"
        shadow={true}
        className="relative w-full max-w-md overflow-hidden border-border/80 bg-surface/60 text-center backdrop-blur-xl"
      >
        {/* Animated accent border top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-accent to-purple motion-safe:animate-pulse" />

        {/* Icon Sphere */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
          <div className="absolute inset-0 rounded-3xl bg-primary/5 motion-safe:animate-ping opacity-75" />
          <Construction size={40} className="relative z-10 motion-safe:animate-bounce" />
        </div>

        {/* Heading & Text */}
        <h1 className="mb-2 bg-gradient-to-r from-text via-primary to-accent bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
          {title}
        </h1>

        <p className="mx-auto mb-8 max-w-sm text-base leading-relaxed text-muted/90">
          {description}
        </p>

        {/* Optional planned-features list — only renders if you pass some in */}
        {plannedFeatures && plannedFeatures.length > 0 && (
          <div className="mb-8 space-y-3 rounded-xl border border-border/60 bg-background/50 p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                What&apos;s coming:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-text/80">
              {plannedFeatures.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  {Icon && <Icon size={14} className="shrink-0 text-primary" />}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="outline"
            size="md"
            onClick={handleBack}
            className="flex w-full flex-row items-center gap-2 px-4 py-2.5 sm:w-auto"
          >
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </Button>

          <Link href={fallbackHref} className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              className="flex w-full flex-row items-center gap-2 px-4 py-2.5"
            >
              <Home size={16} />
              <span>Return Home</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}