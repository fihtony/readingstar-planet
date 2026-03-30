"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

type IslandKey =
  | "island"
  | "bay"
  | "valley"
  | "harbor"
  | "blocks"
  | "beach"
  | "factory";

interface IslandDef {
  key: IslandKey;
  href: string;
  emoji: string;
  accent: string;
  available: boolean;
  zoneLeft: string;
  zoneTop: string;
  zoneWidth: string;
  zoneHeight: string;
  shape: string;
  labelLeft: string;
  labelTop: string;
  lockLeft?: string;
  lockTop?: string;
}

const ISLANDS: IslandDef[] = [
  {
    key: "blocks",
    href: "#",
    emoji: "🧩",
    accent: "#98dd73",
    available: false,
    zoneLeft: "29%",
    zoneTop: "7%",
    zoneWidth: "21%",
    zoneHeight: "25%",
    shape: "ellipse(49% 48% at 50% 50%)",
    labelLeft: "39%",
    labelTop: "3%",
    lockLeft: "39%",
    lockTop: "17%",
  },
  {
    key: "beach",
    href: "#",
    emoji: "✍️",
    accent: "#f2d47a",
    available: false,
    zoneLeft: "53.5%",
    zoneTop: "7%",
    zoneWidth: "22%",
    zoneHeight: "24%",
    shape: "ellipse(49% 48% at 50% 50%)",
    labelLeft: "64%",
    labelTop: "8%",
    lockLeft: "65%",
    lockTop: "17.5%",
  },
  {
    key: "factory",
    href: "#",
    emoji: "🏭",
    accent: "#9fdd61",
    available: false,
    zoneLeft: "75%",
    zoneTop: "13%",
    zoneWidth: "22%",
    zoneHeight: "32%",
    shape: "ellipse(49% 48% at 50% 50%)",
    labelLeft: "86%",
    labelTop: "15%",
    lockLeft: "85.5%",
    lockTop: "29%",
  },
  {
    key: "bay",
    href: "/letter-bay",
    emoji: "🔤",
    accent: "#ffe08a",
    available: true,
    zoneLeft: "0%",
    zoneTop: "20%",
    zoneWidth: "38%",
    zoneHeight: "64%",
    shape: "polygon(14% 5%, 42% 0%, 78% 4%, 94% 14%, 98% 30%, 96% 54%, 88% 72%, 72% 88%, 46% 95%, 22% 92%, 8% 80%, 2% 54%, 2% 22%)",
    labelLeft: "22%",
    labelTop: "50%",
  },
  {
    key: "island",
    href: "/spotlight",
    emoji: "🔦",
    accent: "#b8ea59",
    available: true,
    zoneLeft: "37%",
    zoneTop: "28%",
    zoneWidth: "34%",
    zoneHeight: "38%",
    shape: "ellipse(46% 44% at 50% 50%)",
    labelLeft: "56%",
    labelTop: "54%",
  },
  {
    key: "valley",
    href: "/echo-valley",
    emoji: "🔊",
    accent: "#b8ea59",
    available: true,
    zoneLeft: "22%",
    zoneTop: "60%",
    zoneWidth: "43%",
    zoneHeight: "43%",
    shape: "polygon(18% 4%, 50% 0%, 79% 6%, 95% 20%, 98% 42%, 91% 70%, 70% 90%, 41% 96%, 18% 90%, 5% 70%, 1% 42%, 6% 16%)",
    labelLeft: "40%",
    labelTop: "83%",
  },
  {
    key: "harbor",
    href: "/library",
    emoji: "📚",
    accent: "#b8ea59",
    available: true,
    zoneLeft: "66%",
    zoneTop: "45%",
    zoneWidth: "34%",
    zoneHeight: "58%",
    shape: "polygon(18% 2%, 55% 0%, 84% 6%, 95% 22%, 97% 48%, 92% 72%, 76% 92%, 46% 98%, 20% 92%, 6% 72%, 2% 44%, 7% 14%)",
    labelLeft: "77.5%",
    labelTop: "82.5%",
  },
];

