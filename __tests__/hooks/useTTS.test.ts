import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTTS } from "@/hooks/useTTS";

describe("useTTS", () => {
  it("initializes in non-playing state", () => {
    const { result } = renderHook(() => useTTS({}));
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentWordIndex).toBe(-1);
    expect(result.current.speed).toBe(0.8);
  });

  it("reports speech synthesis support", () => {
    const { result } = renderHook(() => useTTS({}));
    // We mocked speechSynthesis in setup.ts
    expect(result.current.isSupported).toBe(true);
  });

  it("sets speed", () => {
    const { result } = renderHook(() => useTTS({}));

    act(() => result.current.setSpeed(0.75));
    expect(result.current.speed).toBe(0.75);
  });

  it("calls speechSynthesis.cancel on stop", () => {
    const { result } = renderHook(() => useTTS({}));

    // First speak, then stop
    act(() => result.current.speak("Hello world", ["Hello", "world"]));
    act(() => result.current.stop());

    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
  });

  it("calls speechSynthesis.speak on play", () => {
    const { result } = renderHook(() => useTTS({}));

    act(() => result.current.speak("Hello", ["Hello"]));
    expect(speechSynthesis.speak).toHaveBeenCalled();
  });
});
