"use client";

export function AvatarImg({ src, fallbackChar: _fallbackChar, className }: { src: string; fallbackChar: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling?.classList.remove("hidden");
      }}
    />
  );
}

export function HeaderImg({ src, className }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={(e) => {
        const parent = e.currentTarget.parentElement as HTMLElement;
        if (parent) parent.style.display = "none";
      }}
    />
  );
}
