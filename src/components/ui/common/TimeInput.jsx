"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";

// ─── Clock Face Picker (24hr) ────────────────────────────────────
function ClockPicker({ hour, minute, onDone, onCancel }) {
  const [mode, setMode] = useState("hour");
  const [selHour, setSelHour] = useState(hour ?? 0);
  const [selMinute, setSelMinute] = useState(minute ?? 0);
  const [innerRing, setInnerRing] = useState((hour ?? 0) >= 12);
  const clockRef = useRef(null);
  const dragging = useRef(false);

  const OUTER_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const INNER_HOURS = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const SIZE = 220;
  const CENTER = SIZE / 2;
  const OUTER_R = 90;
  const INNER_R = 62;
  const DOT_R = 14;

  const getAngle = (idx) => (idx * 30 - 90) * (Math.PI / 180);
  const minuteAngle = (m) => (m * 6 - 90) * (Math.PI / 180);

  const pointerFromEvent = useCallback(
    (e) => {
      if (!clockRef.current) return;
      const rect = clockRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = clientX - rect.left - CENTER;
      const y = clientY - rect.top - CENTER;
      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      const dist = Math.sqrt(x * x + y * y);

      if (mode === "hour") {
        const step = Math.round(angle / 30) % 12;
        const isInner = dist < (OUTER_R + INNER_R) / 2;
        const h = isInner ? INNER_HOURS[step] : OUTER_HOURS[step];
        setSelHour(h);
        setInnerRing(isInner);
      } else {
        const step = Math.round(angle / 6) % 60;
        setSelMinute(step);
      }
    },
    [mode]
  );

  const handlePointerDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    pointerFromEvent(e);
  };
  const handlePointerMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    pointerFromEvent(e);
  };

  useEffect(() => {
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        if (mode === "hour") setMode("minute");
      }
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [mode]);

  const handTarget = (() => {
    if (mode === "hour") {
      const idx = innerRing ? INNER_HOURS.indexOf(selHour) : OUTER_HOURS.indexOf(selHour);
      const a = getAngle(idx >= 0 ? idx : 0);
      const r = innerRing ? INNER_R : OUTER_R;
      return { x: CENTER + r * Math.cos(a), y: CENTER + r * Math.sin(a) };
    }
    const a = minuteAngle(selMinute);
    return { x: CENTER + OUTER_R * Math.cos(a), y: CENTER + OUTER_R * Math.sin(a) };
  })();

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-3 select-none" style={{ width: 260 }} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-center gap-1 mb-3">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={`text-[26px] font-bold px-2 py-0.5 rounded transition-colors ${mode === "hour" ? "bg-[#3482AE] text-white" : "text-gray-500 hover:bg-gray-100"}`}
        >
          {pad(selHour)}
        </button>
        <span className="text-[26px] font-bold text-gray-400">:</span>
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={`text-[26px] font-bold px-2 py-0.5 rounded transition-colors ${mode === "minute" ? "bg-[#3482AE] text-white" : "text-gray-500 hover:bg-gray-100"}`}
        >
          {pad(selMinute)}
        </button>
      </div>

      {/* Clock face */}
      <div
        className="relative mx-auto bg-gray-100 rounded-full cursor-pointer touch-none"
        style={{ width: SIZE, height: SIZE }}
        ref={clockRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
      >
        <div className="absolute w-2 h-2 bg-[#3482AE] rounded-full" style={{ left: CENTER - 4, top: CENTER - 4 }} />

        <svg className="absolute inset-0" width={SIZE} height={SIZE}>
          <line x1={CENTER} y1={CENTER} x2={handTarget.x} y2={handTarget.y} stroke="#3482AE" strokeWidth={2} />
          <circle cx={handTarget.x} cy={handTarget.y} r={DOT_R} fill="#3482AE" opacity={0.15} />
          <circle cx={handTarget.x} cy={handTarget.y} r={2} fill="#3482AE" />
        </svg>

        {mode === "hour" ? (
          <>
            {OUTER_HOURS.map((h, i) => {
              const a = getAngle(i);
              const x = CENTER + OUTER_R * Math.cos(a);
              const y = CENTER + OUTER_R * Math.sin(a);
              const isSelected = !innerRing && selHour === h;
              return (
                <div key={`o${h}`} className={`absolute flex items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${isSelected ? "bg-[#3482AE] text-white" : "text-gray-700"}`} style={{ width: DOT_R * 2, height: DOT_R * 2, left: x - DOT_R, top: y - DOT_R }}>
                  {h}
                </div>
              );
            })}
            {INNER_HOURS.map((h, i) => {
              const a = getAngle(i);
              const x = CENTER + INNER_R * Math.cos(a);
              const y = CENTER + INNER_R * Math.sin(a);
              const isSelected = innerRing && selHour === h;
              return (
                <div key={`i${h}`} className={`absolute flex items-center justify-center rounded-full text-[11px] transition-colors ${isSelected ? "bg-[#3482AE] text-white font-semibold" : "text-gray-400"}`} style={{ width: DOT_R * 2, height: DOT_R * 2, left: x - DOT_R, top: y - DOT_R }}>
                  {pad(h)}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {MINUTES.map((m) => {
              const a = minuteAngle(m);
              const x = CENTER + OUTER_R * Math.cos(a);
              const y = CENTER + OUTER_R * Math.sin(a);
              const isSelected = selMinute === m;
              return (
                <div key={`m${m}`} className={`absolute flex items-center justify-center rounded-full text-[12px] font-semibold transition-colors ${isSelected ? "bg-[#3482AE] text-white" : "text-gray-700"}`} style={{ width: DOT_R * 2, height: DOT_R * 2, left: x - DOT_R, top: y - DOT_R }}>
                  {pad(m)}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[12px] text-gray-600 hover:bg-gray-100 rounded transition-colors">
          Cancel
        </button>
        <button type="button" onClick={() => onDone(`${pad(selHour)}:${pad(selMinute)}`)} className="px-3 py-1.5 text-[12px] bg-[#3482AE] text-white rounded hover:bg-[#2a6a8f] transition-colors font-semibold">
          OK
        </button>
      </div>
    </div>
  );
}

// ─── Compute best position for the clock popup ───────────────────
const CLOCK_W = 260;
const CLOCK_H = 340; // approx height of clock picker
const GAP = 6;

function calcPosition(inputRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top, left;

  // Vertical: prefer below, fallback above
  const spaceBelow = vh - inputRect.bottom;
  const spaceAbove = inputRect.top;

  if (spaceBelow >= CLOCK_H + GAP) {
    top = inputRect.bottom + GAP;
  } else if (spaceAbove >= CLOCK_H + GAP) {
    top = inputRect.top - CLOCK_H - GAP;
  } else {
    // Not enough space above or below — center vertically
    top = Math.max(GAP, (vh - CLOCK_H) / 2);
  }

  // Horizontal: try to align left edge with input, fallback right-align, fallback center
  const spaceRight = vw - inputRect.left;
  const spaceLeft = inputRect.right;

  if (spaceRight >= CLOCK_W + GAP) {
    left = inputRect.left;
  } else if (spaceLeft >= CLOCK_W + GAP) {
    left = inputRect.right - CLOCK_W;
  } else {
    left = Math.max(GAP, (vw - CLOCK_W) / 2);
  }

  // Clamp so it never goes off-screen
  top = Math.max(GAP, Math.min(top, vh - CLOCK_H - GAP));
  left = Math.max(GAP, Math.min(left, vw - CLOCK_W - GAP));

  return { top, left };
}

// ─── TimeInput Component ─────────────────────────────────────────
const TimeInput = ({ value, onChange, className = "", placeholder = "HH:mm", ...props }) => {
  const [displayValue, setDisplayValue] = useState(value || "");
  const [showClock, setShowClock] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);

  const isValidTime = (timeStr) => {
    const regex = /^(\d{1,2}):(\d{2})$/;
    if (!regex.test(timeStr)) return false;
    const [hh, mm] = timeStr.split(":").map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  };

  const handleTextInputChange = (e) => {
    let inputValue = e.target.value;
    inputValue = inputValue.replace(/[^\d:]/g, "");
    if (inputValue.length === 2 && !inputValue.includes(":")) {
      inputValue = inputValue + ":";
    }
    if (inputValue.length > 5) {
      inputValue = inputValue.substring(0, 5);
    }
    setDisplayValue(inputValue);
    if (inputValue === "" || isValidTime(inputValue)) {
      onChange(inputValue);
    }
  };

  const openClock = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setPos(calcPosition(rect));
    }
    setShowClock(true);
  };

  // Recalc position on scroll/resize while open
  useEffect(() => {
    if (!showClock) return;
    const reposition = () => {
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPos(calcPosition(rect));
      }
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [showClock]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!showClock) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") setShowClock(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [showClock]);

  useEffect(() => {
    setDisplayValue(value || "");
  }, [value]);

  const parsedHour = isValidTime(displayValue) ? parseInt(displayValue.split(":")[0], 10) : 0;
  const parsedMinute = isValidTime(displayValue) ? parseInt(displayValue.split(":")[1], 10) : 0;

  const renderClock = () => {
    if (!showClock || typeof document === "undefined") return null;
    return ReactDOM.createPortal(
      <>
        {/* Invisible backdrop to catch outside clicks */}
        <div className="fixed inset-0 z-[99998]" onClick={() => setShowClock(false)} onTouchEnd={() => setShowClock(false)} />
        {/* Clock positioned near input */}
        <div className="fixed z-[99999]" style={{ top: pos.top, left: pos.left }}>
          <ClockPicker
            hour={parsedHour}
            minute={parsedMinute}
            onDone={(time) => {
              setDisplayValue(time);
              onChange(time);
              setShowClock(false);
            }}
            onCancel={() => setShowClock(false)}
          />
        </div>
      </>,
      document.body
    );
  };

  return (
    <div className="relative w-full" ref={inputRef}>
      <input
        type="text"
        value={displayValue || ""}
        onChange={handleTextInputChange}
        onFocus={openClock}
        placeholder={placeholder}
        className={`${className} pr-8 w-full min-w-0`}
        maxLength={5}
        title="Time format: HH:mm (24-hour)"
        {...props}
      />

      <button
        type="button"
        onClick={openClock}
        className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1 touch-manipulation"
        tabIndex={-1}
        aria-label="Open time picker"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {renderClock()}
    </div>
  );
};

export default TimeInput;
