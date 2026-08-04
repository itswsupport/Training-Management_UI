/**
 * Builds `public/ETMS-User-Manual.pdf` from `src/lib/userManual.mjs`.
 *
 *   npm run manual
 *
 * The HELP button serves that file straight out of `public/`, so the manual
 * opens in the browser's own PDF viewer with no work done on the client. Run
 * this whenever the chapters change and commit the result.
 *
 * jsPDF is already a dependency here — it is what draws the training
 * certificate — so the printed manual and the printed certificate come out of
 * the same library.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

import { jsPDF } from "jspdf";

import {
  C,
  CHAPTERS,
  MANUAL_NAME,
  MANUAL_SUBTITLE,
  MANUAL_TITLE,
} from "../src/lib/userManual.mjs";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "ETMS-User-Manual.pdf"
);

/* A4 portrait, in millimetres — the same units the certificate is laid out in. */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const BODY_W = PAGE_W - MARGIN * 2;
/* Where the body must stop so it never runs into the footer. */
const BOTTOM = PAGE_H - 20;

const INK = "#1f2937";
const INK_SOFT = "#4b5563";
const RULE = "#e5e7eb";

/** Tinted call-out fills, matching the on-screen `Notice` tones. */
const TONES = {
  info: { border: C.brand, bg: "#eaf3f9", ink: "#215875" },
  warn: { border: C.pending, bg: "#fff8e6", ink: "#7a5c00" },
  success: { border: C.approved, bg: "#e7f8f2", ink: "#12705a" },
  danger: { border: C.rejected, bg: "#fdecee", ink: "#a71d2a" },
};

const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });

/** Current pen position down the page. */
let y = MARGIN;
/** Filled as chapters are drawn, then replayed onto the contents page. */
const contents = [];

/* ------------------------------------------------------------------ */
/* Page plumbing                                                       */
/* ------------------------------------------------------------------ */

const hex = (value) => doc.setTextColor(value);

/**
 * jsPDF's built-in fonts are WinAnsi-encoded, so anything outside it comes out
 * as mangled, letter-spaced nonsense rather than the glyph. The manual is
 * written for the screen, where those glyphs are fine — they are swapped for
 * words here rather than being kept out of the source.
 */
const GLYPHS = { "☰": "menu", "✓": "tick", "✔": "tick", "→": "->", "≤": "<=", "≥": ">=", "×": "x" };
/** WinAnsi does carry these, so they must survive the strip below. */
const KEEP_HIGH = new Set([..."–—‘’“”…€™•·"]);

const clean = (value) =>
  String(value ?? "")
    .replace(/[☰✓✔→≤≥×]/g, (ch) => GLYPHS[ch])
    .replace(/[^\x00-\xFF]/g, (ch) => (KEEP_HIGH.has(ch) ? ch : ""));

/**
 * Cuts text to fit one line of `width`, with an ellipsis.
 *
 * Grid cells are drawn at a fixed row height, so a long course name must be
 * clipped rather than wrapped — jsPDF's own `maxWidth` wraps, and the second
 * line would print straight over the row beneath.
 */
function fit(value, width) {
  const full = clean(value);
  if (doc.getTextWidth(full) <= width) return full;
  let cut = full;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

/** Starts a fresh page and puts the pen back at the top margin. */
function newPage() {
  doc.addPage();
  y = MARGIN;
}

/** Breaks to a new page when `needed` mm would not fit above the footer. */
function need(needed) {
  if (y + needed > BOTTOM) newPage();
}

/**
 * Wrapped text.
 *
 * @returns the height it occupied, so callers can advance the pen.
 */
function text(value, x, width, { size = 10, style = "normal", color = INK, lead = 1.35 } = {}) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  hex(color);
  const lines = doc.splitTextToSize(clean(value), width);
  const lineH = (size * lead) / 2.83465; // pt → mm
  lines.forEach((line, i) => {
    // A long block can outgrow the page part-way through; carry on overleaf.
    if (y + (i ? 0 : lineH) > BOTTOM) {
      newPage();
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      hex(color);
    }
    doc.text(line, x, y + lineH * 0.75);
    y += lineH;
  });
  return lines.length * lineH;
}

