"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Document } from "@/types";

type Audience = "student" | "teacher";
type IslandSlug = "spotlight" | "letter-bay" | "echo-valley";

interface IslandConfig {
  namespace: "spotlightPage" | "letterBayPage" | "echoValleyPage";
  emoji: string;
  accent: string;
  gradient: string;
  panelTone: string;
  docHref: (id: string) => string;
}

const PAGE_CONFIG: Record<IslandSlug, IslandConfig> = {
  spotlight: {
    namespace: "spotlightPage",
    emoji: "🔦",
    accent: "#f4b942",
    gradient: "from-[#fff4b7] via-[#ffe9c7] to-[#fffaf0]",
    panelTone: "bg-[#fffaf0] border-[#f2d48a]",
    docHref: (id) => `/read/${id}?source=spotlight&focus=single-line`,
  },
  "letter-bay": {
    namespace: "letterBayPage",
    emoji: "🔤",
    accent: "#66b7ff",
    gradient: "from-[#dff2ff] via-[#fdf0d5] to-[#fffaf1]",
    panelTone: "bg-[#f8fcff] border-[#b8dcff]",
    docHref: (id) => `/read/${id}?source=letter-bay&letters=on`,
  },
  "echo-valley": {
    namespace: "echoValleyPage",
    emoji: "🔊",
    accent: "#5fc9b6",
    gradient: "from-[#d9fff8] via-[#eefcf9] to-[#fff9f0]",
    panelTone: "bg-[#f3fffd] border-[#a8e8db]",
    docHref: (id) => `/read/${id}?source=echo-valley&tts=on`,
  },
};

