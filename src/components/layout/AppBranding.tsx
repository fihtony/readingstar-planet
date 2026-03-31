import Image from "next/image";
import type { CSSProperties } from "react";
import { Frijole } from "next/font/google";

const frijole = Frijole({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const LETTER_D_COLOR = "#FF8C42";
const LETTER_P_COLOR = "#9B8EC2";

export const APP_BACKGROUND_IMAGE_SRC = "/images/reading_homepage_dark.png?v=20260330-1";

export const APP_VIEWPORT_STYLE: CSSProperties = {
  background:
    "radial-gradient(circle at 50% 0%, rgba(72, 126, 194, 0.22), transparent 28%), linear-gradient(180deg, #1d3266 0%, #23477c 38%, #2c63a0 72%, #244c83 100%)",
};

export const APP_WORDMARK_STYLE: CSSProperties = {
  fontSize: "clamp(14px, 1.42vw, 22px)",
  lineHeight: 1.14,
  letterSpacing: "0.03em",
};

const APP_WORDMARK_BASE_COLOR = "rgba(232, 226, 205, 0.68)";
const APP_WORDMARK_SHADOW = "0 1px 8px rgba(52, 42, 20, 0.18)";
const APP_WORDMARK_TRANSFORMS = ["translateY(0px)", "translateY(-1px)", "translateY(1px)"] as const;

function renderWordmark(text: string) {
  return text.split("").map((char, index) => {
    const lower = char.toLowerCase();
    const isD = lower === "d";
    const isP = lower === "p";

    return (
      <span
        key={`${char}-${index}`}
        style={{
          color: isD ? LETTER_D_COLOR : isP ? LETTER_P_COLOR : APP_WORDMARK_BASE_COLOR,
          display: "inline-block",
          fontWeight: isD || isP ? 700 : undefined,
          transform:
            char === " " ? undefined : APP_WORDMARK_TRANSFORMS[index % APP_WORDMARK_TRANSFORMS.length],
          textShadow: isD || isP
            ? `0 0 8px ${isD ? LETTER_D_COLOR : LETTER_P_COLOR}44`
            : APP_WORDMARK_SHADOW,
        }}
      >
        {char === " " ? "\u00A0" : char}
      </span>
    );
  });
}

export function AppWordmark({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`${frijole.className} ${className}`.trim()}
      style={{
        ...APP_WORDMARK_STYLE,
        ...style,
      }}
    >
      {renderWordmark("ReadingStar Planet")}
    </span>
  );
}

export function AppSceneBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={APP_VIEWPORT_STYLE}
    >
      <Image
        src={APP_BACKGROUND_IMAGE_SRC}
        alt=""
        fill
        sizes="100vw"
        className="select-none object-cover blur-[6px] scale-105 brightness-[0.55]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b2144]/60 via-transparent to-[#08252f]/50" />
    </div>
  );
}