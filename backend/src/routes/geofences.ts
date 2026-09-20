import { Hono } from 'hono';
import { Env } from '../types';
import { listGeofences, createGeofence, deleteGeofence } from '../services/db';

const app = new Hono<{ Bindings: Env }>();

/**
 * Lista todas as cercas eletrônicas
 */
app.get('/', async (c) => {
  const deviceId = c.req.query('device_id');
  const fences = await listGeofences(c.env.DB, deviceId);
  return c.json({ geofences: fences });
});

/**
 * Cria uma nova cerca eletrônica
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || body.center_latitude === undefined || body.center_longitude === undefined || !body.radius_meters) {
      return c.json({ error: 'Campos "name", "center_latitude", "center_longitude" e "radius_meters" são obrigatórios' }, 400);
    }

    const id = await createGeofence(c.env.DB, {
      name: String(body.name).trim(),
      device_id: body.device_id || null,
      center_latitude: parseFloat(body.center_latitude),
      center_longitude: parseFloat(body.center_longitude),
      radius_meters: parseFloat(body.radius_meters),
      alert_on_exit: body.alert_on_exit !== undefined ? (body.alert_on_exit ? 1 : 0) : 1,
      alert_on_enter: body.alert_on_enter !== undefined ? (body.alert_on_enter ? 1 : 0) : 0
    });

    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ error: 'Erro ao criar cerca', details: err.message }, 400);
  }
});

/**
 * Remove uma cerca eletrônica
 */
app.delete('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json({ error: 'ID inválido' }, 400);
  }

  await deleteGeofence(c.env.DB, id);
  return c.json({ success: true, message: 'Cerca removida com sucesso' });
});

export default app;
