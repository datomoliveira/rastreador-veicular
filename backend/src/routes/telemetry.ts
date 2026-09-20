import { Hono } from 'hono';
import { Env, NormalizedTelemetry } from '../types';
import { normalizeTraccarPayload } from '../normalizers/traccar';
import { normalizeStandardJsonPayload } from '../normalizers/standard';
import { normalizeHardwarePayload } from '../normalizers/hardware';
import { 
  getDevice, 
  upsertDevice, 
  getLatestPosition, 
  upsertLatestPosition, 
  insertPositionHistory 
} from '../services/db';
import { calculateDistanceMeters } from '../services/geofence';
import { evaluateTelemetryAlerts } from '../services/alerts';

const app = new Hono<{ Bindings: Env }>();

/**
 * Pipeline Central de Processamento de Telemetria
 */
async function processTelemetry(
  c: any, 
  telemetry: NormalizedTelemetry | null, 
  protocolName: string
) {
  if (!telemetry) {
    return c.json({ error: 'Payload de telemetria inválido ou incompleto' }, 400);
  }

  const db = c.env.DB;

  // 1. Busca dispositivo ou auto-cadastra no primeiro ping para facilidade de uso
  let device = await getDevice(db, telemetry.deviceId);
  if (!device) {
    await upsertDevice(db, {
      id: telemetry.deviceId,
      name: `Dispositivo ${telemetry.deviceId}`,
      device_type: protocolName === 'TRACCAR' ? 'MOBILE_APP' : 'GPS_HARDWARE',
      protocol: protocolName,
      api_key: 'auto-registered-key',
      max_speed_limit: parseFloat(c.env.DEFAULT_SPEED_LIMIT_KMH || '80'),
      battery_alert_threshold: 20
    });
    device = await getDevice(db, telemetry.deviceId);
  }

  // 2. Busca último estado para filtragem de veículo parado (Economia de D1)
  const previous = await getLatestPosition(db, telemetry.deviceId);

  let isMoving = telemetry.speed > 2.0;
  let shouldSaveHistory = true;

  if (previous) {
    const distMeters = calculateDistanceMeters(
      previous.latitude,
      previous.longitude,
      telemetry.latitude,
      telemetry.longitude
    );

    // Se a velocidade for menor que 2.5 km/h e moveu menos de 15 metros, o veículo está parado
    if (telemetry.speed < 2.5 && distMeters < 15) {
      isMoving = false;
      
      // Heartbeat: salva no histórico apenas a cada 5 minutos quando parado
      const lastUpdate = new Date(previous.updated_at).getTime();
      const now = new Date(telemetry.timestamp).getTime();
      const minutesSinceLast = (now - lastUpdate) / (1000 * 60);

      if (minutesSinceLast < 5) {
        shouldSaveHistory = false;
      }
    }
  }

  // 3. Atualiza estado em tempo real no D1 (UPSERT em latest_positions)
  await upsertLatestPosition(db, telemetry, isMoving);

  // 4. Se em movimento ou heartbeat, grava na trilha histórica
  if (shouldSaveHistory) {
    await insertPositionHistory(db, telemetry);
  }

  // 5. Avalia regras de alerta (excesso de velocidade, cercas, bateria) em background
  if (device) {
    c.executionCtx.waitUntil(
      evaluateTelemetryAlerts(c.env, device, telemetry, previous)
    );
  }

  return c.json({
    success: true,
    deviceId: telemetry.deviceId,
    savedToHistory: shouldSaveHistory,
    isMoving,
    timestamp: telemetry.timestamp
  });
}

/**
 * Rota para o aplicativo Traccar Client (OsmAnd)
 * Suporta GET e POST (com query params ou form-data)
 */
app.all('/traccar', async (c) => {
  let params: Record<string, string | undefined> = {};

  if (c.req.method === 'GET') {
    params = c.req.query();
  } else {
    // POST: pode vir como form-urlencoded, JSON ou query string
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        params = await c.req.json();
      } catch {
        params = c.req.query();
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const body = await c.req.parseBody();
        for (const [k, v] of Object.entries(body)) {
          params[k] = String(v);
        }
      } catch {
        params = c.req.query();
      }
    } else {
      params = c.req.query();
    }
  }

  const telemetry = normalizeTraccarPayload(params);
  // O Traccar Client espera resposta em texto simples ou status 200
  await processTelemetry(c, telemetry, 'TRACCAR');
  return c.text('OK');
});

/**
 * Rota para Telemetria em formato JSON padrão
 */
app.post('/json', async (c) => {
  try {
    const body = await c.req.json();
    const telemetry = normalizeStandardJsonPayload(body);
    return await processTelemetry(c, telemetry, 'STANDARD_JSON');
  } catch (err: any) {
    return c.json({ error: 'Erro ao processar JSON', details: err.message }, 400);
  }
});

/**
 * Rota para Telemetria de Hardware 4G (Teltonika, Micodus, etc.)
 */
app.all('/hardware', async (c) => {
  let data: any = {};
  if (c.req.method === 'GET') {
    data = c.req.query();
  } else {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      try { data = await c.req.json(); } catch { data = c.req.query(); }
    } else {
      try {
        data = await c.req.parseBody();
      } catch {
        data = c.req.query();
      }
    }
  }

  const telemetry = normalizeHardwarePayload(data);
  return await processTelemetry(c, telemetry, 'HARDWARE_HTTP');
});

/**
 * Rota Canônica Unificada (/api/v1/telemetry)
 * Detecta o formato e processa adequadamente
 */
app.all('/', async (c) => {
  if (c.req.method === 'GET') {
    const query = c.req.query();
    if (query.id || query.lat || query.lon) {
      const telemetry = normalizeTraccarPayload(query);
      return await processTelemetry(c, telemetry, 'TRACCAR');
    }
    return c.json({ status: 'online', message: 'Endpoint de telemetria ativo' });
  }

  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    // Verifica se possui campos do Traccar ou formato padrão
    const telemetry = body.id && !body.device_id && body.lon
      ? normalizeTraccarPayload(body)
      : normalizeStandardJsonPayload(body);
    return await processTelemetry(c, telemetry, 'STANDARD_JSON');
  }

  // Fallback para form-data ou query params
  const body = await c.req.parseBody().catch(() => ({}));
  const merged = { ...c.req.query(), ...body };
  const telemetry = normalizeTraccarPayload(merged as any);
  return await processTelemetry(c, telemetry, 'TRACCAR');
});

export default app;