export default function HomePage() {
  const map = useTranslations("map");
  const [activeKey, setActiveKey] = useState<IslandKey | null>(null);

  const handlePointerMove = useCallback((_: ReactPointerEvent<HTMLDivElement>) => {
    return;
  }, []);

  const resetScene = useCallback(() => {
    setActiveKey(null);
  }, []);

  return (
    <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1380px]">
        <div
          className="relative overflow-hidden rounded-[34px] border-[5px] border-[#efe2cb] bg-[#dcefff] shadow-[0_26px_80px_rgba(30,68,90,0.18)]"
          onPointerMove={handlePointerMove}
          onPointerLeave={resetScene}
          onPointerCancel={resetScene}
          style={{ aspectRatio: "1380 / 776" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(255,255,255,0.3),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(55,168,191,0.16),transparent_36%)]" />

          <div className="absolute inset-0">
            <Image
              src="/images/reading-homepage.png"
              alt={map("sceneLabel")}
              fill
              priority
              sizes="(max-width: 1400px) 100vw, 1380px"
              className="pointer-events-none select-none object-cover"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,33,68,0.08),transparent_20%,transparent_82%,rgba(8,37,48,0.14))]" />

          <div className="pointer-events-none absolute left-4 top-3 px-1 text-xs font-bold tracking-[0.12em] text-white/50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)] sm:text-sm">
            {map("sceneLabel")}
          </div>

          <div className="absolute inset-0">
            {ISLANDS.map((island) => (
              <IslandOverlay
                key={island.key}
                island={island}
                active={activeKey === island.key}
                title={map(island.key)}
                description={
                  island.key === "island"
                    ? map("islandDesc")
                    : island.key === "bay"
                      ? map("bayDesc")
                      : island.key === "valley"
                        ? map("valleyDesc")
                        : island.key === "harbor"
                          ? map("harborDesc")
                          : undefined
                }
                comingSoon={map("comingSoon")}
                onActivate={setActiveKey}
                onDeactivate={() => setActiveKey(null)}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes mapSparkle {
          0% { opacity: 0; transform: translateY(0) scale(0.4); }
          30% { opacity: 1; transform: translateY(-8px) scale(1); }
          100% { opacity: 0; transform: translateY(-24px) scale(0.6); }
        }

        @keyframes islandGlow {
          0%, 100% { opacity: 0.72; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function IslandOverlay({
  island,
  active,
  title,
  description,
  comingSoon,
  onActivate,
  onDeactivate,
}: {
  island: IslandDef;
  active: boolean;
  title: string;
  description?: string;
  comingSoon: string;
  onActivate: (key: IslandKey) => void;
  onDeactivate: () => void;
}) {
  const {
    key,
    href,
    emoji,
    accent,
    available,
    zoneLeft,
    zoneTop,
    zoneWidth,
    zoneHeight,
    shape,
    labelLeft,
    labelTop,
    lockLeft,
    lockTop,
  } = island;

  const zoneStyle: CSSProperties = {
    left: zoneLeft,
    top: zoneTop,
    width: zoneWidth,
    height: zoneHeight,
    clipPath: shape,
    background: active
      ? `radial-gradient(circle at 50% 52%, rgba(255,255,255,0.22) 0%, ${accent}5f 28%, ${accent}36 56%, transparent 84%)`
      : "transparent",
    boxShadow: active
      ? `inset 0 0 0 2px rgba(255,255,255,0.76), 0 0 26px 8px ${accent}60`
      : "none",
    transform: active ? "scale(1.015)" : "scale(1)",
    filter: !available && !active ? "grayscale(0.18) brightness(0.94)" : "none",
    transition: "all 220ms ease",
  };

  const glowStyle: CSSProperties = {
    left: zoneLeft,
    top: zoneTop,
    width: zoneWidth,
    height: zoneHeight,
    background: `radial-gradient(circle at 50% 50%, ${accent}58 0%, ${accent}22 45%, transparent 76%)`,
    transform: active ? "scale(1.08)" : "scale(0.94)",
    opacity: active ? 1 : 0,
    transition: "all 220ms ease",
    filter: "blur(20px)",
  };

  const labelCardStyle: CSSProperties = {
    transform: active ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
    background: active
      ? "linear-gradient(180deg, rgba(255,236,167,0.98), rgba(245,212,112,0.96))"
      : "linear-gradient(180deg, rgba(255,234,156,0.96), rgba(244,206,99,0.93))",
    borderColor: active ? "#866422" : "#9a7730",
    boxShadow: active
      ? `0 8px 0 rgba(133,102,36,0.35), 0 16px 30px rgba(32,57,85,0.2), 0 0 0 2px ${accent}35`
      : "0 6px 0 rgba(133,102,36,0.28), 0 12px 24px rgba(32,57,85,0.12)",
    transition: "all 220ms ease",
  };

  const labelCard = (
    <div
      className="rounded-[10px] border-[2px] px-2 py-1 text-slate-700"
      style={labelCardStyle}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="shrink-0 text-lg leading-none"
          style={{ filter: !available ? "grayscale(0.35)" : "none" }}
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="whitespace-nowrap text-[0.62rem] font-black leading-tight text-[#5a4717] sm:text-[0.72rem]">
            {title}
          </div>
          {available && description ? (
            <div className="mt-0.5 max-w-[9rem] text-[0.42rem] font-bold leading-tight text-[#6d5a2a] sm:text-[0.5rem]">
              {description}
            </div>
          ) : null}
          {!available ? (
            <div className="mt-0.5 text-[0.48rem] font-black uppercase tracking-[0.1em] text-[#9a8652]">
              {comingSoon}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="pointer-events-none absolute rounded-full" style={glowStyle} />

      {!available && lockLeft && lockTop ? (
        <div
          className="pointer-events-none absolute z-20 flex items-center justify-center"
          style={{
            left: lockLeft,
            top: lockTop,
            transform: active ? "translate(-50%, -50%) scale(1.12)" : "translate(-50%, -50%) scale(1)",
            transition: "all 220ms ease",
          }}
        >
          <svg width="28" height="33" viewBox="0 0 15 18" fill="none" aria-hidden="true">
            <path d="M3.5 7.5V5C3.5 2.791 5.291 1 7.5 1C9.709 1 11.5 2.791 11.5 5V7.5" stroke="rgba(160,160,175,0.9)" strokeWidth="2.2" strokeLinecap="round"/>
            <rect x="1" y="7.5" width="13" height="10" rx="2.5" fill="rgba(140,140,158,0.85)"/>
            <circle cx="7.5" cy="12.5" r="1.7" fill="rgba(80,80,100,0.7)"/>
          </svg>
        </div>
      ) : null}

      {available ? (
        <Link
          href={href}
          aria-label={title}
          onMouseEnter={() => onActivate(key)}
          onFocus={() => onActivate(key)}
          onMouseLeave={onDeactivate}
          onBlur={onDeactivate}
          className="pointer-events-auto absolute z-10"
          style={zoneStyle}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${title} (${comingSoon})`}
          aria-disabled="true"
          onMouseEnter={() => onActivate(key)}
          onFocus={() => onActivate(key)}
          onMouseLeave={onDeactivate}
          onBlur={onDeactivate}
          className="pointer-events-auto absolute z-10"
          style={zoneStyle}
        />
      )}

      {available ? (
        <Link
          href={href}
          aria-label={title}
          onMouseEnter={() => onActivate(key)}
          onFocus={() => onActivate(key)}
          onMouseLeave={onDeactivate}
          onBlur={onDeactivate}
          className="pointer-events-auto absolute z-20"
          style={{ left: labelLeft, top: labelTop, transform: "translate(-50%, -50%)" }}
        >
          {labelCard}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={`${title} (${comingSoon})`}
          onMouseEnter={() => onActivate(key)}
          onFocus={() => onActivate(key)}
          onMouseLeave={onDeactivate}
          onBlur={onDeactivate}
          className="pointer-events-auto absolute z-20 bg-transparent"
          style={{ left: labelLeft, top: labelTop, transform: "translate(-50%, -50%)" }}
        >
          {labelCard}
        </button>
      )}

      {active ? (
        <>
          {[0, 1, 2, 3].map((sparkle) => (
            <span
              key={sparkle}
              className="pointer-events-none absolute z-10 text-sm"
              style={{
                left: `calc(${zoneLeft} + ${zoneWidth} * ${0.22 + sparkle * 0.16})`,
                top: `calc(${zoneTop} + ${zoneHeight} * 0.22)`,
                animation: `mapSparkle 1.15s ease-out ${sparkle * 0.14}s infinite`,
              }}
            >
              ✨
            </span>
          ))}
          <div
            className="pointer-events-none absolute border border-white/60"
            style={{
              left: zoneLeft,
              top: zoneTop,
              width: zoneWidth,
              height: zoneHeight,
              clipPath: shape,
              animation: "islandGlow 1.8s ease-in-out infinite",
            }}
          />
        </>
      ) : null}
    </div>
  );
}