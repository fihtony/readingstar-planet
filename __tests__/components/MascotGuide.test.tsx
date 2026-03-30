import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MascotGuide } from "@/components/mascot/MascotGuide";

describe("MascotGuide", () => {
  it("renders the mascot with a message", () => {
    render(<MascotGuide message="Hello friend!" mood="happy" />);
    expect(screen.getByText("Hello friend!")).toBeInTheDocument();
  });

  it("displays different moods", () => {
    const { container, rerender } = render(
      <MascotGuide message="test" mood="happy" />
    );

    // Lumi owl emoji should be present
    expect(container.textContent).toContain("🦉");

    rerender(<MascotGuide message="yay!" mood="celebrating" />);
    expect(screen.getByText("yay!")).toBeInTheDocument();
  });

  it("can be dismissed when dismissible", () => {
    render(
      <MascotGuide message="Go away!" mood="happy" dismissible />
    );

    // Should find a dismiss/close button
    const dismissBtn = screen.getByLabelText(/dismiss|close/i);
    fireEvent.click(dismissBtn);

    // Message should no longer be visible
    expect(screen.queryByText("Go away!")).not.toBeInTheDocument();
  });

  it("cannot be dismissed when not dismissible", () => {
    render(
      <MascotGuide message="Stay here!" mood="happy" dismissible={false} />
    );

    expect(screen.queryByLabelText(/dismiss|close/i)).not.toBeInTheDocument();
  });
});