export function IslandHubPage({ island }: { island: IslandSlug }) {
  const config = PAGE_CONFIG[island];
  const common = useTranslations("islandHub");
  const page = useTranslations(config.namespace);
  const [audience, setAudience] = useState<Audience>("student");
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("/api/documents");

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setDocuments((data.documents ?? []).slice(0, 3));
      } catch {
        // Keep the page usable without documents.
      }
    };

    void fetchDocuments();
  }, []);

  const hasDocuments = documents.length > 0;
  const primaryHref = hasDocuments ? config.docHref(documents[0].id) : "#demo-panel";
  const primaryLabel = hasDocuments ? common("startWithLatest") : common("tryDemo");
  const panelTitle = audience === "student" ? common("studentMission") : common("teacherNotes");
  const guidanceTitle = audience === "student" ? page("studentTitle") : page("teacherTitle");
  const guidancePoints = audience === "student"
    ? [page("studentPoint1"), page("studentPoint2"), page("studentPoint3")]
    : [page("teacherPoint1"), page("teacherPoint2"), page("teacherPoint3")];

  return (
    <div className="space-y-6 pb-28">
      <section
        className={`overflow-hidden rounded-[28px] border-4 border-white/70 bg-gradient-to-br ${config.gradient} shadow-[0_20px_60px_rgba(30,68,90,0.12)]`}
      >
        <div className="grid gap-5 p-5 lg:grid-cols-[1.35fr_0.9fr] lg:p-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
                {config.emoji} {page("badge")}
              </span>
              <div className="inline-flex rounded-full border border-white/80 bg-white/70 p-1 shadow-sm">
                <AudienceToggle
                  active={audience === "student"}
                  onClick={() => setAudience("student")}
                  label={common("studentView")}
                />
                <AudienceToggle
                  active={audience === "teacher"}
                  onClick={() => setAudience("teacher")}
                  label={common("teacherView")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black text-slate-800 sm:text-4xl">
                {page("title")}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {page("subtitle")}
              </p>
            </div>

            <div
              id="demo-panel"
              className={`rounded-[24px] border-2 ${config.panelTone} p-4 shadow-[0_12px_30px_rgba(43,73,94,0.08)] sm:p-5`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    {common("demoLabel")}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{page("intro")}</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-black text-slate-700"
                  style={{ backgroundColor: `${config.accent}22` }}
                >
                  {page("sampleLabel")}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ModeCard title={page("card1Title")} body={page("card1Body")} accent={config.accent} />
                <ModeCard title={page("card2Title")} body={page("card2Body")} accent={config.accent} />
                <ModeCard title={page("card3Title")} body={page("card3Body")} accent={config.accent} />
              </div>

              <div className="mt-4 rounded-[22px] border-2 border-white/80 bg-white/90 p-4 shadow-inner sm:p-5">
                {renderSampleText(island, page)}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border-2 border-white/80 bg-white/88 p-5 shadow-[0_16px_34px_rgba(43,73,94,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                {panelTitle}
              </p>
              <h2 className="mt-2 text-xl font-black text-slate-800">{guidanceTitle}</h2>
              <div className="mt-4 space-y-3">
                {guidancePoints.map((point, index) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-slate-700"
                      style={{ backgroundColor: `${config.accent}25` }}
                    >
                      {index + 1}
                    </span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border-2 border-white/80 bg-white/88 p-5 shadow-[0_16px_34px_rgba(43,73,94,0.08)]">
              <h2 className="text-lg font-black text-slate-800">{common("quickStart")}</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <QuickLink href="#demo-panel" label={page("primaryAction")} accent={config.accent} />
                <QuickLink href="/library" label={common("openShelf")} accent={config.accent} />
                <QuickLink href="/" label={common("backToMap")} accent={config.accent} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-[26px] border-2 border-[#f1e6d2] bg-white/90 p-5 shadow-[0_16px_34px_rgba(43,73,94,0.06)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800">{common("recentShelf")}</h2>
            <p className="mt-1 text-sm text-slate-500">{common("recentShelfHint")}</p>
          </div>
          <Link href="/library" className="btn-kid rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
            {common("openShelf")}
          </Link>
        </div>

        {hasDocuments ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {documents.map((document) => (
              <article
                key={document.id}
                className="rounded-[24px] border-2 border-slate-100 bg-[#fffdf8] p-4 shadow-[0_10px_24px_rgba(43,73,94,0.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      {document.fileType}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-lg font-black text-slate-800">
                      {document.title}
                    </h3>
                  </div>
                  <span className="text-3xl">📘</span>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                  {Math.round(document.fileSize / 1024)} KB
                </p>

                <Link
                  href={config.docHref(document.id)}
                  className="btn-kid mt-4 block rounded-2xl px-4 py-3 text-center text-sm font-black text-white"
                  style={{ backgroundColor: config.accent }}
                >
                  {page("documentAction")}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-lg font-black text-slate-700">{common("emptyShelf")}</p>
            <p className="mt-2 text-sm text-slate-500">{common("emptyShelfHint")}</p>
          </div>
        )}
      </section>

      <div className="sticky bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 rounded-[24px] border border-white/70 bg-white/92 p-3 shadow-[0_16px_40px_rgba(43,73,94,0.14)] backdrop-blur-sm">
        <Link
          href={primaryHref}
          className="btn-kid rounded-2xl px-5 py-3 text-sm font-black text-white"
          style={{ backgroundColor: config.accent }}
        >
          {primaryLabel}
        </Link>
        <Link href="/library" className="btn-kid rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700">
          {page("secondaryAction")}
        </Link>
        <Link href="/" className="btn-kid rounded-2xl bg-[#fff4de] px-5 py-3 text-sm font-black text-slate-700">
          {common("backToMap")}
        </Link>
      </div>
    </div>
  );
}

function AudienceToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn-kid rounded-full px-4 py-2 text-sm font-black ${
        active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function ModeCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/80 bg-white/85 p-4 shadow-sm">
      <div
        className="mb-3 h-2 rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  accent,
}: {
  href: string;
  label: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-bold"
    >
      <span>{label}</span>
      <span className="text-lg" style={{ color: accent }}>→</span>
    </Link>
  );
}

function renderSampleText(
  island: IslandSlug,
  page: ReturnType<typeof useTranslations>,
) {
  if (island === "spotlight") {
    return (
      <div className="space-y-3 text-lg leading-9 text-slate-400">
        <p>{page("sampleLine1")}</p>
        <p className="rounded-2xl bg-[#fff2b8] px-3 py-2 font-black text-slate-800 shadow-sm">
          {page("sampleLine2")}
        </p>
        <p>{page("sampleLine3")}</p>
      </div>
    );
  }

  if (island === "letter-bay") {
    return (
      <p className="text-lg leading-9 text-slate-700">
        <span className="letter-b">b</span> {page("sampleLine1")} <span className="letter-d">d</span>{" "}
        {page("sampleLine2")} <span className="letter-p">p</span> {page("sampleLine3")} <span className="letter-q">q</span>
      </p>
    );
  }

  return (
    <p className="text-lg leading-9 text-slate-700">
      {page("sampleLine1")} <span className="tts-word-active font-black">{page("sampleLine2")}</span>{" "}
      {page("sampleLine3")}
    </p>
  );
}