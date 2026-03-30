"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {
        // PWA support is progressive enhancement.
      });
  }, []);

  return null;
}