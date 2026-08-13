"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CirclePlay,
  ExternalLink,
  Pause,
  Play,
  User,
} from "lucide-react";

import CourseIncludes from "@/components/course/CourseIncludes";
import useMaterialProgress from "@/hooks/useMaterialProgress";
import { encodeId } from "@/lib/courseId";
import { isFileVideoUrl, youTubeId } from "@/lib/video";

/** Inlined at build time; the watch link is a plain anchor and needs it. */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "/etms";

/**
 * How much of a video has to have gone by before it counts as watched.
 *
 * Exported with the two players below because the watch page — what OPEN IN NEW
 * TAB now opens — plays the same lecture under the same rules. Pointing that
 * button at the video file itself put the lecture in a tab running none of our
 * code, so a learner could watch the whole thing and earn nothing.
 */
export const WATCHED_TARGET = 0.9;

/** Past this, playback is not watching — it earns no credit. */
const MAX_SPEED = 1.25;

/**
 * How far ahead of the furthest second actually watched a seek may land before
 * it counts as skipping.
 *
 * Not zero, for two different reasons. The uploaded-video player learns its
 * position from `timeupdate`, which fires a few times a second rather than
 * continuously, and the YouTube player is polled once a second — so under plain
 * playback the furthest second known is always a little behind the head. A
 * couple of seconds of slack keeps normal watching from tripping the lock while
 * still being far too small to skip anything with.
 */
const SEEK_LEEWAY = 2;

/**
 * Reports what a lecture video is worth and how much of it has gone by.
 *
 * Time is only counted while something is actually playing. This card sits on
 * the course page whether or not anything is running, so a paused player in a
 * focused tab would otherwise earn a learner minutes for a video nobody is
 * watching — the same thing the coverage figures below exist to prevent.
 *
 * Absent `material` — the card's own trailer, or an officer looking around —
 * nothing is reported and the hook stays dormant.
 *
 * @param {object|null} material `{empCode, emoduleId, sectionId, lectureId, kind}`
 * @returns {{report: (stats: object) => void, setPlaying: (on: boolean) => void}}
 *   `report` hands over what the next beat should carry; the players call it as
 *   playback moves on.
 */
function useVideoProgress(material) {
  const [playing, setPlaying] = useState(false);
  const stats = useRef({
    requiredSecs: 0,
    coveragePct: 0,
    position: 0,
    lastPosition: 0,
  });
  const report = useCallback((next) => {
    stats.current = next;
  }, []);
  const snapshot = useCallback(() => stats.current, []);

  useMaterialProgress({
    active: playing && Boolean(material?.lectureId),
    material,
    snapshot,
  });

  return { report, setPlaying };
}

/**
 * Shown for a moment when a seek is pushed back, because a scrubber that
 * silently refuses to move reads as a broken player rather than a rule.
 */
function SkipNotice() {
  return (
    <span className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-white normal-case">
      You cannot skip ahead — the video opens up as you watch it.
    </span>
  );
}

/**
 * Holds the "no skipping" notice up for a beat, and takes it down again.
 *
 * The timer is cleared on unmount as well as on the next refusal: a learner who
 * navigates away mid-notice would otherwise leave a setState pointing at a
 * component that is gone.
 */
function useSkipNotice() {
  const [shown, setShown] = useState(false);
  const timer = useRef(null);

  const refuse = useCallback(() => {
    setShown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 2500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { shown, refuse };
}

/** The watched pill, in the same place whichever player is behind it. */
function WatchedBadge({ coverage }) {
  return (
    <span className="absolute top-2 left-2 z-10 rounded bg-black/60 px-2 py-0.5 text-[11px] font-semibold normal-case text-white">
      {coverage >= WATCHED_TARGET * 100
        ? "Watched"
        : `${coverage}% watched · ${Math.round(WATCHED_TARGET * 100)}% needed`}
    </span>
  );
}

/**
 * Loads YouTube's player API, once for the page.
 *
 * A plain embed is a black box — it plays on another origin and tells us
 * nothing, which is why a YouTube lecture used to be ticked off the moment it
 * was opened. Its API is the only way to ask what is actually being played.
 */
let youTubeApi = null;
function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubeApi) return youTubeApi;

  youTubeApi = new Promise((resolve, reject) => {
    // The API calls one global hook when it is ready; anything already waiting
    // on it has to be let through too.
    const waiting = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      waiting?.();
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("blocked"));
    document.head.appendChild(script);

    // A network that blocks YouTube would otherwise leave this pending forever,
    // and with it a lecture that can never be finished.
    setTimeout(() => reject(new Error("timeout")), 10_000);
  });

  return youTubeApi;
}

