"use client";

import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { AstroEvent, findUpcomingEvents } from "@/lib/events";
import { formatSimDate } from "@/lib/format";
import { PanelHeader } from "./InfoPanel";

export function EventsPanel() {
  const [events, setEvents] = useState<AstroEvent[] | null>(null);

  useEffect(() => {
    // Search from current sim time; runs real ephemeris root-finding, so defer a tick.
    const t = store.get().simTimeMs;
    const id = setTimeout(() => setEvents(findUpcomingEvents(t)), 30);
    return () => clearTimeout(id);
  }, []);

  const jump = async (ev: AstroEvent) => {
    const e = (await import("@/engine/Engine")).engineRef.current;
    if (!e) return;
    e.setTimeMs(ev.timeMs);
    store.set({ paused: true, timeRate: 1 });
    if (ev.observer) {
      e.setObserver("earth", ev.observer.lat, ev.observer.lon);
      // Look toward the Sun to see the eclipse.
      setTimeout(() => e.focusSelection({ kind: "body", id: "sun" }), 100);
    }
  };

  return (
    <aside className="panel events-panel">
      <PanelHeader title="Upcoming events" />
      <div className="panel-body">
        <p className="info-small">
          Computed from the simulation clock with real ephemerides. Click an event to jump to it.
        </p>
        {!events && <p className="info-small">Searching the sky…</p>}
        {events?.map((ev) => (
          <button key={`${ev.title}-${ev.timeMs}`} className="event-card" onClick={() => jump(ev)}>
            <span className="event-icon">{ev.icon}</span>
            <span className="event-text">
              <strong>{ev.title}</strong>
              <span className="event-date">{formatSimDate(ev.timeMs)}</span>
              <span className="event-desc">{ev.description}</span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
