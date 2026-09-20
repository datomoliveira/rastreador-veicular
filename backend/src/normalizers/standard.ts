import { NormalizedTelemetry } from '../types';

/**
 * Normalizador para JSON Padrão
 * Exemplo de Payload recebido:
 * {
 *   "device_id": "veiculo-01",
 *   "lat": -23.55052,
 *   "lng": -46.633308,
 *   "speed": 45.2,
 *   "heading": 90,
 *   "battery": 88,
 *   "ignition": 1,
 *   "accuracy": 5,
 *   "timestamp": "2026-09-19T20:30:00.000Z"
 * }
 */
export function normalizeStandardJsonPayload(body: any): NormalizedTelemetry | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const deviceId = body.device_id || body.deviceId || body.id;
  const lat = body.lat !== undefined ? body.lat : body.latitude;
  const lng = body.lng !== undefined ? body.lng : (body.lon !== undefined ? body.lon : body.longitude);

  if (!deviceId || lat === undefined || lng === undefined) {
    return null;
  }

  const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
  const longitude = typeof lng === 'number' ? lng : parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const rawSpeed = body.speed !== undefined ? (typeof body.speed === 'number' ? body.speed : parseFloat(body.speed)) : 0;
  const speed = isNaN(rawSpeed) ? 0 : Math.round(rawSpeed * 10) / 10;

  const rawHeading = body.heading !== undefined ? (typeof body.heading === 'number' ? body.heading : parseFloat(body.heading)) : 0;
  const heading = isNaN(rawHeading) ? 0 : (rawHeading % 360 + 360) % 360;

  const rawBattery = body.battery !== undefined ? body.battery : (body.battery_level !== undefined ? body.battery_level : 100);
  const batteryLevel = Math.max(0, Math.min(100, Math.round(typeof rawBattery === 'number' ? rawBattery : (parseFloat(rawBattery) || 100))));

  const ignitionStatus = body.ignition !== undefined 
    ? (body.ignition === 1 || body.ignition === true || body.ignition === '1' ? 1 : 0)
    : (speed > 2 ? 1 : 0);

  let timestampIso = new Date().toISOString();
  if (body.timestamp) {
    const parsed = new Date(body.timestamp);
    if (!isNaN(parsed.getTime())) {
      timestampIso = parsed.toISOString();
    }
  }

  return {
    deviceId: String(deviceId).trim(),
    latitude,
    longitude,
    speed,
    heading,
    altitude: body.altitude ? Math.round(Number(body.altitude)) : 0,
    batteryLevel,
    ignitionStatus,
    accuracy: body.accuracy ? Math.round(Number(body.accuracy)) : 0,
    timestamp: timestampIso
  };
}
