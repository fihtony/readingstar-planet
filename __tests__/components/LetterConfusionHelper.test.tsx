import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LetterConfusionHelper } from "@/components/reading/LetterConfusionHelper";
import type { LetterConfusionConfig } from "@/types";

const defaultConfig: LetterConfusionConfig = {
  enabled: true,
  colorMap: { b: "letter-b", d: "letter-d", p: "letter-p", q: "letter-q" },
  intensity: "high",
  showMnemonics: true,
};

describe("LetterConfusionHelper", () => {
  it("renders text with colored confusable letters", () => {
    const { container } = render(
      <LetterConfusionHelper text="bad dog" config={defaultConfig} />
    );

    // 'b' and 'd' should be specially styled with role="mark"
    const coloredSpans = container.querySelectorAll('[role="mark"]');
    expect(coloredSpans.length).toBeGreaterThanOrEqual(3); // b, d, d
  });

  it("reconstructs the full text from segments", () => {
    const { container } = render(
      <LetterConfusionHelper text="the bed is red" config={defaultConfig} />
    );

    expect(container.textContent).toContain("the bed is red");
  });

  it("renders plain text when disabled", () => {
    const disabledConfig: LetterConfusionConfig = {
      enabled: false,
      colorMap: { b: "letter-b", d: "letter-d", p: "letter-p", q: "letter-q" },
      intensity: "high",
      showMnemonics: false,
    };

    const { container } = render(
      <LetterConfusionHelper text="bad" config={disabledConfig} />
    );

    // Should still render, but without confusable markers
    expect(container.textContent).toBe("bad");
  });

  it("handles text with no confusable letters", () => {
    const { container } = render(
      <LetterConfusionHelper text="cat hat" config={defaultConfig} />
    );

    const confusables = container.querySelectorAll('[role="mark"]');
    expect(confusables).toHaveLength(0);
    expect(container.textContent).toBe("cat hat");
  });

  it("handles empty text", () => {
    const { container } = render(
      <LetterConfusionHelper text="" config={defaultConfig} />
    );
    expect(container.textContent).toBe("");
  });

  it("renders all four confusable letters (b, d, p, q)", () => {
    const { container } = render(
      <LetterConfusionHelper text="b d p q" config={defaultConfig} />
    );

    const confusables = container.querySelectorAll('[role="mark"]');
    expect(confusables).toHaveLength(4);
  });

  it("keeps highlighted letters in the inline text flow", () => {
    const { container } = render(
      <LetterConfusionHelper text="understand problem" config={defaultConfig} />
    );

    const confusables = container.querySelectorAll('[role="mark"]');
    confusables.forEach((node) => {
      expect(node).toHaveStyle({ display: "inline" });
      expect(node).toHaveStyle({ fontSize: "1em" });
      expect(node).toHaveStyle({ verticalAlign: "baseline" });
    });
  });
});
