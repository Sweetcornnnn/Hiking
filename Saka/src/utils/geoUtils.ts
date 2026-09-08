export interface Viewpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: string;
  notes?: string;
}

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

export function buildTrailCoordinates(waypoints: Viewpoint[], steps: number = 20): Point[] {
  if (!waypoints || waypoints.length < 2) return [];

  const pts: Point[] = waypoints.map((wp) => ({
    latitude: wp.latitude,
    longitude: wp.longitude,
  }));

  const result: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < steps; s++) {
      result.push(linearInterpolate(pts[i], pts[i + 1], s / steps));
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}