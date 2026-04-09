"use client";

import { useState, useRef, useEffect } from "react";

interface ShareButtonsProps {
  url?: string;
  title?: string;
  text?: string;
}

const SHARE_TARGETS = [
  {
    key: "x",
    label: "X (Twitter)",
    icon: "𝕏",
    buildUrl: (url: string, text: string) =>
      `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "f",
    buildUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: "in",
    buildUrl: (url: string, _text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: "✈",
    buildUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    key: "reddit",
    label: "Reddit",
    icon: "r/",
    buildUrl: (url: string, text: string) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: "wa",
    buildUrl: (url: string, text: string) =>
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`,
  },
] as const;

export default function ShareButtons({ url, title = "KolQuest", text }: ShareButtonsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareText = text || title;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Share</span>
          </div>
          {SHARE_TARGETS.map((t) => (
            <a
              key={t.key}
              href={t.buildUrl(shareUrl, shareText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/80 transition-colors text-sm text-zinc-300 hover:text-white"
            >
              <span className="w-6 text-center text-xs font-bold text-zinc-500">{t.icon}</span>
              {t.label}
            </a>
          ))}
          <div className="border-t border-border">
            <button
              onClick={copyLink}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800/80 transition-colors text-sm text-zinc-300 hover:text-white"
            >
              <span className="w-6 text-center text-xs">
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-buy inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-zinc-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </span>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
