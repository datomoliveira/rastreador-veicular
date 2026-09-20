import { NormalizedTelemetry } from '../types';

/**
 * Normalizador para o protocolo Traccar Client (OsmAnd / Traccar Standard)
 * O app Traccar Client envia requisições HTTP GET ou POST com os seguintes parâmetros:
 * ?id=veiculo-01&lat=-23.5505&lon=-46.6333&timestamp=1726778400&speed=15.5&bearing=180&altitude=750&batt=95&accuracy=12
 * 
 * ATENÇÃO: O protocolo Traccar envia a velocidade em NÓS (knots).
 * Fator de conversão: 1 knot = 1.852 km/h.
 */
export function normalizeTraccarPayload(
  params: Record<string, string | undefined>
): NormalizedTelemetry | null {
  const deviceId = params.id || params.device_id || params.uniqueId;
  const latStr = params.lat || params.latitude;
  const lonStr = params.lon || params.lng || params.longitude;

  if (!deviceId || !latStr || !lonStr) {
    return null;
  }

  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);

  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  // Conversão de velocidade: nós para km/h
  let speedKmh = 0;
  if (params.speed) {
    const rawSpeed = parseFloat(params.speed);
    if (!isNaN(rawSpeed)) {
      // Se for o protocolo Traccar padrão (OsmAnd), a velocidade vem em nós.
      // 1 nó = 1.852 km/h
      speedKmh = Math.round(rawSpeed * 1.852 * 10) / 10;
    }
  }

  // Direção / Heading (0 - 360)
  let heading = 0;
  if (params.bearing || params.heading) {
    const rawHeading = parseFloat(params.bearing || params.heading || '0');
    if (!isNaN(rawHeading)) {
      heading = (rawHeading % 360 + 360) % 360;
    }
  }

  // Altitude
  let altitude = 0;
  if (params.altitude) {
    const rawAlt = parseFloat(params.altitude);
    if (!isNaN(rawAlt)) altitude = Math.round(rawAlt);
  }

  // Bateria (0 - 100%)
  let batteryLevel = 100;
  if (params.batt || params.battery) {
    const rawBatt = parseFloat(params.batt || params.battery || '100');
    if (!isNaN(rawBatt)) {
      batteryLevel = Math.max(0, Math.min(100, Math.round(rawBatt)));
    }
  }

  // Precisão (metros)
  let accuracy = 0;
  if (params.accuracy || params.acc) {
    const rawAcc = parseFloat(params.accuracy || params.acc || '0');
    if (!isNaN(rawAcc)) accuracy = Math.round(rawAcc);
  }

  // Timestamp
  let timestampIso = new Date().toISOString();
  if (params.timestamp) {
    const rawTime = parseInt(params.timestamp, 10);
    if (!isNaN(rawTime)) {
      // Se tiver 10 dígitos é segundos, se tiver 13 é milissegundos
      const date = rawTime < 10000000000 ? new Date(rawTime * 1000) : new Date(rawTime);
      if (!isNaN(date.getTime())) {
        timestampIso = date.toISOString();
      }
    }
  }

  // Ignição: no app Traccar, consideramos ligada se a velocidade for > 2 km/h ou se enviado explicitamente
  const ignitionParam = params.ignition || params.charge;
  const ignitionStatus = ignitionParam !== undefined 
    ? (ignitionParam === '1' || ignitionParam === 'true' ? 1 : 0)
    : (speedKmh > 2 ? 1 : 0);

  return {
    deviceId: String(deviceId).trim(),
    latitude,
    longitude,
    speed: speedKmh,
    heading,
    altitude,
    batteryLevel,
    ignitionStatus,
    accuracy,
    timestamp: timestampIso
  };
}