/**
 * A YouTube lecture, watched rather than merely opened.
 *
 * The API is polled a second at a time and the seconds are collected the same
 * way the uploaded player collects them, so skipping ahead is worth exactly the
 * second it lands on.
 *
 * If the API cannot be reached — a factory network that blocks youtube.com —
 * the lecture falls back to counting as watched on open. That is the old
 * behaviour and it is not good, but the alternative is an assignment nobody on
 * that network can ever unlock.
 */
export function TrackedYouTube({ videoId, title, onWatched, material }) {
  const holder = useRef(null);
  const seen = useRef(new Set());
  const furthest = useRef(0);
  const reported = useRef(false);
  const [coverage, setCoverage] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const { shown: refused, refuse } = useSkipNotice();
  const { report, setPlaying } = useVideoProgress(material);

  useEffect(() => {
    let player = null;
    let poll = null;
    let cancelled = false;

    const finish = () => {
      if (reported.current) return;
      reported.current = true;
      onWatched?.();
    };

    const sample = () => {
      // 1 is YT.PlayerState.PLAYING — paused, buffering and ended earn nothing.
      const running = player?.getPlayerState?.() === 1;
      // The heartbeat is told either way: this poll is the only thing that knows
      // whether the embed is running, and a video paused mid-lecture must stop
      // earning time.
      setPlaying(running);
      if (!running) return;
      if (player.getPlaybackRate?.() > MAX_SPEED) return;

      const total = Math.floor(player.getDuration?.() || 0);
      if (!total) return;

      const at = Math.floor(player.getCurrentTime());

      // Skipped ahead. There is no seek event to intercept on an embed, so the
      // poll is what notices — the head is put back and the second it landed on
      // is not credited. Only for coursework: a trailer has no `onWatched` and
      // stays free to scrub.
      if (onWatched && at > furthest.current + SEEK_LEEWAY) {
        player.seekTo?.(furthest.current, true);
        refuse();
        return;
      }

      seen.current.add(at);
      furthest.current = Math.max(furthest.current, at);

      const percent = Math.min(100, Math.round((seen.current.size / total) * 100));
      setCoverage((shown) => (shown === percent ? shown : percent));

      report({
        requiredSecs: Math.round(total * WATCHED_TARGET),
        coveragePct: percent,
        position: furthest.current,
        lastPosition: at,
      });

      if (seen.current.size / total >= WATCHED_TARGET) finish();
    };

    (async () => {
      try {
        const YT = await loadYouTubeApi();
        if (cancelled || !holder.current) return;

        player = new YT.Player(holder.current, {
          videoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              poll = setInterval(sample, 1000);
            },
          },
        });
      } catch {
        if (!cancelled) {
          setBlocked(true);
          finish();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      player?.destroy?.();
    };
    // `report`, `setPlaying` and `refuse` are stable for the life of the
    // component, so naming them here cannot rebuild the player — which must not
    // happen, as it would drop the seconds already watched.
  }, [videoId, onWatched, report, setPlaying, refuse]);

  // With the API out of reach there is nothing to report on, so the plain embed
  // goes back in and the badge stays off rather than showing a figure that
  // would never move.
  if (blocked) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  }

  return (
    <>
      {/* Replaced by the player's own iframe once the API takes it over. */}
      <div className="h-full w-full">
        <div ref={holder} className="h-full w-full" />
      </div>
      {onWatched ? <WatchedBadge coverage={coverage} /> : null}
      {refused ? <SkipNotice /> : null}
    </>
  );
}

/**
 * The uploaded-video player, and the only honest record of one being watched.
 *
 * Unique whole seconds are collected as they play, so what is counted is the
 * video actually seen rather than the time that passed in front of it. That
 * distinction is the whole point: dragging the bar to the end and walking away
 * adds one second to the set, where a stopwatch would have called it finished.
 * Rewatching adds nothing twice, and a gap left by a skip stays a gap.
 *
 * `onWatched` fires once, when enough of it has genuinely gone by. It is absent
 * for the card's own course preview — that is a trailer, not coursework.
 */
