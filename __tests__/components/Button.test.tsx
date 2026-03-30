import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders with text content", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();
  });

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders primary variant by default", () => {
    const { container } = render(<Button>Primary</Button>);
    const btn = container.querySelector("button");
    expect(btn?.className).toMatch(/bg-/);
  });

  it("supports secondary variant", () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("supports ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("supports different sizes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("can be disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("supports aria-label", () => {
    render(<Button aria-label="Close dialog">✕</Button>);
    expect(screen.getByLabelText("Close dialog")).toBeInTheDocument();
  });
});
