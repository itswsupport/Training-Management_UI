"use client";
import React from "react";

export default function StatusCard({ label, Icon, color, isActive, onClick, animate, count }) {
  return (
    <button
      onClick={onClick}
      className={`${color} text-white p-4 rounded shadow flex flex-col items-center justify-center transition-all ${
        isActive ? "brightness-110 scale-[1.02]" : "hover:cursor-pointer"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={`w-10 h-10 mb-2 ${animate || ""}`} />
      <span className="font-semibold text-base">{label}</span>
      {count !== undefined && (
        <span className="text-sm opacity-90">({count})</span>
      )}
    </button>
  );
}
