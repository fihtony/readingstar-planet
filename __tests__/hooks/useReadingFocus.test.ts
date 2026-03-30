import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReadingFocus } from "@/hooks/useReadingFocus";

describe("useReadingFocus", () => {
  const totalLines = 10;

  it("initializes at line 0", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));
    expect(result.current.currentLine).toBe(0);
  });

  it("navigates to next line", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.nextLine());
    expect(result.current.currentLine).toBe(1);

    act(() => result.current.nextLine());
    expect(result.current.currentLine).toBe(2);
  });

  it("navigates to previous line", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.goToLine(5));
    act(() => result.current.prevLine());
    expect(result.current.currentLine).toBe(4);
  });

  it("does not go below 0", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.prevLine());
    expect(result.current.currentLine).toBe(0);
  });

  it("does not go past last line", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.goToLine(9));
    act(() => result.current.nextLine());
    expect(result.current.currentLine).toBe(9);
  });

  it("goToLine jumps to specific line", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.goToLine(7));
    expect(result.current.currentLine).toBe(7);
  });

  it("clamps goToLine to valid range", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.goToLine(999));
    expect(result.current.currentLine).toBe(9);

    act(() => result.current.goToLine(-5));
    expect(result.current.currentLine).toBe(0);
  });

  it("changes focus mode", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.setMode("karaoke"));
    expect(result.current.mode).toBe("karaoke");

    act(() => result.current.setMode("sliding-window"));
    expect(result.current.mode).toBe("sliding-window");
  });

  it("changes theme", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.setTheme("magnifier"));
    expect(result.current.theme).toBe("magnifier");
  });

  it("changes mask opacity", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.setMaskOpacity(0.5));
    expect(result.current.maskOpacity).toBe(0.5);
  });

  it("isAtStart and isAtEnd work", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    expect(result.current.isAtStart).toBe(true);
    expect(result.current.isAtEnd).toBe(false);

    act(() => result.current.goToLine(9));
    expect(result.current.isAtStart).toBe(false);
    expect(result.current.isAtEnd).toBe(true);
  });

  it("isLineFocused returns true only for current line", () => {
    const { result } = renderHook(() => useReadingFocus({ totalLines }));

    act(() => result.current.goToLine(3));
    expect(result.current.isLineFocused(3)).toBe(true);
    expect(result.current.isLineFocused(2)).toBe(false);
    expect(result.current.isLineFocused(4)).toBe(false);
  });
});
