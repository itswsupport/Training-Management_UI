"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Download,
  FilePlus,
  FileText,
  GraduationCap,
  Hourglass,
  LifeBuoy,
  List,
  ListChecks,
  Lock,
  LogIn,
  MessageSquareText,
  MonitorPlay,
  Pencil,
  Sparkles,
  UserCheck,
} from "lucide-react";

import {
  Bullets,
  FormMock,
  GuideCard,
  GuideHeading,
  MiniCards,
  Notice,
  Steps,
  Terms,
} from "@/components/userGuide/GuideCard";
import { HeroPattern, gradient } from "@/components/userGuide/GuideArt";
import ScreenMock from "@/components/userGuide/ScreenMock";
import { BRAND } from "@/lib/palette";
import { useAuth } from "@/context/AuthContext";
import { isTrainingOfficer } from "@/lib/permissions";
import {
  CHAPTERS,
  MANUAL_NAME,
  MANUAL_TITLE,
} from "@/lib/userManual.mjs";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";

/**
 * The manual reads as a document, not as a screen of the app, so it uses the
 * reader's own interface font rather than the Exo the rest of ETMS is set in —
 * the same stack the payroll manual renders with. Set here rather than in
 * globals.css so nothing else in the app is affected.
 */
const MANUAL_FONT =
  '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
/** The same manual as a file, for printing or reading offline. */
const MANUAL_PDF = `${BASE_PATH}/ETMS-User-Manual.pdf`;

/** Icon names in the manual data → the components that draw them. */
const ICONS = {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Download,
  FilePlus,
  FileText,
  GraduationCap,
  Hourglass,
  LifeBuoy,
  List,
  ListChecks,
  Lock,
  LogIn,
  MessageSquareText,
  MonitorPlay,
  Pencil,
  Sparkles,
};

/** A card title → the anchor the chip above jumps to. */
const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** One block of a card — the seven shapes the PDF builder also handles. */
function Block({ block }) {
  switch (block.type) {
    case "steps":
      return <Steps items={block.items} />;
    case "bullets":
      return <Bullets items={block.items} />;
    case "terms":
      return <Terms items={block.items} />;
    case "notice":
      return <Notice tone={block.tone}>{block.text}</Notice>;
    case "screen":
      return (
        <ScreenMock
          caption={block.caption}
          chrome={block.chrome}
          full={block.full}
          officer={block.officer}
          screenTitle={block.screenTitle}
          tiles={block.tiles}
          panel={block.panel}
          kind={block.kind}
          badge={block.badge}
          lecture={block.lecture}
          note={block.note}
          progress={block.progress}
          rows={block.rows}
        />
      );
    case "form":
      return (
        <FormMock
          title={block.title}
          fields={block.fields}
          actions={block.actions}
        />
      );
    case "cards":
      return (
        <MiniCards
          items={block.items.map((item) => ({
            ...item,
            icon: ICONS[item.icon],
          }))}
        />
      );
    case "heading":
      return (
        <GuideHeading icon={<ListChecks className="h-3.5 w-3.5" />}>
          {block.text}
        </GuideHeading>
      );
    case "para":
      return (
        <p className="text-[14px] leading-[1.85] normal-case text-gray-700">
          {block.text}
        </p>
      );
    default:
      return null;
  }
}

export default function UserGuidePage() {
  const { user } = useAuth();
  const officer = isTrainingOfficer(user);

  // This opens in a tab of its own, so the tab needs to say what it is rather
  // than carrying the app's own title. The root layout sets that statically.
  useEffect(() => {
    document.title = `${MANUAL_TITLE} — ${MANUAL_NAME}`;
  }, []);

  // Which half of the manual is showing. Null until the reader picks a side,
  // so it follows their own role — including when the session resolves a beat
  // after the first render — and honours the toggle from the moment it is
  // used. Derived rather than synced in an effect, which would flip the
  // reader's choice back the instant auth settled.
  const [chosen, setChosen] = useState(null);
  const view = chosen ?? (officer ? "officer" : "user");

  const chapters = useMemo(
    () =>
      CHAPTERS.filter(
        (chapter) =>
          chapter.audience === "both" || chapter.audience === view
      ),
    [view]
  );

  return (
    // The shell's <main> carries no padding of its own — every page supplies
    // its own — so the hero already spans the full column and needs no
    // negative margin to break out of one.
    <div
      className="min-h-full bg-[#f4f6f9] pb-12"
      style={{ fontFamily: MANUAL_FONT }}
    >
      {/* Hero */}
      <header className="relative overflow-hidden bg-[linear-gradient(120deg,#4a9ac9_0%,#3482AE_38%,#215875_100%)] px-6 pt-14 pb-16 text-center text-white">
        <HeroPattern />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="bg-[linear-gradient(100deg,#ffffff_0%,#ffffff_45%,#bfe4f7_100%)] bg-clip-text text-[30px] leading-[1.15] font-bold tracking-[-0.02em] normal-case text-transparent sm:text-[40px]">
            {MANUAL_TITLE} {MANUAL_NAME}
          </h1>
          <span
            aria-hidden="true"
            className="mx-auto mt-4 block h-1 w-24 rounded-full bg-[linear-gradient(90deg,#ffc107_0%,#20c997_100%)]"
          />
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.8] normal-case text-white/90">
            How to work through your training, watch the lectures, complete the
            assignments and collect your certificate.
          </p>
          <a
            href={MANUAL_PDF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white/15 px-6 py-3 text-[13px] font-bold tracking-[0.08em] uppercase shadow-lg ring-1 ring-white/30 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/25"
          >
            <Download className="h-4 w-4" /> Download as PDF
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Which manual you are reading. Right-aligned, above the chips, so it
            is the first thing decided and the chips below it always match. */}
        <div className="flex justify-end pt-6">
          <div
            role="group"
            aria-label="Choose which manual to read"
            className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
          >
            {[
              { id: "user", label: "User", Icon: UserCheck },
              { id: "officer", label: "Training Officer", Icon: GraduationCap },
            ].map(({ id, label, Icon }) => {
              const on = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChosen(id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold normal-case transition ${
                    on
                      ? "text-white shadow-sm"
                      : "text-gray-500 hover:text-[#3482AE]"
                  }`}
                  style={on ? { backgroundImage: gradient(BRAND, 150) } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jump chips — one per topic, in reading order. */}
        <nav className="flex flex-wrap justify-center gap-2.5 pt-5 pb-8">
          {chapters.flatMap((chapter) =>
            chapter.cards.map((card) => (
              <a
                key={`${chapter.id}-${card.title}`}
                href={`#${slug(card.title)}`}
                className="rounded-lg border border-[#3482AE]/30 bg-white px-4 py-2 text-[13px] font-medium normal-case text-[#3482AE] shadow-sm transition hover:-translate-y-0.5 hover:border-transparent hover:bg-[linear-gradient(135deg,#4a9ac9_0%,#3482AE_100%)] hover:text-white hover:shadow-md"
              >
                {card.title}
              </a>
            ))
          )}
        </nav>

        {/* One flat run of topics. The chapters still order them, but they are
            no longer announced — the chips above are the way in. */}
        <div className="space-y-6">
          {chapters.map((chapter) => (
            <React.Fragment key={chapter.id}>
              {chapter.cards.map((card) => (
                <GuideCard
                  key={card.title}
                  id={slug(card.title)}
                  title={card.title}
                  icon={ICONS[card.icon]}
                  color={card.color}
                  subtitle={card.subtitle}
                >
                  {card.blocks.map((block, index) => (
                    <Block key={index} block={block} />
                  ))}
                </GuideCard>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
