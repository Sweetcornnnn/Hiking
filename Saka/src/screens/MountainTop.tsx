import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View } from 'react-native';
import TrailMap from '../components/TrailMap';

/**
 * Mt. Madja-as — Flores Trail (Primary Route)
 *
 * Fullscreen fix: the parent screen must have no padding/margin/header
 * so TrailMap's edges={[]} SafeAreaView can bleed to all edges.
 * If this screen is inside a drawer/stack navigator, set:
 *   headerShown: false
 *   contentStyle: { padding: 0 }
 */

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

interface Point { latitude: number; longitude: number; }

function linearInterpolate(p1: Point, p2: Point, t: number): Point {
  return {
    latitude:  p1.latitude  + (p2.latitude  - p1.latitude)  * t,
    longitude: p1.longitude + (p2.longitude - p1.longitude) * t,
  };
}

function buildTrailCoordinates(waypoints: Point[], steps = 20): Point[] {
  const pts    = waypoints.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const result: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < steps; s++) {
      result.push(linearInterpolate(pts[i], pts[i + 1], s / steps));
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

export default function MtMadjaasScreen(): React.ReactElement {
  const trailCoordinates = useMemo(
    () => buildTrailCoordinates(MT_MADJAAS_VIEWPOINTS, 100),
    [],
  );

  // Wrap in a plain View with flex:1 and NO padding so TrailMap
  // (which uses edges={[]} internally) fills edge-to-edge.
  return (
    <View style={styles.root}>
      <TrailMap
        mountainId="1"
        mountainName="Mt. Madja-as"
        centerCoord={{ latitude: 11.4050, longitude: 122.1350 }}
        viewpoints={MT_MADJAAS_VIEWPOINTS}
        trailCoordinates={trailCoordinates}
        zoomLevel={13.8}
        trailColor="#C9A96E"
        trailWidth={2.5}
        showTrailLine
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // NO padding, NO margin, NO safe area — let TrailMap handle it all
  root: {
    flex: 1,
    backgroundColor: '#0E1520',
  },
});