/** Measures wrapped text without drawing it — used to keep blocks together. */
function measure(value, width, size = 10, lead = 1.35) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  return doc.splitTextToSize(clean(value), width).length * ((size * lead) / 2.83465);
}

/* ------------------------------------------------------------------ */
/* Cover and contents                                                  */
/* ------------------------------------------------------------------ */

function cover() {
  doc.setFillColor(C.brand);
  doc.rect(0, 0, PAGE_W, 96, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  hex("#ffffff");
  doc.text(MANUAL_TITLE, MARGIN, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  hex("#dbeafe");
  doc.text(MANUAL_SUBTITLE, MARGIN, 62);

  doc.setFillColor(C.pending);
  doc.rect(MARGIN, 72, 34, 1.6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  hex("#ffffff");
  doc.text(MANUAL_NAME.toUpperCase(), MARGIN, 86);

  // The four state colours, as a strip — the same order the dashboards use.
  let x = MARGIN;
  [C.brand, C.pending, C.approved, C.rejected].forEach((color) => {
    doc.setFillColor(color);
    doc.rect(x, 112, 40, 5, "F");
    x += 43.5;
  });

  y = 130;
  text(
    "This manual covers every screen in ETMS: signing in, the course lists, working through a course's lectures and material, sitting assignments, the feedback form, and downloading your certificate. The final chapters cover the training officer's screens and the questions that come up most often.",
    MARGIN,
    BODY_W,
    { size: 11, color: INK_SOFT, lead: 1.5 }
  );

  y += 6;
  text("Rucha Engineers Pvt. Ltd.", MARGIN, BODY_W, {
    size: 10,
    style: "bold",
    color: C.brand,
  });
}

/**
 * The contents page.
 *
 * Drawn last, once every chapter's real page number is known, then moved into
 * position as page 2.
 */
function contentsPage() {
  newPage();
  const page = doc.getNumberOfPages();

  doc.setFillColor(C.brand);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  hex("#ffffff");
  doc.text("CONTENTS", MARGIN, 17);

  y = 42;
  contents.forEach(({ label, cards, page: at, color }) => {
    need(18);
    doc.setFillColor(color);
    doc.rect(MARGIN, y - 1, 3, 7, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    hex(INK);
    doc.text(label, MARGIN + 7, y + 4.5);

    doc.setFont("helvetica", "bold");
    hex(C.brand);
    doc.text(String(at), PAGE_W - MARGIN, y + 4.5, { align: "right" });
    y += 9;

    cards.forEach((card) => {
      need(7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      hex(INK_SOFT);
      doc.text(card.title, MARGIN + 7, y + 3.5);
      doc.text(String(card.page), PAGE_W - MARGIN, y + 3.5, { align: "right" });
      y += 5.6;
    });
    y += 5;
  });

  return page;
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

function drawHeading(block) {
  // A heading alone at the foot of a page is an orphan — reserve room for it
  // plus the first few lines of whatever it introduces.
  need(28);
  y += 3;
  doc.setFillColor(C.brand);
  doc.rect(MARGIN, y + 0.6, 2.2, 4.4, "F");
  text(block.text.toUpperCase(), MARGIN + 5, BODY_W - 5, {
    size: 9.5,
    style: "bold",
    color: INK,
  });
  y += 2;
}

function drawPara(block) {
  need(10);
  text(block.text, MARGIN, BODY_W, { size: 10, color: INK_SOFT, lead: 1.45 });
  y += 2.5;
}

function drawSteps(block) {
  const inner = BODY_W - 10;
  block.items.forEach((item, index) => {
    // Keep the number, its heading and at least the start of the sentence
    // together, so a step never begins with its number stranded on one page.
    const titleH = item.title ? measure(item.title, inner, 10) : 0;
    need(Math.min(titleH + measure(item.text, inner) + 4, 42));

    const top = y;
    doc.setFillColor(C.brand);
    doc.circle(MARGIN + 2.8, top + 2.4, 2.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    hex("#ffffff");
    doc.text(String(index + 1), MARGIN + 2.8, top + 3.3, { align: "center" });

    if (item.title) {
      text(item.title, MARGIN + 10, inner, {
        size: 10,
        style: "bold",
        color: INK,
        lead: 1.35,
      });
    }
    // On screen the sentence runs on from the heading ("Open ETMS — reach it
    // from…"), so it is written lower-case. Here it starts its own line and has
    // to read as a sentence.
    const body = item.title
      ? item.text.charAt(0).toUpperCase() + item.text.slice(1)
      : item.text;
    text(body, MARGIN + 10, inner, { size: 10, color: INK_SOFT, lead: 1.45 });
    y += 3;
  });
  y += 1.5;
}

function drawBullets(block) {
  block.items.forEach((item) => {
    need(Math.min(measure(item, BODY_W - 7) + 2, 40));
    const top = y;
    doc.setFillColor(C.brand);
    doc.circle(MARGIN + 1.8, top + 2.2, 0.9, "F");
    text(item, MARGIN + 6, BODY_W - 6, { size: 10, color: INK_SOFT, lead: 1.45 });
    y += 1.8;
  });
  y += 1.5;
}

function drawTerms(block) {
  block.items.forEach(({ term, color, text: body }) => {
    need(Math.min(measure(body, BODY_W - 40) + 3, 40));
    const top = y;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const pillW = doc.getTextWidth(term.toUpperCase()) + 5;
    doc.setFillColor(color || C.brand);
    doc.roundedRect(MARGIN, top, pillW, 5, 1, 1, "F");
    hex("#ffffff");
    doc.text(term.toUpperCase(), MARGIN + pillW / 2, top + 3.5, { align: "center" });

    // Nudged so the definition's first baseline sits level with the pill's.
    const x = MARGIN + 36;
    y = top + 0.9;
    text(body, x, PAGE_W - MARGIN - x, { size: 10, color: INK_SOFT, lead: 1.45 });
    // Never let a short definition overlap the next pill.
    if (y < top + 6) y = top + 6;
    y += 2;
  });
  y += 1.5;
}

function drawNotice(block) {
  const tone = TONES[block.tone] ?? TONES.info;
  const inner = BODY_W - 12;
  const h = measure(block.text, inner) + 7;
  need(h + 3);

  const top = y;
  doc.setFillColor(tone.bg);
  doc.setDrawColor(tone.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, top, BODY_W, h, 1.5, 1.5, "FD");
  doc.setFillColor(tone.border);
  doc.rect(MARGIN, top, 1.8, h, "F");

  y = top + 3.5;
  text(block.text, MARGIN + 6, inner, { size: 9.5, color: tone.ink, lead: 1.45 });
  y = top + h + 4;
}

/**
 * The row of solid dashboard tiles the screen version draws — the same shapes
 * the reader is looking at in the app, so the manual points at something they
 * can recognise rather than describing it in words.
 */
function drawCards(block) {
  const gap = 3;
  const n = block.items.length;
  const w = (BODY_W - gap * (n - 1)) / n;
  const h = 15;
  need(h + 6);

  const top = y;
  block.items.forEach(({ label, color }, index) => {
    const x = MARGIN + index * (w + gap);
    doc.setFillColor(color);
    doc.roundedRect(x, top, w, h, 1.8, 1.8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    hex("#ffffff");
    // A long label such as COURSE STATUS has to wrap inside its own tile.
    const lines = doc.splitTextToSize(clean(label), w - 3);
    const startY = top + h / 2 - (lines.length - 1) * 1.5 + 1;
    lines.forEach((line, i) => {
      doc.text(line, x + w / 2, startY + i * 3, { align: "center" });
    });
  });
  y = top + h + 6;
}

/**
 * A drawing of a form: the labelled boxes the reader is about to fill in, in
 * the same two-column grid the screen version uses.
 */
function drawForm(block) {
  const pad = 5;
  const colW = (BODY_W - pad * 2 - 5) / 2;
  const rowH = 13;

  // Laid out first so the panel behind it can be drawn at the right height.
  const rows = [];
  let column = 0;
  block.fields.forEach((field) => {
    const full = field.wide || field.options;
    if (full && column === 1) {
      rows.push(null); // finish the half-width row above
      column = 0;
    }
    const h = field.options
      ? 6 + Math.ceil(field.options.length / 2) * 9
      : 6 + (field.lines ? field.lines * 4.5 + 3 : 7);
    rows.push({ field, full, column, h });
    column = full ? 0 : (column + 1) % 2;
  });

  let bodyH = 0;
  let rowMax = 0;
  rows.filter(Boolean).forEach((row, i, all) => {
    rowMax = Math.max(rowMax, row.h);
    const last = i === all.length - 1;
    if (row.full || row.column === 1 || last) {
      bodyH += rowMax + 4;
      rowMax = 0;
    }
  });

  const titleH = block.title ? 12 : 0;
  const actionsH = block.actions?.length ? 12 : 0;
  const panelH = pad * 2 + titleH + bodyH + actionsH;
  need(panelH + 4);

  const top = y;
  doc.setFillColor("#f8f9fa");
  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, top, BODY_W, panelH, 2, 2, "FD");

  y = top + pad;

  if (block.title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const label = clean(block.title.toUpperCase());
    const w = doc.getTextWidth(label) + 8;
    doc.setFillColor(C.brand);
    doc.roundedRect(MARGIN + pad, y, w, 7.5, 1.4, 1.4, "F");
    hex("#ffffff");
    doc.text(label, MARGIN + pad + 4, y + 5.1);
    y += titleH;
  }

  let rowTop = y;
  rowMax = 0;
  rows.filter(Boolean).forEach((row, i, all) => {
    const { field, full, column: col, h } = row;
    const x = MARGIN + pad + (full || col === 0 ? 0 : colW + 5);
    const w = full ? BODY_W - pad * 2 : colW;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    hex(C.brand);
    doc.text(clean(field.label), x, rowTop + 3.4, { maxWidth: w });

    if (field.options) {
      field.options.forEach((option, oi) => {
        const ox = x + (oi % 2) * (w / 2);
        const oy = rowTop + 6 + Math.floor(oi / 2) * 9;
        doc.setFillColor("#ffffff");
        doc.setDrawColor("#d1d5db");
        doc.roundedRect(ox, oy, w / 2 - 3, 7, 1.2, 1.2, "FD");
        doc.setDrawColor("#d1d5db");
        doc.setLineWidth(0.4);
        doc.circle(ox + 3.5, oy + 3.5, 1.5, "S");
        doc.setLineWidth(0.2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        hex("#6b7280");
        doc.text(
          `${String.fromCharCode(65 + oi)}) ${clean(option)}`,
          ox + 6.5,
          oy + 4.7,
          { maxWidth: w / 2 - 10 }
        );
      });
    } else {
      const boxH = field.lines ? field.lines * 4.5 + 3 : 7;
      doc.setFillColor("#ffffff");
      doc.setDrawColor("#d1d5db");
      doc.roundedRect(x, rowTop + 6, w, boxH, 1.2, 1.2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      hex("#9ca3af");
      doc.text(clean(field.placeholder ?? ""), x + 2.5, rowTop + 10.4, {
        maxWidth: w - 5,
      });
    }

    rowMax = Math.max(rowMax, h);
    const last = i === all.length - 1;
    if (full || col === 1 || last) {
      rowTop += rowMax + 4;
      rowMax = 0;
    }
  });

  y = rowTop;

  if (block.actions?.length) {
    let bx = MARGIN + pad;
    block.actions.forEach(({ label, tone }) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const text = clean(label);
      const w = doc.getTextWidth(text) + 10;
      doc.setFillColor(tone === "danger" ? "#f23a4c" : C.brand);
      doc.roundedRect(bx, y, w, 7.5, 1.4, 1.4, "F");
      hex("#ffffff");
      doc.text(text, bx + w / 2, y + 5.1, { align: "center" });
      bx += w + 4;
    });
  }

  // Rounded back to the panel, whatever the rows measured.
  y = top + panelH + 5;
}

/**
 * A drawing of a screen: the tile row and the grid under it, or the
 * certificate sheet. The printed twin of `ScreenMock`.
 */
/**
 * The whole shell — sidebar, header bar, page body and footer — for a screen
 * the manual wants to show entire rather than in part.
 */
function drawFullScreen(block) {
  const sideW = 34;
  const headH = 7;
  const footH = 6;
  const rowH = 7;
  const tilesH = block.tiles ? 11 : 0;
  const bodyH = 9 + tilesH + 7 + rowH * (block.panel.rows.length + 1) + 5;
  const capH = block.caption ? measure(block.caption, BODY_W - 8, 8.5) + 4 : 0;
  const shellH = headH + bodyH + footH;
  need(shellH + capH + 6);

  const top = y;
  const right = MARGIN + sideW;
  const innerW = BODY_W - sideW;

  // Sidebar
  doc.setFillColor(C.brand);
  doc.rect(MARGIN, top, sideW, shellH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  hex("#ffffff");
  doc.text("REPL ETMS", MARGIN + 3, top + 5);
  doc.setDrawColor("#ffffff");
  doc.setLineWidth(0.2);
  doc.line(MARGIN, top + 7.5, MARGIN + sideW, top + 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("Employee Name", MARGIN + 3, top + 12);
  doc.setFontSize(5);
  doc.text(
    `[${block.officer ? "TRAINING OFFICER" : "USER"}]`,
    MARGIN + 3,
    top + 15.5
  );
  doc.line(MARGIN, top + 18, MARGIN + sideW, top + 18);

  const nav = ["HOME", "USER"];
  if (block.officer) nav.push("TRAINING OFFICER");
  nav.push("LOGOUT");
  const activeItem = block.officer ? "TRAINING OFFICER" : "USER";
  nav.forEach((label, i) => {
    const ny = top + 20 + i * 7;
    if (label === activeItem) {
      doc.setFillColor("#1e7ca0");
      doc.rect(MARGIN, ny, sideW, 7, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    hex("#ffffff");
    doc.text(clean(label), MARGIN + 3, ny + 4.6, { maxWidth: sideW - 5 });
  });

  // Header bar
  doc.setFillColor(C.brand);
  doc.rect(right, top, innerW, headH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  hex("#ffffff");
  doc.text("=", right + 3, top + 4.6);
  doc.text("HELP   ·   LOGOUT", PAGE_W - MARGIN - 3, top + 4.6, {
    align: "right",
  });

  // Page body
  doc.setFillColor("#f5f8fa");
  doc.rect(right, top + headH, innerW, bodyH, "F");

  let ty = top + headH + 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  hex(C.brand);
  doc.text(clean(block.screenTitle ?? ""), right + 3, ty + 3.4);
  doc.setFillColor(C.brand);
  doc.roundedRect(PAGE_W - MARGIN - 16, ty, 13, 5, 1, 1, "F");
  doc.setFontSize(5);
  hex("#ffffff");
  doc.text("< BACK", PAGE_W - MARGIN - 9.5, ty + 3.4, { align: "center" });
  ty += 9;

  if (block.tiles) {
    const gap = 2;
    const w = (innerW - 6 - gap * (block.tiles.length - 1)) / block.tiles.length;
    block.tiles.forEach(({ label, color, active }, i) => {
      const x = right + 3 + i * (w + gap);
      doc.setFillColor(color);
      doc.roundedRect(x, ty, w, 8, 1.2, 1.2, "F");
      if (active) {
        doc.setDrawColor("#374151");
        doc.setLineWidth(0.5);
        doc.roundedRect(x, ty, w, 8, 1.2, 1.2, "S");
        doc.setLineWidth(0.2);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.5);
      hex("#ffffff");
      doc.text(clean(label), x + w / 2, ty + 5, { align: "center" });
    });
    ty += tilesH;
  }

  drawGrid(block.panel, right + 3, ty, innerW - 6, rowH);

  // Footer
  const fy = top + headH + bodyH;
  doc.setFillColor("#ffffff");
  doc.rect(right, fy, innerW, footH, "F");
  doc.setDrawColor("#e5e7eb");
  doc.line(right, fy, right + innerW, fy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5);
  hex("#6b7280");
  doc.text(
    "Copyright (c) 2024-2025 Rucha Yantra Pvt. Ltd. All rights reserved.",
    right + 3,
    fy + 4
  );
  doc.text("Privacy Policy  ·  Terms  ·  Contact", PAGE_W - MARGIN - 3, fy + 4, {
    align: "right",
  });

  doc.setDrawColor("#d1d5db");
  doc.rect(MARGIN, top, BODY_W, shellH, "S");

  y = top + shellH + 3;
  if (block.caption) {
    text(block.caption, MARGIN, BODY_W, {
      size: 8.5,
      color: "#6b7280",
      lead: 1.4,
    });
  }
  y += 5;
}

/** The title bar, column heads and rows of one grid. Shared by both screens. */
function drawGrid(panel, x, ty, w, rowH) {
  const { title, color, columns, rows } = panel;

  doc.setFillColor(color);
  doc.rect(x, ty, w, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  hex("#ffffff");
  doc.text(clean(title), x + 2.5, ty + 4.2);
  ty += 7;

  const colW = w / columns.length;
  doc.setFillColor("#f5f5f5");
  doc.rect(x, ty, w, rowH, "F");
  doc.setFontSize(6);
  hex("#4b5563");
  columns.forEach((column, i) => {
    doc.text(fit(column, colW - 3), x + 2 + i * colW, ty + 4.6);
  });
  ty += rowH;

  doc.setFont("helvetica", "normal");
  rows.forEach((row) => {
    doc.setDrawColor("#f3f4f6");
    doc.line(x, ty + rowH, x + w, ty + rowH);
    row.forEach((value, i) => {
      const cx = x + 2 + i * colW;
      if (value && typeof value === "object" && value.pill) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        const label = clean(value.text.toUpperCase());
        const pw = doc.getTextWidth(label) + 3;
        doc.setFillColor(value.pill);
        doc.roundedRect(cx, ty + 1.6, pw, 4, 0.8, 0.8, "F");
        hex("#ffffff");
        doc.text(label, cx + 1.5, ty + 4.6);
        doc.setFont("helvetica", "normal");
      } else {
        doc.setFontSize(6);
        hex("#374151");
        const body =
          value === "@certificate" ? "view  ·  download" : value;
        doc.text(fit(body, colW - 3), cx, ty + 4.6);
      }
    });
    ty += rowH;
  });
}

function drawScreen(block) {
  if (block.full) return drawFullScreen(block);

  const pad = 4;
  const tilesH = block.tiles ? 11 : 0;
  const headH = block.chrome ? 7 : 0;
  const rowH = 7;
  const bodyH = block.panel
    ? 7 + rowH * (block.panel.rows.length + 1)
    : block.kind === "certificate"
      ? 52
      : 0;
  const capH = block.caption ? measure(block.caption, BODY_W - 8, 8.5) + 4 : 0;
  const panelH = headH + pad * 2 + tilesH + bodyH + capH;
  need(panelH + 5);

  const top = y;
  doc.setFillColor("#f5f8fa");
  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, top, BODY_W, panelH, 2, 2, "FD");

  let ty = top;
  if (block.chrome) {
    doc.setFillColor(C.brand);
    doc.rect(MARGIN, top, BODY_W, headH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    hex("#ffffff");
    doc.text("REPL ETMS", MARGIN + 4, top + 4.6);
    doc.text("HELP  ·  LOGOUT", PAGE_W - MARGIN - 4, top + 4.6, {
      align: "right",
    });
    ty += headH;
  }
  ty += pad;

  if (block.tiles) {
    const gap = 2.5;
    const w = (BODY_W - pad * 2 - gap * (block.tiles.length - 1)) / block.tiles.length;
    block.tiles.forEach(({ label, color, active }, i) => {
      const x = MARGIN + pad + i * (w + gap);
      doc.setFillColor(color);
      doc.roundedRect(x, ty, w, 8, 1.4, 1.4, "F");
      if (active) {
        doc.setDrawColor("#374151");
        doc.setLineWidth(0.5);
        doc.roundedRect(x, ty, w, 8, 1.4, 1.4, "S");
        doc.setLineWidth(0.2);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      hex("#ffffff");
      doc.text(clean(label), x + w / 2, ty + 5, { align: "center" });
    });
    ty += tilesH;
  }

  const innerW = BODY_W - pad * 2;

  if (block.kind === "certificate") {
    const x = MARGIN + pad;
    doc.setFillColor("#ffffff");
    doc.setDrawColor(C.brand);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, ty, innerW, 48, 2, 2, "FD");
    doc.setLineWidth(0.2);

    const mid = x + innerW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    hex(C.brand);
    doc.text("RUCHA ENGINEERS PVT. LTD.", mid, ty + 8, { align: "center" });
    doc.setFontSize(12);
    hex("#374151");
    doc.text("CERTIFICATE OF COMPLETION", mid, ty + 17, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    hex("#6b7280");
    doc.text("This is to certify that", mid, ty + 25, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    hex("#374151");
    doc.text("Employee Name", mid, ty + 32, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    hex("#6b7280");
    doc.text("has successfully completed", mid, ty + 38, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    hex(C.brand);
    doc.text("Introduction to Workplace Safety", mid, ty + 44, {
      align: "center",
    });
    ty += bodyH;
  }

  if (block.panel) {
    drawGrid(block.panel, MARGIN + pad, ty, innerW, rowH);
    ty += 7 + rowH * (block.panel.rows.length + 1);
  }

  if (block.caption) {
    y = ty + 3;
    text(block.caption, MARGIN + pad, BODY_W - pad * 2, {
      size: 8.5,
      color: "#6b7280",
      lead: 1.4,
    });
  }

  y = top + panelH + 5;
}

const DRAW = {
  heading: drawHeading,
  cards: drawCards,
  form: drawForm,
  screen: drawScreen,
  para: drawPara,
  steps: drawSteps,
  bullets: drawBullets,
  terms: drawTerms,
  notice: drawNotice,
};

/* ------------------------------------------------------------------ */
/* Chapters and cards                                                  */
/* ------------------------------------------------------------------ */

function chapterOpener(chapter, index) {
  newPage();
  doc.setFillColor(chapter.color);
  doc.rect(0, 0, PAGE_W, 34, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  hex("#ffffff");
  doc.text(`CHAPTER ${index + 1}`, MARGIN, 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(chapter.label, MARGIN, 26);

  y = 48;
  return doc.getNumberOfPages();
}

function drawCard(card) {
  // A card whose header would land at the very foot of a page reads as an
  // orphan — push it over rather than split it from its first block.
  need(34);

  const top = y;
  doc.setFillColor(card.color);
  doc.rect(MARGIN, top, BODY_W, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  hex("#ffffff");
  doc.text(card.title.toUpperCase(), MARGIN + 4, top + 5.6);

  y = top + 12;
  if (card.subtitle) {
    text(card.subtitle, MARGIN, BODY_W, {
      size: 10,
      color: INK_SOFT,
      lead: 1.45,
    });
    y += 3;
  }

  card.blocks.forEach((block) => DRAW[block.type]?.(block));

  y += 4;
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 7;
}

/* ------------------------------------------------------------------ */
/* Footers                                                             */
/* ------------------------------------------------------------------ */

function footers() {
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    hex("#9ca3af");
    doc.text(`${MANUAL_TITLE} ${MANUAL_NAME}`, MARGIN, PAGE_H - 9);
    doc.text(String(page), PAGE_W - MARGIN, PAGE_H - 9, { align: "right" });
  }
}

/* ------------------------------------------------------------------ */

cover();

CHAPTERS.forEach((chapter, index) => {
  const at = chapterOpener(chapter, index);
  const cards = [];
  chapter.cards.forEach((card) => {
    drawCard(card);
    cards.push({ title: card.title, page: doc.getNumberOfPages() });
  });
  contents.push({ label: chapter.label, color: chapter.color, page: at, cards });
});

// Built at the end so its page numbers are real, then carried back to page 2.
doc.movePage(contentsPage(), 2);

footers();

doc.setProperties({
  title: `${MANUAL_TITLE} ${MANUAL_NAME}`,
  subject: MANUAL_SUBTITLE,
  author: "Rucha Engineers Pvt. Ltd.",
});

writeFileSync(OUT, Buffer.from(doc.output("arraybuffer")));
console.log(`Wrote ${OUT} — ${doc.getNumberOfPages()} pages`);
