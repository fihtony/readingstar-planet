"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

const BREAK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface BreakReminderProps {
  /** Whether the user is actively reading */
  active: boolean;
}

export function BreakReminder({ active }: BreakReminderProps) {
  const [showReminder, setShowReminder] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const dismiss = useCallback(() => {
    setShowReminder(false);
    setElapsed(0);
  }, []);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1000;
        if (next >= BREAK_INTERVAL_MS) {
          setShowReminder(true);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active]);

  if (!showReminder) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label="Break time reminder"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl text-center">
        <div className="text-6xl mb-4">🦉💤</div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-sky-blue)" }}
        >
          Time for a Break!
        </h2>
        <p className="text-gray-600 mb-2">
          You&apos;ve been reading for 15 minutes. Great effort!
        </p>
        <p className="text-gray-500 text-sm mb-6">
          Let&apos;s rest our eyes. Try looking at something far away for 20 seconds! 👀
        </p>
        <div className="mb-6 text-4xl animate-bounce">🌈</div>
        <Button onClick={dismiss}>
          I&apos;m Ready to Continue! 💪
        </Button>
      </div>
    </div>
  );
}
