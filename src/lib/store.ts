"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "surface" | "space";

export interface Observer {
  bodyId: string;
  lat: number; // degrees, planetographic
  lon: number; // degrees, east-positive
}

export type Selection =
  | { kind: "body"; id: string }
  | { kind: "star"; index: number }
  | null;

/** Earth surface scenery (other bodies always use their own rocky terrain). */
export type Landscape = "grass" | "desert" | "city";

export interface Settings {
  constellations: boolean;
  constellationLabels: boolean;
  starLabels: boolean;
  bodyLabels: boolean;
  orbits: boolean;
  atmosphere: boolean;
  milkyWay: boolean;
  ground: boolean;
  landscape: Landscape;
}

export type PanelId = "info" | "events" | "settings" | "location" | "help" | null;

export interface AppState {
  mode: ViewMode;
  observer: Observer;
  /** Space-mode camera target body id. */
  followBodyId: string;
  /** Simulation seconds advanced per real second (signed). */
  timeRate: number;
  paused: boolean;
  /** Mirrored from the engine clock a few times per second for display. */
  simTimeMs: number;
  selection: Selection;
  panel: PanelId;
  settings: Settings;
  /** Field of view in degrees (surface mode zoom / telescope simulation). */
  fovDeg: number;
  /** Object the surface-mode camera is locked onto (follows it through time). */
  tracking: Selection;
  trackingLabel: string;
  /** Telescope eyepiece view (implies tracking + narrow FOV). */
  telescope: boolean;
  /** True while the tracked object is below the observer's horizon. */
  trackedBelowHorizon: boolean;
}

const initialState: AppState = {
  mode: "surface",
  observer: { bodyId: "earth", lat: -6.2, lon: 106.8 }, // Jakarta
  followBodyId: "earth",
  timeRate: 1,
  paused: false,
  simTimeMs: Date.now(),
  selection: null,
  panel: null,
  settings: {
    constellations: true,
    constellationLabels: true,
    starLabels: true,
    bodyLabels: true,
    orbits: true,
    atmosphere: true,
    milkyWay: true,
    ground: true,
    landscape: "grass",
  },
  fovDeg: 60,
  tracking: null,
  trackingLabel: "",
  telescope: false,
  trackedBelowHorizon: false,
};

type Listener = () => void;

class Store {
  private state: AppState = initialState;
  private readonly listeners = new Set<Listener>();

  get = (): AppState => this.state;

  set = (partial: Partial<AppState>) => {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  };

  setSettings = (partial: Partial<Settings>) => {
    this.set({ settings: { ...this.state.settings, ...partial } });
  };

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}

export const store = new Store();

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(initialState)
  );
}

/** Time-rate presets, in simulated seconds per real second. */
export const TIME_RATES: { rate: number; label: string }[] = [
  { rate: 1, label: "real time" },
  { rate: 60, label: "1 min/s" },
  { rate: 3600, label: "1 hr/s" },
  { rate: 86400, label: "1 day/s" },
  { rate: 7 * 86400, label: "1 wk/s" },
  { rate: 30 * 86400, label: "1 mo/s" },
  { rate: 365.25 * 86400, label: "1 yr/s" },
];
