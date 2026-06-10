"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { store, Selection } from "@/lib/store";
import { BODIES } from "@/lib/bodies";

interface Result {
  label: string;
  sub: string;
  selection: Selection;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [starIndex, setStarIndex] = useState<{ name: string; index: number; mag: number }[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Build the star search index once the engine catalog is loaded.
    let cancelled = false;
    const tryLoad = async () => {
      const e = (await import("@/engine/Engine")).engineRef.current;
      const cat = e?.getStarCatalog();
      if (cat && !cancelled) {
        const idx: { name: string; index: number; mag: number }[] = [];
        for (const [i, name] of Object.entries(cat.names)) {
          idx.push({ name, index: Number(i), mag: cat.mag[Number(i)] });
        }
        for (const [i, name] of Object.entries(cat.bayer)) {
          idx.push({ name, index: Number(i), mag: cat.mag[Number(i)] });
        }
        setStarIndex(idx);
      } else if (!cancelled) {
        setTimeout(tryLoad, 1000);
      }
    };
    tryLoad();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    globalThis.addEventListener("mousedown", close);
    return () => globalThis.removeEventListener("mousedown", close);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Result[] = [];
    for (const b of BODIES) {
      if (b.name.toLowerCase().includes(q)) {
        out.push({ label: b.name, sub: b.type, selection: { kind: "body", id: b.id } });
      }
    }
    const starHits = starIndex
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => a.mag - b.mag)
      .slice(0, 8);
    for (const s of starHits) {
      out.push({
        label: s.name,
        sub: `star · mag ${s.mag.toFixed(1)}`,
        selection: { kind: "star", index: s.index },
      });
    }
    return out.slice(0, 10);
  }, [query, starIndex]);

  const choose = async (r: Result) => {
    store.set({ selection: r.selection, panel: "info" });
    setOpen(false);
    setQuery("");
    const e = (await import("@/engine/Engine")).engineRef.current;
    e?.focusSelection(r.selection);
  };

  return (
    <div className="search-box" ref={boxRef}>
      <input
        type="text"
        placeholder="Search planets, moons, stars…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length > 0) choose(results[0]);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button key={`${r.label}-${i}`} className="search-result" onClick={() => choose(r)}>
              <span>{r.label}</span>
              <span className="result-sub">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
