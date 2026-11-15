// How a calendar year is SHOWN to a person. `world.year` is stored as a plain number that goes negative
// before year 1 (Bronze and Stone age worlds); that is right for the simulation and stays as it is, but a
// minus sign must never reach the screen or a sentence. Everything a person reads goes through here.
//
// Mapping (ruling): the simple one, because the stored numbers then match the ones on screen.
//   y > 0   -> "1853"
//   y < 0   -> "2385 BC"   (-y, so a count that rises on the screen's year-by-year tick counts DOWN: 2385 BC, 2384 BC ...)
//   y == 0  -> "1 BC"      (there is no year 0 in the calendar; the one tick of stored 0 and stored -1 both read "1 BC")
// This is display only: never parse it back, never put it in an id or an event.

/** The year as plain words: "1853", "2385 BC". Fits a sentence ("in the year 2385 BC"). */
export function yearLabel(y: number): string {
  const n = Math.round(y);
  if (n > 0) return String(n);
  return `${n === 0 ? 1 : -n} BC`;
}

/** The short form for cards and tight places: "Y1853" for the common era, "2386 BC" before it. */
export function yearShort(y: number): string {
  return Math.round(y) > 0 ? `Y${Math.round(y)}` : yearLabel(y);
}

/** A span of years: "2235 to 2246", "120 BC to 45" (across the divide), "2385 to 2380 BC" (both before it). */
export function yearRange(a: number, b: number): string {
  const ra = Math.round(a), rb = Math.round(b);
  if (ra <= 0 && rb <= 0) return `${ra === 0 ? 1 : -ra} to ${yearLabel(rb)}`;
  return `${yearLabel(ra)} to ${yearLabel(rb)}`;
}
