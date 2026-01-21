import { getDistance } from 'geolib';

export function computeDistanceMeters(p1, p2) {
  if (!p1 || !p2) return 0;
  try {
    const dist = getDistance(
      { latitude: p1.latitude, longitude: p1.longitude },
      { latitude: p2.latitude, longitude: p2.longitude }
    );
    return dist || 0;
  } catch (e) {
    console.error('computeDistanceMeters error', e);
    return 0;
  }
}