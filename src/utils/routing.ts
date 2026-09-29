/**
 * OSRM Road Routing & Street Distance Utility
 * Calculates real driving distance and geometries along streets on OpenStreetMap.
 */

interface RouteResult {
  distanceKm: number;
  durationMin: number;
  coordinates: [number, number][]; // [lat, lon]
}

const routeCache = new Map<string, RouteResult>();

export async function fetchStreetRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteResult> {
  const cacheKey = `${startLat.toFixed(4)},${startLon.toFixed(4)}->${endLat.toFixed(4)},${endLon.toFixed(4)}`;
  
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!;
  }

  // Calculate fallback Haversine distance with street factor (1.35x for realistic street winding)
  const R = 6371; // km
  const dLat = ((endLat - startLat) * Math.PI) / 180;
  const dLon = ((endLon - startLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((endLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = R * c;
  const fallbackKm = parseFloat((haversineKm * 1.35).toFixed(2));
  const fallbackMin = Math.max(2, Math.round(fallbackKm * 3.5 + 3));
  const fallbackResult: RouteResult = {
    distanceKm: fallbackKm,
    durationMin: fallbackMin,
    coordinates: [
      [startLat, startLon],
      [endLat, endLon],
    ],
  };

  // If start and end are practically identical (< 20 meters)
  if (haversineKm < 0.02) {
    const samePointResult: RouteResult = {
      distanceKm: 0.05,
      durationMin: 1,
      coordinates: [[startLat, startLon], [endLat, endLon]],
    };
    routeCache.set(cacheKey, samePointResult);
    return samePointResult;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      routeCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance;
      const durationSeconds = primaryRoute.duration;

      const distKm = parseFloat((distanceMeters / 1000).toFixed(2));
      const durMin = Math.max(1, Math.round(durationSeconds / 60));

      // GeoJSON is [lon, lat], Leaflet polyline expects [lat, lon]
      const streetCoords: [number, number][] = primaryRoute.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      const result: RouteResult = {
        distanceKm: distKm,
        durationMin: durMin,
        coordinates: streetCoords,
      };

      routeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('OSRM routing fetch failed or timed out, using fallback street distance:', err);
  }

  routeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Synchronous Haversine + street factor calculation for instant UI rendering before async OSRM resolves.
 */
export function calculateRoadDistanceSync(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): { distanceKm: number; durationMin: number } {
  const R = 6371;
  const dLat = ((endLat - startLat) * Math.PI) / 180;
  const dLon = ((endLon - startLon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((endLat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = R * c;
  // Apply 1.32x average Paraguayan/urban street detour factor
  const roadKm = parseFloat((haversineKm * 1.32).toFixed(2));
  const durMin = Math.max(2, Math.round(roadKm * 3.5 + 3));
  return { distanceKm: roadKm, durationMin: durMin };
}