export function TrackedVideo({ src, onWatched, material }) {
  const seen = useRef(new Set());
  const furthest = useRef(0);
  const reported = useRef(false);
  const [coverage, setCoverage] = useState(0);
  const { shown: refused, refuse } = useSkipNotice();
  const { report, setPlaying } = useVideoProgress(material);

  /**
   * Puts back any seek that lands past the furthest second already watched.
   *
   * `seeking` fires for the scrubber, the keyboard arrows and any script that
   * moves the head, so all three are covered by the one handler; plain playback
   * never fires it. Seeking *backwards* is left alone — rewatching is not
   * skipping, and the unique-seconds count already makes it earn nothing twice.
   *
   * Snapping back re-fires `seeking`, but at a time that is by definition within
   * the limit, so it settles rather than looping.
   */
  const handleSeeking = (event) => {
    const video = event.currentTarget;
    if (video.currentTime <= furthest.current + SEEK_LEEWAY) return;
    video.currentTime = furthest.current;
    refuse();
  };

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    const total = Math.floor(video.duration || 0);
    if (!total || video.paused || video.seeking) return;
    if (video.playbackRate > MAX_SPEED) return;

    const at = Math.floor(video.currentTime);
    seen.current.add(at);
    furthest.current = Math.max(furthest.current, at);

    const percent = Math.min(100, Math.round((seen.current.size / total) * 100));
    setCoverage((shown) => (shown === percent ? shown : percent));

    // What the beat will carry. Coverage is the unique seconds actually seen,
    // not the clock — the same figure the badge shows, for the same reason.
    report({
      requiredSecs: Math.round(total * WATCHED_TARGET),
      coveragePct: percent,
      position: furthest.current,
      lastPosition: at,
    });

    if (!reported.current && seen.current.size / total >= WATCHED_TARGET) {
      reported.current = true;
      onWatched();
    }
  };

  return (
    <>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={onWatched ? handleTimeUpdate : undefined}
        // Locked only for coursework. Without `onWatched` this is the card's
        // own trailer or an officer looking around, and neither is being
        // marked on what they watched.
        onSeeking={onWatched ? handleSeeking : undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="h-full w-full bg-black object-contain"
      />
      {/* Said out loud, so the requirement is not a trap the learner only
          discovers by finding the assignment still locked. */}
      {onWatched ? <WatchedBadge coverage={coverage} /> : null}
      {refused ? <SkipNotice /> : null}
    </>
  );
}

/**
 * Top-right player card. It plays whatever the learner picked out of COURSE
 * CONTENT, and nothing until they pick something: a YouTube lecture embeds, an
 * uploaded one plays in the browser's own player, and a link we cannot embed (a
 * Vimeo or Drive page, say) keeps the open-in-a-new-tab behaviour.
 *
 * The card used to fill itself with the course's first lecture as a trailer,
 * which was the same file the lecture itself served — so playing it looked
 * identical to working through lecture one, and recorded nothing, because a
 * trailer is deliberately given no `onWatched`. Starting empty means every video
 * the card ever plays arrived through `playInCard`, and so is always counted.
 */
