/**
 * Serviço de Cálculo de Cercas Virtuais (Geofencing)
 * Utiliza a fórmula de Haversine para determinar a distância geodésica em metros.
 */

const EARTH_RADIUS_METERS = 6371000; // Raio médio da Terra

/**
 * Retorna a distância em metros entre duas coordenadas geográficas
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Verifica se um ponto está dentro do raio de uma cerca circular
 */
export function isPointInsideGeofence(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistanceMeters(lat, lon, centerLat, centerLon);
  return distance <= radiusMeters;
}
