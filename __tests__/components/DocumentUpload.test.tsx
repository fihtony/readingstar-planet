import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentUpload } from "@/components/upload/DocumentUpload";

describe("DocumentUpload", () => {
  const defaultProps = {
    onUpload: vi.fn(),
    isUploading: false,
    error: null as string | null,
    success: false,
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

  it("calls onUpload when a file is selected", () => {
    const onUpload = vi.fn();
    const { container } = render(
      <DocumentUpload {...defaultProps} onUpload={onUpload} />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["content"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
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
