import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import TrailMap from '../components/TrailMap';

/**
 * Mt. Madja-as — Flores Trail (Primary Route)
 * Jump-off: Barangay Flores, Culasi, Antique
 * Summit GPS: N11.38932° E122.16197° — 2,102 MASL
 * Total Distance: ~23.3 km one way (46.6 km round trip)
 * Elevation Gain: ~2,100m
 * Duration: 3–4 days | Difficulty: 8/9 Major Climb
 */

// ─── Named waypoints (marker pins only) ────────────────────────────────────
const MT_MADJAAS_VIEWPOINTS = [
  {
    id: 'v1',
    name: 'Barangay Flores Trailhead',
    latitude: 11.4210,
    longitude: 122.1080,
    elevation: '~50m',
    notes: 'Jump-off point. Register permits & hire guides here.',
  },
  {
    id: 'v2',
    name: 'Bantang River Crossing',
    latitude: 11.4120,
    longitude: 122.1150,
    elevation: '~1,000m',
    notes: 'First major landmark. Cold, clean water — refill here.',
  },
  {
    id: 'v3',
    name: 'Camp 1 — Bantang River Camp',
    latitude: 11.4050,
    longitude: 122.1230,
    elevation: '~1,000m',
    notes: 'Day 1 campsite, ~7–8 hrs from trailhead.',
  },
  {
    id: 'v4',
    name: 'Waterfall Section (Libog Falls)',
    latitude: 11.3980,
    longitude: 122.1310,
    elevation: '~1,418m',
    notes: 'One of 14 waterfalls. Steep ascent begins here.',
  },
  {
    id: 'v5',
    name: 'Mossy Forest Entry',
    latitude: 11.3950,
    longitude: 122.1390,
    elevation: '~1,200m',
    notes: 'Enter the cloud forest. Pitcher plants & orchids visible.',
  },
  {
    id: 'v6',
    name: 'Camp 2 — Mossy Camp',
    latitude: 11.3930,
    longitude: 122.1460,
    elevation: '~1,743m',
    notes: 'Day 2 campsite deep in mossy forest. Cold nights — layer up.',
  },
  {
    id: 'v7',
    name: 'Camp 3 — Upper Camp',
    latitude: 11.3915,
    longitude: 122.1540,
    elevation: '~1,800m',
    notes: 'Final campsite before summit push. Sea of clouds at sunrise.',
  },
  {
    id: 'v8',
    name: 'Crown Shyness Forest',
    latitude: 11.3905,
    longitude: 122.1580,
    elevation: '~1,950m',
    notes: 'Rare natural phenomenon — look up for canopy gap patterns.',
  },
  {
    id: 'v9',
    name: 'Summit Ridge',
    latitude: 11.3898,
    longitude: 122.1605,
    elevation: '~2,050m',
    notes: 'Exposed rocky ridge — stay cautious, strong winds.',
  },
  {
    id: 'v10',
    name: 'Mt. Madja-as Summit',
    latitude: 11.3893,
    longitude: 122.1620,
    elevation: '2,102m',
    notes: 'Highest peak on Panay. 360° views — Panay, seas & Negros.',
  },
];

// ─── Linear interpolation between waypoints ──────────────────────────────────────
// Generates a continuous trail by linearly interpolating between waypoints.
// Creates evenly-spaced coordinate points along the direct path.

interface Point {
  latitude: number;
  longitude: number;
}

function linearInterpolate(p1: Point, p2: Point, t: number): Point {
  return {
    latitude: p1.latitude + (p2.latitude - p1.latitude) * t,
    longitude: p1.longitude + (p2.longitude - p1.longitude) * t,
  };
}

function buildTrailCoordinates(waypoints: Point[], stepsPerSegment: number = 20): Point[] {
  const pts = waypoints.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const result: Point[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];

    for (let s = 0; s < stepsPerSegment; s++) {
      result.push(linearInterpolate(p1, p2, s / stepsPerSegment));
    }
  }

  // Always close with the exact summit coordinate
  result.push(pts[pts.length - 1]);
  return result;
}

// ─── Screen component ───────────────────────────────────────────────────────
export default function MtMadjaasScreen(): React.ReactElement {
  // Memoized so the spline only runs once, not on every render
  const trailCoordinates = useMemo(
    () => buildTrailCoordinates(MT_MADJAAS_VIEWPOINTS, 100),
    []
  );

  return (
    <TrailMap
      mountainId="1"
      mountainName="Mt. Madja-as"
      centerCoord={{ latitude: 11.4050, longitude: 122.1350 }}
      viewpoints={MT_MADJAAS_VIEWPOINTS}
      trailCoordinates={trailCoordinates}
      zoomLevel={13.8}
      trailColor="#E05C2A"
      trailWidth={2.5}
      showTrailLine
    />
  );
}