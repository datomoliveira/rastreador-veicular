import { NormalizedTelemetry } from '../types';

/**
 * Normalizador para rastreadores veiculares físicos 4G (Fase 2)
 * Compatível com Webhooks HTTP de dispositivos como Teltonika, Micodus e Sinotrack 4G
 * Aceita tanto query params (GET/POST form) quanto JSON.
 */
export function normalizeHardwarePayload(raw: any): NormalizedTelemetry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // Identificador: geralmente o IMEI de 15 dígitos ou ID configurado
  const deviceId = raw.imei || raw.device_id || raw.id || raw.tracker_id || raw.serial;
  
  // Coordenadas
  const lat = raw.lat !== undefined ? raw.lat : (raw.latitude !== undefined ? raw.latitude : raw.gps_lat);
  const lon = raw.lon !== undefined ? raw.lon : (raw.lng !== undefined ? raw.lng : (raw.longitude !== undefined ? raw.longitude : raw.gps_lon));

  if (!deviceId || lat === undefined || lon === undefined) {
    return null;
  }

  const latitude = typeof lat === 'number' ? lat : parseFloat(lat);
  const longitude = typeof lon === 'number' ? lon : parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  // Velocidade (Geralmente em km/h nos hardwares com HTTP, mas suporta conversão)
  let speed = 0;
  const rawSpeed = raw.speed !== undefined ? raw.speed : (raw.spd !== undefined ? raw.spd : 0);
  if (rawSpeed !== undefined) {
    const parsedSpeed = typeof rawSpeed === 'number' ? rawSpeed : parseFloat(rawSpeed);
    if (!isNaN(parsedSpeed)) {
      speed = Math.round(parsedSpeed * 10) / 10;
    }
  }

  // Direção / Ângulo (0 - 360)
  let heading = 0;
  const rawHeading = raw.heading !== undefined ? raw.heading : (raw.dir !== undefined ? raw.dir : (raw.bearing !== undefined ? raw.bearing : 0));
  if (rawHeading !== undefined) {
    const parsedHeading = typeof rawHeading === 'number' ? rawHeading : parseFloat(rawHeading);
    if (!isNaN(parsedHeading)) {
      heading = (parsedHeading % 360 + 360) % 360;
    }
  }

  // Status de Ignição do Veículo (ACC wire / Pós-chave)
  // 1 = Chave ligada / motor funcionando, 0 = Chave desligada
  let ignitionStatus = 0;
  const rawAcc = raw.acc !== undefined ? raw.acc : (raw.ignition !== undefined ? raw.ignition : (raw.engine !== undefined ? raw.engine : undefined));
  if (rawAcc !== undefined) {
    ignitionStatus = (rawAcc === 1 || rawAcc === '1' || rawAcc === true || rawAcc === 'true' || rawAcc === 'ON') ? 1 : 0;
  } else {
    // Se o hardware não tiver fio ACC conectado, infere pela velocidade
    ignitionStatus = speed > 3 ? 1 : 0;
  }

  // Bateria: pode ser a tensão em Volts (ex: 12.6V) ou percentual
  let batteryLevel = 100;
  const rawBat = raw.battery !== undefined ? raw.battery : (raw.bat !== undefined ? raw.bat : (raw.vbat !== undefined ? raw.vbat : undefined));
  if (rawBat !== undefined) {
    const parsedBat = typeof rawBat === 'number' ? rawBat : parseFloat(rawBat);
    if (!isNaN(parsedBat)) {
      if (parsedBat > 10) {
        // Se for percentual direto (ex: 85%)
        batteryLevel = Math.min(100, Math.max(0, Math.round(parsedBat)));
      } else {
        // Se for tensão de bateria de backup de 3.7V (ex: 4.1V = 100%, 3.5V = 0%)
        const pct = Math.round(((parsedBat - 3.5) / (4.2 - 3.5)) * 100);
        batteryLevel = Math.min(100, Math.max(0, pct));
      }
    }
  }

  let timestampIso = new Date().toISOString();
  if (raw.timestamp || raw.time || raw.datetime) {
    const timeVal = raw.timestamp || raw.time || raw.datetime;
    const parsedDate = new Date(isNaN(timeVal) ? timeVal : (Number(timeVal) < 10000000000 ? Number(timeVal) * 1000 : Number(timeVal)));
    if (!isNaN(parsedDate.getTime())) {
      timestampIso = parsedDate.toISOString();
    }
  }

  return {
    deviceId: String(deviceId).trim(),
    latitude,
    longitude,
    speed,
    heading,
    altitude: raw.altitude ? Math.round(Number(raw.altitude)) : 0,
    batteryLevel,
    ignitionStatus,
    accuracy: raw.accuracy ? Math.round(Number(raw.accuracy)) : 5,
    timestamp: timestampIso
  };
}
