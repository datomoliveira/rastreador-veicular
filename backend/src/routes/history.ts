import { Hono } from 'hono';
import { Env } from '../types';
import { getDeviceHistory } from '../services/db';
import { calculateDistanceMeters } from '../services/geofence';

const app = new Hono<{ Bindings: Env }>();

/**
 * Consulta trilha histórica e calcula métricas da viagem
 * GET /api/v1/history/:id?start=2026-09-19T00:00:00Z&end=2026-09-19T23:59:59Z&limit=2500
 */
app.get('/:id', async (c) => {
  const deviceId = c.req.param('id');
  const query = c.req.query();
  
  const start = query.start;
  const end = query.end;
  const limit = Math.min(parseInt(query.limit || '3000', 10), 5000);

  const points = await getDeviceHistory(c.env.DB, deviceId, start, end, limit);

  if (points.length === 0) {
    return c.json({
      deviceId,
      totalPoints: 0,
      totalDistanceKm: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      points: []
    });
  }

  // Cálculo de estatísticas da rota
  let totalDistanceMeters = 0;
  let maxSpeed = 0;
  let sumSpeed = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.speed > maxSpeed) {
      maxSpeed = pt.speed;
    }
    sumSpeed += pt.speed;

    if (i > 0) {
      const prev = points[i - 1];
      const dist = calculateDistanceMeters(
        prev.latitude,
        prev.longitude,
        pt.latitude,
        pt.longitude
      );
      // Filtra saltos anômalos de GPS (> 500m em 1 intervalo curto)
      if (dist < 1000) {
        totalDistanceMeters += dist;
      }
    }
  }

  const avgSpeed = points.length > 0 ? Math.round((sumSpeed / points.length) * 10) / 10 : 0;
  const totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 10) / 10;

  return c.json({
    deviceId,
    totalPoints: points.length,
    totalDistanceKm,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    avgSpeed,
    startTime: points[0].timestamp,
    endTime: points[points.length - 1].timestamp,
    points
  });
});

export default app;
