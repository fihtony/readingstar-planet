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
    lockLeft: "41%",
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

const HOME_TITLE_STYLE: CSSProperties = {
  left: "0.8%",
  top: "0.6%",
  fontSize: "clamp(14px, 1.45vw, 22px)",
};

const SETTINGS_ICON_STYLE: CSSProperties = {
  right: "0.6%",
  bottom: "1.8%",
  width: "clamp(58px, 5vw, 84px)",
  height: "clamp(58px, 5vw, 84px)",
  filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.18))",
};

const LOCK_ICON_STYLE: CSSProperties = {
  width: "clamp(28px, 2.5vw, 42px)",
  height: "clamp(34px, 3vw, 50px)",
};

const WORD_FACTORY_HIGHLIGHT_STYLE: CSSProperties = {
  left: "72.0%",
  top: "13.5%",
  width: "30.5%",
  height: "31.0%",
};

const SOUND_BLOCK_HIGHLIGHT_STYLE: CSSProperties = {
  left: "28.7%",
  top: "4.0%",
  width: "23.9%",
  height: "26.5%",
};

const SAND_WRITING_HIGHLIGHT_STYLE: CSSProperties = {
  left: "53.0%",
  top: "8.3%",
  width: "24.6%",
  height: "22.8%",
};

const LETTER_BAY_HIGHLIGHT_STYLE: CSSProperties = {
  left: "-6.5%",
  top: "19.0%",
  width: "46.4%",
  height: "66.1%",
};

const SPOTLIGHT_ISLAND_HIGHLIGHT_STYLE: CSSProperties = {
  left: "34.8%",
  top: "23.2%",
  width: "39.4%",
  height: "42.4%",
};

const ECHO_VALLEY_HIGHLIGHT_STYLE: CSSProperties = {
  left: "11.1%",
  top: "57.2%",
  width: "51.8%",
  height: "58.0%",
};

const SHELF_BAY_HIGHLIGHT_STYLE: CSSProperties = {
  left: "64.9%",
  top: "42.7%",
  width: "37.2%",
  height: "53.8%",
};

const MENU_TEXT_COLORS = {
  active: {
    title: "#5a4717",
    description: "#6d5a2a",
    meta: "#9a8652",
  },
  inactive: {
    title: "rgba(191, 192, 193, 0.96)",
    description: "rgba(170, 178, 188, 0.92)",
    meta: "rgba(150, 158, 168, 0.88)",
  },
};

