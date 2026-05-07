import { describe, it, expect } from 'vitest';
import { timezonesToPathD } from '../src/timezones.js';

const W = 360; // 1 px per degree, easy to reason about
const H = 180;

describe('timezonesToPathD', () => {
  it('emits M then L for a simple polyline that does not cross the seam', () => {
    const data = {
      type: 'GeometryCollection' as const,
      geometries: [
        {
          type: 'LineString' as const,
          coordinates: [
            [10, 0],   // lonE=10  → x=10
            [20, 0],   // lonE=20  → x=20
            [30, 10],  // lonE=30  → x=30
          ],
        },
      ],
    };
    const d = timezonesToPathD(data, W, H);
    expect(d).toMatch(/^M10\.0,90\.0L20\.0,90\.0L30\.0,80\.0$/);
  });

  it('inserts an M (sub-path break) when a chord would cross the Greenwich seam', () => {
    // -1° (lonE=359) to +1° (lonE=1): in our antimeridian-centered
    // projection that's a chord from x≈359 to x=1, |Δx|≈358 > W/2=180.
    // A naive line would draw a flat stripe across the map, so we
    // must start a new sub-path.
    const data = {
      type: 'GeometryCollection' as const,
      geometries: [
        {
          type: 'LineString' as const,
          coordinates: [
            [-1, 45],
            [1, 45],
          ],
        },
      ],
    };
    const d = timezonesToPathD(data, W, H);
    // First command is M (start), second should also be M (seam break).
    const commands = d.match(/[ML]/g) ?? [];
    expect(commands).toEqual(['M', 'M']);
  });

  it('handles MultiLineString geometries', () => {
    const data = {
      type: 'GeometryCollection' as const,
      geometries: [
        {
          type: 'MultiLineString' as const,
          coordinates: [
            [[0, 0], [10, 0]],
            [[20, 0], [30, 0]],
          ],
        },
      ],
    };
    const d = timezonesToPathD(data, W, H);
    const commands = d.match(/[ML]/g) ?? [];
    // Two polylines → two M starts, plus one L per follow-up vertex.
    expect(commands).toEqual(['M', 'L', 'M', 'L']);
  });

  it('skips degenerate single-vertex lines', () => {
    const data = {
      type: 'GeometryCollection' as const,
      geometries: [
        { type: 'LineString' as const, coordinates: [[5, 5]] },
      ],
    };
    expect(timezonesToPathD(data, W, H)).toBe('');
  });
});
