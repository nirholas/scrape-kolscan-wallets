"use client";

import { useState, useEffect } from "react";

export interface DocSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface DocNavProps {
  sections: DocSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
}

export default function DocNav({ sections, activeSection, onSectionChange }: DocNavProps) {
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-20 bg-bg-primary/95 backdrop-blur-sm border-b border-border transition-shadow ${
        isSticky ? "shadow-lg shadow-black/20" : ""
      }`}
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mx-2 px-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? "bg-accent/15 text-accent"
                  : "text-zinc-400 hover:text-white hover:bg-bg-hover"
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// Sidebar nav for desktop (optional alternative)
export function DocSidebar({
  sections,
  activeSection,
  subsections,
}: {
  sections: DocSection[];
  activeSection: string;
  subsections?: Record<string, { id: string; label: string }[]>;
}) {
  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-20 space-y-1">
        {sections.map((section) => (
          <div key={section.id}>
            <a
              href={`#${section.id}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-zinc-400 hover:text-white hover:bg-bg-hover"
              }`}
            >
              {section.icon}
              {section.label}
            </a>
            {subsections?.[section.id] && activeSection === section.id && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                {subsections[section.id].map((sub) => (
                  <a
                    key={sub.id}
                    href={`#${sub.id}`}
                    className="block py-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    {sub.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

// Search bar for docs
export function DocSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        placeholder="Search documentation..."
        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-card border border-border text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {query && (
        <button
          onClick={() => {
            setQuery("");
            onSearch("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
