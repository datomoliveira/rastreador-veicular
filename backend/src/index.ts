import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types';
import telemetryRoute from './routes/telemetry';
import devicesRoute from './routes/devices';
import historyRoute from './routes/history';
import geofencesRoute from './routes/geofences';
import alertsRoute from './routes/alerts';
import { cleanupOldHistory } from './services/db';

const app = new Hono<{ Bindings: Env }>();

// Middlewares
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Api-Key'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// Rota de Boas-Vindas e Healthcheck
app.get('/', (c) => {
  return c.json({
    app: 'Rastreador Veicular Serverless (Cloudflare)',
    status: 'online',
    version: '1.0.0',
    freeTierStatus: '100% Free / Serverless',
    endpoints: {
      telemetry: '/api/v1/telemetry',
      traccar: '/api/v1/telemetry/traccar',
      devices: '/api/v1/devices',
      history: '/api/v1/history/:deviceId',
      geofences: '/api/v1/geofences',
      alerts: '/api/v1/alerts'
    }
  });
});

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Agrupamento de Rotas da API
app.route('/api/v1/telemetry', telemetryRoute);
app.route('/api/v1/devices', devicesRoute);
app.route('/api/v1/history', historyRoute);
app.route('/api/v1/geofences', geofencesRoute);
app.route('/api/v1/alerts', alertsRoute);

// Tratamento de Erros Global
app.onError((err, c) => {
  console.error('Erro na requisição:', err);
  return c.json({
    error: 'Erro interno no servidor',
    message: err.message
  }, 500);
});

// Manipulador de Tarefas Agendadas (Cron Trigger da Cloudflare)
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        console.log('[Cron] Iniciando limpeza automática de histórico antigo (> 45 dias)...');
        try {
          const deletedRows = await cleanupOldHistory(env.DB, 45);
          console.log(`[Cron] Limpeza concluída: ${deletedRows} posições antigas removidas com sucesso.`);
        } catch (err) {
          console.error('[Cron] Falha ao executar limpeza programada:', err);
        }
      })()
    );
  }
};
