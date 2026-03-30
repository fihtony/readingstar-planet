import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TTSCompanion, TTSHighlightedText } from "@/components/reading/TTSCompanion";

describe("TTSCompanion", () => {
  const defaultProps = {
    isPlaying: false,
    isPaused: false,
    currentWordIndex: -1,
    speed: 1,
    isSupported: true,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onSpeedChange: vi.fn(),
    text: "Hello world",
  };

  it("renders play button when not playing", () => {
    render(<TTSCompanion {...defaultProps} />);
    expect(screen.getByRole("button", { name: /read to me/i })).toBeInTheDocument();
  });

  it("renders pause button when playing", () => {
    render(<TTSCompanion {...defaultProps} isPlaying isPaused={false} />);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("calls onPlay when play button is clicked", () => {
    const onPlay = vi.fn();
    render(<TTSCompanion {...defaultProps} onPlay={onPlay} />);

    fireEvent.click(screen.getByRole("button", { name: /read to me/i }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("calls onStop when stop button is clicked during playback", () => {
    const onStop = vi.fn();
    render(<TTSCompanion {...defaultProps} isPlaying onStop={onStop} />);

    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalled();
  });

  it("shows speed selector", () => {
    render(<TTSCompanion {...defaultProps} />);
    const speedControl = screen.getByLabelText(/speed/i);
    expect(speedControl).toBeInTheDocument();
  });

  it("shows 'not supported' message when speech not available", () => {
    render(<TTSCompanion {...defaultProps} isSupported={false} />);
    expect(screen.getByText(/not supported/i)).toBeInTheDocument();
  });
});

describe("TTSHighlightedText", () => {
  it("renders all words", () => {
    render(
      <TTSHighlightedText
        words={["Hello", "world"]}
        currentWordIndex={0}
        isPlaying
      />
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
  });

  it("highlights the current word", () => {
    const { container } = render(
      <TTSHighlightedText
        words={["Hello", "world"]}
        currentWordIndex={1}
        isPlaying
      />
    );

    const highlighted = container.querySelector(".tts-word-active");
    expect(highlighted).toHaveTextContent("world");
  });

  it("highlights nothing when not playing", () => {
    const { container } = render(
      <TTSHighlightedText
        words={["Hello", "world"]}
        currentWordIndex={0}
        isPlaying={false}
      />
    );

    const highlighted = container.querySelector(".tts-word-active");
    expect(highlighted).toBeNull();
  });
});
