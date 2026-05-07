// Choose a Blue Marble image filename for a given UTC date.
//
// The bundle ships 24 Blue Marble composites — start (day 1) and
// mid (day 15) of each month, sampled from NASA SVS dataset 3523's
// daily interpolation between the 12 BMNG monthly composites.
//
// Picking by closest neighbor in date space:
//   day  1–7  → this month's "start"   (centered on day 1)
//   day  8–22 → this month's "mid"     (centered on day 15)
//   day 23+   → next month's "start"   (~day 31 ≈ next-month day 1)

export function dayImageForDate(d: Date): string {
  const day = d.getUTCDate(); // 1..31
  let month = d.getUTCMonth() + 1; // 1..12
  let half: 'start' | 'mid';
  if (day < 8) {
    half = 'start';
  } else if (day < 23) {
    half = 'mid';
  } else {
    half = 'start';
    month = month === 12 ? 1 : month + 1;
  }
  const mm = String(month).padStart(2, '0');
  return `blue-marble-${mm}-${half}-2048.jpg`;
}
