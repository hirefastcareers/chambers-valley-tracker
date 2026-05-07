"use client";

import type { MouseEvent } from "react";

function FacebookFOnBlueCircle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="white"
        d="M13.9 12.5h-2.2V22H8.9v-9.5H7V9.9h1.9V8.1c0-1.9 1-3 3-3 1 0 1.6.1 1.6.1v1.9h-1.3c-.8 0-1 .5-1 1.2v1.9h2.4l-.3 2.2z"
      />
    </svg>
  );
}

export default function FacebookPostPillButton({
  onClick,
  className = "",
}: {
  onClick: (e: MouseEvent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 font-semibold leading-none active:scale-[0.99]",
        className,
      ].join(" ")}
      style={{
        border: "1px solid #1877F2",
        color: "#1877F2",
        background: "white",
        borderRadius: 8,
        padding: "5px 12px",
        fontSize: 13,
      }}
    >
      <FacebookFOnBlueCircle size={14} />
      Post
    </button>
  );
}
