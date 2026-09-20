import { 
  DeviceRecord, 
  LatestPositionRecord, 
  NormalizedTelemetry, 
  GeofenceRecord, 
  AlertLogRecord 
} from '../types';

/**
 * Camada de Acesso a Dados do Cloudflare D1 (SQLite Serverless)
 */

export async function getDevice(db: D1Database, deviceId: string): Promise<DeviceRecord | null> {
  const result = await db
    .prepare('SELECT * FROM devices WHERE id = ?')
    .bind(deviceId)
    .first<DeviceRecord>();
  return result;
}

export async function listDevices(db: D1Database): Promise<DeviceRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM devices ORDER BY name ASC')
    .all<DeviceRecord>();
  return results || [];
}

export async function upsertDevice(db: D1Database, device: Partial<DeviceRecord> & { id: string; name: string }): Promise<void> {
  await db
    .prepare(`
      INSERT INTO devices (id, name, device_type, protocol, api_key, max_speed_limit, battery_alert_threshold, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        device_type = COALESCE(excluded.device_type, devices.device_type),
        protocol = COALESCE(excluded.protocol, devices.protocol),
        api_key = COALESCE(excluded.api_key, devices.api_key),
        max_speed_limit = COALESCE(excluded.max_speed_limit, devices.max_speed_limit),
        battery_alert_threshold = COALESCE(excluded.battery_alert_threshold, devices.battery_alert_threshold),
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      device.id,
      device.name,
      device.device_type || 'MOBILE_APP',
      device.protocol || 'TRACCAR',
      device.api_key || 'token-default',
      device.max_speed_limit || 80.0,
      device.battery_alert_threshold || 20
    )
    .run();
}

export async function getLatestPosition(db: D1Database, deviceId: string): Promise<LatestPositionRecord | null> {
  return await db
    .prepare('SELECT * FROM latest_positions WHERE device_id = ?')
    .bind(deviceId)
    .first<LatestPositionRecord>();
}

export async function listLatestPositions(db: D1Database): Promise<LatestPositionRecord[]> {
  const { results } = await db
    .prepare(`
      SELECT lp.*, d.name as device_name, d.device_type, d.max_speed_limit
      FROM latest_positions lp
      LEFT JOIN devices d ON lp.device_id = d.id
      ORDER BY lp.updated_at DESC
    `)
    .all<LatestPositionRecord>();
  return results || [];
}

/**
 * Atualiza o último ponto do veículo utilizando UPSERT no D1
 * (Substitui o KV, oferecendo 100.000 writes/dia gratuitos)
 */
export async function upsertLatestPosition(
  db: D1Database, 
  telemetry: NormalizedTelemetry, 
  isMoving: boolean
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO latest_positions (
        device_id, latitude, longitude, speed, heading, altitude, 
        battery_level, ignition_status, accuracy, is_moving, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        speed = excluded.speed,
        heading = excluded.heading,
        altitude = excluded.altitude,
        battery_level = excluded.battery_level,
        ignition_status = excluded.ignition_status,
        accuracy = excluded.accuracy,
        is_moving = excluded.is_moving,
        updated_at = excluded.updated_at
    `)
    .bind(
      telemetry.deviceId,
      telemetry.latitude,
      telemetry.longitude,
      telemetry.speed,
      telemetry.heading,
      telemetry.altitude || 0,
      telemetry.batteryLevel || 100,
      telemetry.ignitionStatus || 0,
      telemetry.accuracy || 0,
      isMoving ? 1 : 0,
      telemetry.timestamp
    )
    .run();
}

/**
 * Persiste um novo ponto na trilha histórica de posições
 */
export async function insertPositionHistory(
  db: D1Database, 
  telemetry: NormalizedTelemetry
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO positions (
        device_id, latitude, longitude, speed, heading, altitude, 
        battery_level, ignition_status, accuracy, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      telemetry.deviceId,
      telemetry.latitude,
      telemetry.longitude,
      telemetry.speed,
      telemetry.heading,
      telemetry.altitude || 0,
      telemetry.batteryLevel || 100,
      telemetry.ignitionStatus || 0,
      telemetry.accuracy || 0,
      telemetry.timestamp
    )
    .run();
}

/**
 * Consulta a trilha histórica de um veículo para exibição no mapa
 */
export async function getDeviceHistory(
  db: D1Database, 
  deviceId: string, 
  startDate?: string, 
  endDate?: string, 
  limit: number = 2000
): Promise<any[]> {
  let query = 'SELECT * FROM positions WHERE device_id = ?';
  const params: any[] = [deviceId];

  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY timestamp ASC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(query).bind(...params).all();
  return results || [];
}

export async function listGeofences(db: D1Database, deviceId?: string): Promise<GeofenceRecord[]> {
  let query = 'SELECT * FROM geofences WHERE is_active = 1';
  const params: any[] = [];

  if (deviceId) {
    query += ' AND (device_id IS NULL OR device_id = ?)';
    params.push(deviceId);
  }

  const { results } = await db.prepare(query).bind(...params).all<GeofenceRecord>();
  return results || [];
}

export async function createGeofence(db: D1Database, data: Partial<GeofenceRecord>): Promise<number> {
  const result = await db
    .prepare(`
      INSERT INTO geofences (name, device_id, center_latitude, center_longitude, radius_meters, alert_on_exit, alert_on_enter, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `)
    .bind(
      data.name || 'Nova Cerca',
      data.device_id || null,
      data.center_latitude,
      data.center_longitude,
      data.radius_meters || 200,
      data.alert_on_exit !== undefined ? data.alert_on_exit : 1,
      data.alert_on_enter !== undefined ? data.alert_on_enter : 0
    )
    .run();
  return result.meta.last_row_id || 0;
}

export async function deleteGeofence(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM geofences WHERE id = ?').bind(id).run();
}

export async function recordAlertLog(db: D1Database, alert: AlertLogRecord): Promise<void> {
  await db
    .prepare(`
      INSERT INTO alert_logs (device_id, alert_type, title, message, latitude, longitude, speed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      alert.device_id,
      alert.alert_type,
      alert.title,
      alert.message,
      alert.latitude || null,
      alert.longitude || null,
      alert.speed || null
    )
    .run();
}

export async function listRecentAlerts(db: D1Database, deviceId?: string, limit: number = 50): Promise<AlertLogRecord[]> {
  let query = 'SELECT * FROM alert_logs';
  const params: any[] = [];

  if (deviceId) {
    query += ' WHERE device_id = ?';
    params.push(deviceId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(query).bind(...params).all<AlertLogRecord>();
  return results || [];
}

export async function cleanupOldHistory(db: D1Database, daysToKeep: number = 45): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM positions WHERE timestamp < datetime('now', '-' || ? || ' days')`)
    .bind(daysToKeep)
    .run();
  return result.meta.changes || 0;
}
