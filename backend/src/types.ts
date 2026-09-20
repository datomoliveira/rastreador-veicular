// Definições de Tipos para o Sistema de Rastreamento Serverless

export interface Env {
  DB: D1Database;
  ENABLE_ALERTS?: string;
  NTFY_TOPIC?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DEFAULT_SPEED_LIMIT_KMH?: string;
}

// Estrutura Canônica Unificada de Telemetria (Normalizada)
export interface NormalizedTelemetry {
  deviceId: string;
  latitude: number;
  longitude: number;
  speed: number;             // Em km/h
  heading: number;           // 0 - 360 graus
  altitude?: number;         // Em metros
  batteryLevel?: number;     // 0 - 100%
  ignitionStatus?: number;   // 0 = Desligado, 1 = Ligado
  accuracy?: number;         // Em metros
  timestamp: string;         // ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ) ou formato aceito pelo SQLite
}

export interface DeviceRecord {
  id: string;
  name: string;
  device_type: 'MOBILE_APP' | 'GPS_HARDWARE';
  protocol: string;
  api_key: string;
  max_speed_limit: number;
  battery_alert_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface LatestPositionRecord {
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude: number;
  battery_level: number;
  ignition_status: number;
  accuracy: number;
  is_moving: number;
  address?: string;
  updated_at: string;
}

export interface GeofenceRecord {
  id: number;
  name: string;
  device_id?: string | null;
  center_latitude: number;
  center_longitude: number;
  radius_meters: number;
  alert_on_exit: number;
  alert_on_enter: number;
  is_active: number;
  created_at?: string;
}

export interface AlertLogRecord {
  id?: number;
  device_id: string;
  alert_type: 'SPEEDING' | 'GEOFENCE_EXIT' | 'GEOFENCE_ENTER' | 'LOW_BATTERY' | 'SOS';
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  created_at?: string;
}