export default function CoursePreviewCard({ course, active = null }) {
  // The lecture the learner picked out of the course content list. Null until
  // they pick one, and the card stays empty until they do.
  const preview = active;
  const videoUrl = preview?.url ?? null;
  const videoId = videoUrl && !preview.uploaded ? youTubeId(videoUrl) : null;
  const fileVideo = Boolean(
    videoUrl && (preview.uploaded || isFileVideoUrl(videoUrl))
  );
  // Embeddable = we can show it inside the card. Everything else opens out.
  const embeddable = Boolean(videoId) || fileVideo;

  // Where OPEN IN NEW TAB goes for a lecture whose watching is measured. Null
  // for an officer (who records nothing) and for a link the card cannot play,
  // and the raw URL is used instead in both cases.
  //
  // The basePath is written in by hand: this is a plain anchor, because
  // target="_blank" wants a real navigation, and next/link is what would
  // otherwise have added it. Without it the tab opens /course/... and 404s.
  const tracked = preview?.material;
  const watchHref =
    tracked && embeddable
      ? `${BASE_PATH}/course/${encodeId(tracked.emoduleId)}/watch/${encodeId(tracked.lectureId)}`
      : null;

  const [playing, setPlaying] = useState(false);
  const cardRef = useRef(null);

  // A lecture picked from the content list — which sits well below this card —
  // starts playing straight away and brings the card into view, otherwise the
  // click would appear to do nothing at all.
  useEffect(() => {
    if (!active) return;
    setPlaying(true);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);
  // maxres is a true 16:9 frame but is missing on older uploads; hq always
  // exists, so a failed load steps down to it and only then to the placeholder.
  const [thumbLevel, setThumbLevel] = useState(0);
  const thumb =
    videoId && thumbLevel < 2
      ? `https://img.youtube.com/vi/${videoId}/${
          thumbLevel === 0 ? "maxresdefault" : "hqdefault"
        }.jpg`
      : null;

  return (
    // Stretches to the height of the course header beside it — hence flex-col
    // here and a growing body below, rather than sticking to the viewport.
    <div
      ref={cardRef}
      className="flex w-full flex-col overflow-hidden rounded border border-gray-200 bg-white text-[12px] shadow"
    >
      {/* A 16:9 stage, so the player and the thumbnail it replaces are exactly
          the same size and nothing on the page jumps when playback starts. */}
      <div className="relative aspect-video w-full shrink-0 bg-gray-900">
        {!videoUrl ? (
          // Nothing picked yet. A blank panel reads as broken, so the card says
          // what it is waiting for.
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#3482AE] to-[#2b6b90] px-4 text-center text-white">
            <CirclePlay className="h-8 w-8 opacity-90" />
            <span className="text-[13px] font-semibold normal-case">
              Pick a lecture from Course Content to play it here
            </span>
          </div>
        ) : fileVideo ? (
          // An uploaded file needs no poster dance — the browser draws its
          // first frame and gives the learner real controls.
          <TrackedVideo
            // Keyed on the source so picking another lecture remounts the
            // player; swapping `src` alone leaves the old media loaded — and
            // would carry the last lecture's watched seconds into this one.
            key={videoUrl}
            src={videoUrl}
            onWatched={preview?.onWatched}
            material={preview?.material}
          />
        ) : playing && videoId ? (
          <TrackedYouTube
            // Keyed on the video so picking another lecture builds a new player
            // rather than carrying the last one's watched seconds into it.
            key={videoId}
            videoId={videoId}
            title={`Preview: ${course.name}`}
            onWatched={preview?.onWatched}
            material={preview?.material}
          />
        ) : (
          // Thumbnail state: a button for the embeddable case (it plays in
          // place), a plain link for anything we can only hand to a new tab.
          <PreviewTrigger
            embeddable={embeddable}
            href={videoUrl}
            onPlay={() => setPlaying(true)}
            label={`Preview: ${course.name}`}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                onError={() => setThumbLevel((n) => n + 1)}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="absolute inset-0 bg-gradient-to-br from-[#3482AE] to-[#1f4e6b]" />
            )}
            <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <Play
                  className="h-6 w-6 translate-x-0.5 text-[#3482AE]"
                  fill="currentColor"
                />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-4 pt-6 pb-3 text-[13px] font-semibold normal-case text-white">
              Preview this course
              {embeddable ? null : (
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              )}
            </span>
          </PreviewTrigger>
        )}
      </div>

      {/* Which lecture the preview is — the same tinted strip the figures under
          the course header sit on, so the two cards line up visually. */}
      {preview?.lecture ? (
        <p className="flex items-center gap-2 border-b border-gray-200 bg-[#fbfcfd] px-4 py-2.5 text-[12px] normal-case text-gray-700">
          <CirclePlay className="h-3.5 w-3.5 shrink-0 text-[#3482AE]" />
          <span className="min-w-0 truncate">{preview.lecture}</span>
        </p>
      ) : null}

      <div className="flex flex-1 flex-col p-4">
        {/* The one "this course includes" list on the page. The course card
            beside this one carried a second copy of it; `compact` is now the
            narrow one-column layout, not a shorter list, so nothing was lost
            when that duplicate came out. */}
        <CourseIncludes course={course} compact />

        <p className="mt-3 flex items-center gap-2.5 border-t border-gray-200 pt-3 text-[13px] normal-case text-gray-700">
          <span className="flex w-4 shrink-0 justify-center text-gray-500">
            <User className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 truncate">
            Instructor: <strong>{course.instructor || "—"}</strong>
          </span>
        </p>

        {videoUrl ? (
          <div className="mt-4 space-y-2">
            {embeddable && !fileVideo ? (
              <button
                type="button"
                onClick={() => setPlaying((on) => !on)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded bg-[#3482AE] px-4 py-2 text-[12px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#2b6b90]"
              >
                {/* The usual media toggle: the button shows what pressing it
                    will do. Stopped, it offers ▶; running, it offers ‖. */}
                {playing ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                )}
                {playing ? "Stop Preview" : "Watch Preview"}
              </button>
            ) : null}
            {/* A tracked lecture opens OUR watch page in the new tab, not the
                video file: a tab showing a bare .mp4 runs none of our code, so
                the whole lecture could be watched there for no credit. Only a
                link we cannot play at all still goes straight to the browser,
                and those are ticked on open because nothing can report back. */}
            <a
              href={watchHref ?? videoUrl}
              target="_blank"
              rel="noreferrer"
              className={
                embeddable && !fileVideo
                  ? "flex items-center justify-center gap-1.5 text-[11px] normal-case text-gray-500 underline-offset-2 transition-colors hover:text-[#3482AE] hover:underline"
                  : "flex items-center justify-center gap-2 rounded bg-[#3482AE] px-4 py-2 text-[12px] font-bold tracking-wide text-white uppercase transition-colors hover:bg-[#2b6b90]"
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The clickable thumbnail. Same look either way; a button when the video plays
 * in place, an anchor when the only thing we can do is open it elsewhere.
 */
function PreviewTrigger({ embeddable, href, onPlay, label, children }) {
  const className =
    "group absolute inset-0 block h-full w-full cursor-pointer overflow-hidden bg-gray-900 text-left";

  return embeddable ? (
    <button type="button" onClick={onPlay} aria-label={label} className={className}>
      {children}
    </button>
  ) : (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={className}
    >
      {children}
    </a>
  );
}
