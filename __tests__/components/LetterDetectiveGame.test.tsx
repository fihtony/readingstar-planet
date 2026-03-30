import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LetterDetectiveGame } from "@/components/reading/LetterDetectiveGame";

describe("LetterDetectiveGame", () => {
  it("renders available target letters from the text", () => {
    render(<LetterDetectiveGame text="bad pig" onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "D" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "P" })).toBeInTheDocument();
  });

  it("marks letters and completes the challenge", () => {
    render(<LetterDetectiveGame text="bbb" onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /mark b at position 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark b at position 2/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark b at position 3/i }));

    expect(screen.getByText(/you found them all/i)).toBeInTheDocument();
  });
});