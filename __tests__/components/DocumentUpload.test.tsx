import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentUpload } from "@/components/upload/DocumentUpload";

describe("DocumentUpload", () => {
  const defaultProps = {
    onImport: vi.fn().mockResolvedValue(undefined),
    isUploading: false,
    error: null as string | null,
    success: false,
    groups: [] as { id: string; name: string; userId: string; position: number; createdAt: string }[],
  };

  it("renders the upload zone", () => {
    render(<DocumentUpload {...defaultProps} />);
    expect(
      screen.getByLabelText(/upload.*document|drag.*drop/i)
    ).toBeInTheDocument();
  });

  it("contains a hidden file input accepting PDF and TXT", () => {
    const { container } = render(<DocumentUpload {...defaultProps} />);
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.accept).toContain(".pdf");
    expect(input.accept).toContain(".txt");
  });

  it("shows parsing state when a file is selected", () => {
    const { container } = render(<DocumentUpload {...defaultProps} />);

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });
    // Component enters parsing state for TXT files
    expect(screen.getByText(/extracting|parsing|preparing/i)).toBeInTheDocument();
  });

  it("shows loading state during upload", () => {
    render(<DocumentUpload {...defaultProps} isUploading />);
    expect(screen.getByText(/preparing|lumi/i)).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<DocumentUpload {...defaultProps} error="File too big!" />);
    expect(screen.getByText("File too big!")).toBeInTheDocument();
  });

  it("shows success state", () => {
    render(<DocumentUpload {...defaultProps} success />);
    expect(screen.getByText(/success|done|ready/i)).toBeInTheDocument();
  });
});