export default function HomePage() {
  const map = useTranslations("map");
  const nav = useTranslations("nav");
  const [activeKey, setActiveKey] = useState<IslandKey | null>(null);

  const handlePointerMove = useCallback((_: ReactPointerEvent<HTMLDivElement>) => {
    return;
  }, []);

  const resetScene = useCallback(() => {
    setActiveKey(null);
  }, []);

  return (
    <div className="h-[100dvh] w-screen overflow-auto bg-[#dcefff]">
      <div className="relative min-h-[100dvh] min-w-screen">
        <div
          className="relative overflow-hidden bg-[#dcefff]"
          onPointerMove={handlePointerMove}
          onPointerLeave={resetScene}
          onPointerCancel={resetScene}
          style={{
            width: "max(100vw, calc(100dvh * 1380 / 776))",
            height: "max(100dvh, calc(100vw * 776 / 1380))",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(255,255,255,0.3),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(55,168,191,0.16),transparent_36%)]" />

          <div className="absolute inset-0">
            <Image
              src="/images/reading_homepage_dark.png"
              alt={map("sceneLabel")}
              fill
              priority
              sizes="(max-width: 1400px) 100vw, 1380px"
              className="pointer-events-none select-none object-cover"
            />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(11,33,68,0.08),transparent_20%,transparent_82%,rgba(8,37,48,0.14))]" />

          <div
            className="pointer-events-none absolute z-20"
            style={HOME_TITLE_STYLE}
          >
            <span
              className="block font-semibold uppercase tracking-[0.16em] text-white/44 drop-shadow-[0_1px_6px_rgba(0,0,0,0.18)]"
              style={{ fontSize: HOME_TITLE_STYLE.fontSize }}
            >
              ReadingStar Plannet
            </span>
          </div>

          <Link
            href="/settings"
            aria-label={nav("settings")}
            title={nav("settings")}
            className="absolute z-20 flex items-center justify-center text-black/44 transition-all duration-200 hover:scale-[1.08] hover:text-[#ccaa4b]"
            style={SETTINGS_ICON_STYLE}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-[74%] w-[74%]"
            >
              <path
                d="M10.634 2.91a1.2 1.2 0 0 1 2.732 0l.38 1.56a7.8 7.8 0 0 1 1.566.65l1.43-.736a1.2 1.2 0 0 1 1.95.79l.17 1.596c.476.41.9.88 1.264 1.4l1.574.112a1.2 1.2 0 0 1 .844 1.954l-.98 1.236c.066.52.068 1.044.008 1.566l.994 1.236a1.2 1.2 0 0 1-.82 1.956l-1.572.132a7.79 7.79 0 0 1-1.25 1.416l-.15 1.6a1.2 1.2 0 0 1-1.942.816l-1.442-.72a7.8 7.8 0 0 1-1.558.668l-.36 1.566a1.2 1.2 0 0 1-2.728.034l-.4-1.552a7.8 7.8 0 0 1-1.57-.63l-1.422.754a1.2 1.2 0 0 1-1.96-.764l-.19-1.594a7.8 7.8 0 0 1-1.278-1.384l-1.574-.09A1.2 1.2 0 0 1 2 14.54l.964-1.248a7.81 7.81 0 0 1-.03-1.566L1.956 10.5a1.2 1.2 0 0 1 .796-1.966l1.57-.154a7.8 7.8 0 0 1 1.23-1.434l.126-1.6a1.2 1.2 0 0 1 1.93-.844l1.452.698a7.8 7.8 0 0 1 1.548-.686z"
                className="fill-current"
              />
              <circle cx="12" cy="12" r="3.2" className="fill-[rgba(220,239,255,0.92)]" />
            </svg>
          </Link>

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
  const isBlocks = key === "blocks";
  const isBeach = key === "beach";
  const isFactory = key === "factory";
  const isBay = key === "bay";
  const isIsland = key === "island";
  const isValley = key === "valley";
  const isHarbor = key === "harbor";
  const usesImageHighlight =
    isBlocks || isBeach || isFactory || isBay || isIsland || isValley || isHarbor;

  const highlightImageSrc = isBlocks
    ? "/images/sound_block_lit.png"
    : isBeach
      ? "/images/sand_writing_lit.png"
      : isFactory
        ? "/images/word_factory_lit.png"
        : isBay
          ? "/images/letter_bay_lit.png"
          : isIsland
            ? "/images/spotlight_island_lit.png"
            : isValley
              ? "/images/echo_valley_lit.png"
              : "/images/shelf_bay_lit.png";

  const highlightImageStyle = isBlocks
    ? SOUND_BLOCK_HIGHLIGHT_STYLE
    : isBeach
      ? SAND_WRITING_HIGHLIGHT_STYLE
      : isFactory
        ? WORD_FACTORY_HIGHLIGHT_STYLE
        : isBay
          ? LETTER_BAY_HIGHLIGHT_STYLE
          : isIsland
            ? SPOTLIGHT_ISLAND_HIGHLIGHT_STYLE
            : isValley
              ? ECHO_VALLEY_HIGHLIGHT_STYLE
              : SHELF_BAY_HIGHLIGHT_STYLE;

  const zoneStyle: CSSProperties = {
    left: zoneLeft,
    top: zoneTop,
    width: zoneWidth,
    height: zoneHeight,
    clipPath: shape,
    background: active && !usesImageHighlight
      ? `radial-gradient(circle at 50% 52%, rgba(255,255,255,0.22) 0%, ${accent}5f 28%, ${accent}36 56%, transparent 84%)`
      : "transparent",
    boxShadow: active && !usesImageHighlight
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
      : "linear-gradient(180deg, rgba(19, 71, 135, 0.9), rgba(6, 38, 76, 0.92))",
    borderColor: active ? "#866422" : "rgba(154,184,214,0.28)",
    boxShadow: active
      ? `0 8px 0 rgba(133,102,36,0.35), 0 16px 30px rgba(32,57,85,0.2), 0 0 0 2px ${accent}35`
      : "0 8px 18px rgba(120, 129, 139, 0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
    transition: "all 220ms ease",
  };

  const labelTitleStyle: CSSProperties = {
    color: active ? MENU_TEXT_COLORS.active.title : MENU_TEXT_COLORS.inactive.title,
  };

  const labelDescriptionStyle: CSSProperties = {
    color: active ? MENU_TEXT_COLORS.active.description : MENU_TEXT_COLORS.inactive.description,
  };

  const labelMetaStyle: CSSProperties = {
    color: active ? MENU_TEXT_COLORS.active.meta : MENU_TEXT_COLORS.inactive.meta,
  };

  const labelCard = (
    <div
      className="rounded-[10px] border-[2px] px-2 py-1"
      style={labelCardStyle}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="shrink-0 text-lg leading-none"
          style={{ filter: !available && !active ? "grayscale(0.25) brightness(0.92)" : "none" }}
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="whitespace-nowrap text-[0.62rem] font-black leading-tight sm:text-[0.72rem]"
            style={labelTitleStyle}
          >
            {title}
          </div>
          {available && description ? (
            <div
              className="mt-0.5 max-w-[9rem] text-[0.42rem] font-bold leading-tight sm:text-[0.5rem]"
              style={labelDescriptionStyle}
            >
              {description}
            </div>
          ) : null}
          {!available ? (
            <div
              className="mt-0.5 text-[0.48rem] font-black uppercase tracking-[0.1em]"
              style={labelMetaStyle}
            >
              {comingSoon}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {!usesImageHighlight ? <div className="pointer-events-none absolute rounded-full" style={glowStyle} /> : null}

      {usesImageHighlight && active ? (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            ...highlightImageStyle,
            animation: "islandGlow 1.8s ease-in-out infinite",
          }}
        >
          <Image
            src={highlightImageSrc}
            alt=""
            fill
            aria-hidden="true"
            className="select-none object-contain"
          />
        </div>
      ) : null}

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
          <Image
            src={active ? "/images/lock_lit.png" : "/images/lock_dark.png"}
            alt=""
            width={42}
            height={50}
            aria-hidden="true"
            className="block select-none"
            style={LOCK_ICON_STYLE}
          />
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
          {!usesImageHighlight ? (
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}