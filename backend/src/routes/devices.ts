import { Hono } from 'hono';
import { Env } from '../types';
import { 
  listDevices, 
  getDevice, 
  upsertDevice, 
  getLatestPosition, 
  listLatestPositions 
} from '../services/db';

const app = new Hono<{ Bindings: Env }>();

/**
 * Lista todos os dispositivos e seus últimos estados
 */
app.get('/', async (c) => {
  const latestList = await listLatestPositions(c.env.DB);
  const devices = await listDevices(c.env.DB);

  // Mapeia dispositivos combinando com a última posição
  const positionsMap = new Map(latestList.map(p => [p.device_id, p]));

  const response = devices.map(d => {
    const latest = positionsMap.get(d.id) || null;
    return {
      ...d,
      latest
    };
  });

  return c.json({ devices: response });
});

/**
 * Retorna dados detalhados de um dispositivo
 */
app.get('/:id', async (c) => {
  const id = c.req.param('id');
  const device = await getDevice(c.env.DB, id);
  if (!device) {
    return c.json({ error: 'Dispositivo não encontrado' }, 404);
  }

  const latest = await getLatestPosition(c.env.DB, id);
  return c.json({ ...device, latest });
});

/**
 * Retorna apenas o último ponto para polling rápido do Dashboard
 */
app.get('/:id/latest', async (c) => {
  const id = c.req.param('id');
  const latest = await getLatestPosition(c.env.DB, id);
  if (!latest) {
    return c.json({ error: 'Nenhuma posição registrada ainda' }, 404);
  }
  return c.json(latest);
});

/**
 * Cria ou atualiza um dispositivo
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.id || !body.name) {
      return c.json({ error: 'Campos "id" e "name" são obrigatórios' }, 400);
    }

    await upsertDevice(c.env.DB, {
      id: String(body.id).trim(),
      name: String(body.name).trim(),
      device_type: body.device_type || 'MOBILE_APP',
      protocol: body.protocol || 'TRACCAR',
      api_key: body.api_key || 'token-default',
      max_speed_limit: parseFloat(body.max_speed_limit || '80'),
      battery_alert_threshold: parseInt(body.battery_alert_threshold || '20', 10)
    });

    const updated = await getDevice(c.env.DB, body.id);
    return c.json({ success: true, device: updated });
  } catch (err: any) {
    return c.json({ error: 'Erro ao salvar dispositivo', details: err.message }, 400);
  }
});

export default app;
