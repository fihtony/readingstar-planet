"use client";

import { useState, useCallback } from "react";
import type { LetterConfusionConfig } from "@/types";

const DEFAULT_CONFIG: LetterConfusionConfig = {
  enabled: false,
  colorMap: {
    b: "letter-b",
    d: "letter-d",
    p: "letter-p",
    q: "letter-q",
  },
  showMnemonics: true,
  intensity: "high",
};

export function useLetterConfusion(
  initialConfig?: Partial<LetterConfusionConfig>
) {
  const [config, setConfig] = useState<LetterConfusionConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });

  const toggle = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const enable = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: true }));
  }, []);

  const disable = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: false }));
  }, []);

  const setIntensity = useCallback(
    (intensity: LetterConfusionConfig["intensity"]) => {
      setConfig((prev) => ({ ...prev, intensity }));
    },
    []
  );

  const setShowMnemonics = useCallback((show: boolean) => {
    setConfig((prev) => ({ ...prev, showMnemonics: show }));
  }, []);

  return {
    config,
    toggle,
    enable,
    disable,
    setIntensity,
    setShowMnemonics,
  };
}
