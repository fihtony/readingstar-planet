import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReadingFocusMode } from "@/components/reading/ReadingFocusMode";

const lines = [
  "The quick brown fox jumps over the lazy dog.",
  "A wonderful day to read some books!",
  "Letters are friends that make up words.",
];

describe("ReadingFocusMode", () => {
  it("renders all lines", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={0}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 0}
        onLineClick={() => {}}
      />
    );

    lines.forEach((line) => {
      expect(screen.getByText(line)).toBeInTheDocument();
    });
  });

  it("marks the current line as focused", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={1}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 1}
        onLineClick={() => {}}
      />
    );

    const focusedLine = screen.getByText(lines[1]).closest("[data-line-index]");
    expect(focusedLine).toHaveAttribute("data-focused", "true");
  });

  it("calls onLineClick when a line is clicked", () => {
    const onLineClick = vi.fn();

    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={0}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 0}
        onLineClick={onLineClick}
      />
    );

    fireEvent.click(screen.getByText(lines[2]));
    expect(onLineClick).toHaveBeenCalledWith(2);
  });

  it("uses custom renderLine when provided", () => {
    render(
      <ReadingFocusMode
        lines={["hello world"]}
        currentLine={0}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={() => true}
        onLineClick={() => {}}
        renderLine={(line) => <strong data-testid="custom">{line.toUpperCase()}</strong>}
      />
    );

    expect(screen.getByTestId("custom")).toHaveTextContent("HELLO WORLD");
  });

  it("hides lines that are not visible", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={0}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={(i) => i === 0}
        isLineFocused={(i) => i === 0}
        onLineClick={() => {}}
      />
    );

    // Line 0 should be fully visible
    const line0 = screen.getByText(lines[0]).closest("[data-line-index]");
    expect(line0).toHaveAttribute("data-visible", "true");

    // Line 1 should not be visible
    const line1 = screen.getByText(lines[1]).closest("[data-line-index]");
    expect(line1).toHaveAttribute("data-visible", "false");
  });

  it("shows progress counter", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={1}
        mode="single-line"
        theme="flashlight"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 1}
        onLineClick={() => {}}
      />
    );

    // Should show "2 / 3" somewhere
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();
  });

  it("applies distinct magnifier theme styling to focused paragraph", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={0}
        mode="single-line"
        theme="magnifier"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 0}
        onLineClick={() => {}}
      />
    );

    const readingArea = screen.getByRole("article", { name: "Reading area" });
    const focusedSpan = screen.getByText(lines[0]).closest("[data-line-index]");
    const paragraphDiv = focusedSpan?.closest("[data-paragraph]");

    expect(readingArea).toHaveAttribute("data-theme", "magnifier");
    expect(paragraphDiv).toHaveStyle({ transform: "scale(1.02)" });
    expect(focusedSpan).toHaveStyle({ background: "rgba(186, 230, 253, 0.38)" });
  });

  it("applies distinct magic wand theme styling to focused paragraph", () => {
    render(
      <ReadingFocusMode
        lines={lines}
        currentLine={1}
        mode="single-line"
        theme="magic-wand"
        maskOpacity={0.7}
        fontSize={18}
        lineSpacing={1.8}
        isLineVisible={() => true}
        isLineFocused={(i) => i === 1}
        onLineClick={() => {}}
      />
    );

    const focusedSpan = screen.getByText(lines[1]).closest("[data-line-index]");
    const paragraphDiv = focusedSpan?.closest("[data-paragraph]");
    expect(paragraphDiv).toHaveStyle({ transform: "translateY(-1px)" });
    expect(focusedSpan?.getAttribute("style")).toContain("linear-gradient(90deg");
  });
});
