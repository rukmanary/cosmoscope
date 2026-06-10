export function formatSimDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMass(kg: number): string {
  const exp = Math.floor(Math.log10(kg));
  const mant = kg / 10 ** exp;
  return `${mant.toFixed(2)} × 10${superscript(exp)} kg`;
}

function superscript(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻",
  };
  return String(n).split("").map((c) => map[c] ?? c).join("");
}

export function formatKm(km: number): string {
  return `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

export function formatDistanceLy(parsecs: number): string {
  if (parsecs >= 100000) return "very distant";
  const ly = parsecs * 3.26156;
  if (ly < 1000) return `${ly.toFixed(1)} light-years`;
  return `${(ly / 1000).toFixed(2)} thousand ly`;
}

export function formatDays(days: number): string {
  if (days < 1) return `${(days * 24).toFixed(1)} hours`;
  if (days < 1000) return `${days.toFixed(2)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
}

export function formatHours(hours: number): string {
  const h = Math.abs(hours);
  const retro = hours < 0 ? " (retrograde)" : "";
  if (h < 100) return `${h.toFixed(2)} hours${retro}`;
  return `${(h / 24).toFixed(1)} days${retro}`;
}

/** Rough spectral class from B−V colour index. */
export function spectralClassFromBV(bv: number): string {
  if (bv < -0.02) return "B (blue-white)";
  if (bv < 0.3) return "A (white)";
  if (bv < 0.58) return "F (yellow-white)";
  if (bv < 0.81) return "G (yellow, Sun-like)";
  if (bv < 1.4) return "K (orange)";
  return "M (red)";
}
