import { Hono } from 'hono';
import { Env } from '../types';
import { listRecentAlerts } from '../services/db';

const app = new Hono<{ Bindings: Env }>();

/**
 * Consulta histórico de alertas disparados
 */
app.get('/', async (c) => {
  const deviceId = c.req.query('device_id');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const alerts = await listRecentAlerts(c.env.DB, deviceId, limit);
  return c.json({ alerts });
});

export default app;
