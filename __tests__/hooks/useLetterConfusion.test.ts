import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLetterConfusion } from "@/hooks/useLetterConfusion";

describe("useLetterConfusion", () => {
  it("initializes with default config", () => {
    const { result } = renderHook(() => useLetterConfusion());
    expect(result.current.config.enabled).toBe(false);
    expect(result.current.config.intensity).toBe("high");
    expect(result.current.config.showMnemonics).toBe(true);
  });

  it("toggles enabled state", () => {
    const { result } = renderHook(() => useLetterConfusion());

    act(() => result.current.toggle());
    expect(result.current.config.enabled).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.config.enabled).toBe(false);
  });

  it("enables and disables explicitly", () => {
    const { result } = renderHook(() => useLetterConfusion());

    act(() => result.current.enable());
    expect(result.current.config.enabled).toBe(true);

    act(() => result.current.disable());
    expect(result.current.config.enabled).toBe(false);
  });

  it("changes intensity", () => {
    const { result } = renderHook(() => useLetterConfusion());

    act(() => result.current.setIntensity("medium"));
    expect(result.current.config.intensity).toBe("medium");

    act(() => result.current.setIntensity("low"));
    expect(result.current.config.intensity).toBe("low");
  });

  it("toggles mnemonics", () => {
    const { result } = renderHook(() => useLetterConfusion());

    act(() => result.current.setShowMnemonics(false));
    expect(result.current.config.showMnemonics).toBe(false);

    act(() => result.current.setShowMnemonics(true));
    expect(result.current.config.showMnemonics).toBe(true);
  });
});
