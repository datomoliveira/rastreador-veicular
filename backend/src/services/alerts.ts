import { Env, NormalizedTelemetry, DeviceRecord, LatestPositionRecord, AlertLogRecord } from '../types';
import { calculateDistanceMeters, isPointInsideGeofence } from './geofence';
import { listGeofences, recordAlertLog } from './db';

/**
 * Envia notificação para o ntfy.sh (serviço gratuito de Web Push para celular)
 */
export async function sendNtfyAlert(
  topic: string,
  title: string,
  message: string,
  mapUrl?: string,
  priority: string = 'high'
): Promise<void> {
  if (!topic) return;

  try {
    const headers: Record<string, string> = {
      'Title': title,
      'Priority': priority,
      'Tags': 'warning,car'
    };

    if (mapUrl) {
      headers['Click'] = mapUrl;
      headers['Actions'] = `view, Abrir no Mapa, ${mapUrl}`;
    }

    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers,
      body: message
    });
  } catch (err) {
    console.error('Erro ao enviar alerta ntfy.sh:', err);
  }
}

/**
 * Envia notificação para o Telegram Bot (Gratuito, sem limites)
 */
export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  if (!botToken || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      })
    });
  } catch (err) {
    console.error('Erro ao enviar alerta Telegram:', err);
  }
}

/**
 * Motor de Avaliação de Regras e Disparo de Alertas
 */
export async function evaluateTelemetryAlerts(
  env: Env,
  device: DeviceRecord,
  current: NormalizedTelemetry,
  previous: LatestPositionRecord | null
): Promise<void> {
  if (env.ENABLE_ALERTS === 'false') return;

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${current.latitude},${current.longitude}`;
  const deviceName = device.name || current.deviceId;

  // 1. Alerta de Excesso de Velocidade
  // ATENÇÃO: Esta verificação é ESTRITAMENTE INFORMATIVA (log e notificação push ao usuário).
  // Em hipótese alguma ela deve acionar bloqueio veicular, corte de motor ou comandos físicos.
  const speedLimit = device.max_speed_limit || parseFloat(env.DEFAULT_SPEED_LIMIT_KMH || '80');
  if (current.speed > speedLimit) {
    // Evita spam contínuo se o veículo já estava em excesso no último envio
    const wasAlreadySpeeding = previous && previous.speed > speedLimit;
    if (!wasAlreadySpeeding) {
      const title = `🚨 EXCESSO DE VELOCIDADE: ${deviceName}`;
      const text = `O veículo atingiu <b>${current.speed} km/h</b> (Limite: ${speedLimit} km/h).\n📍 <a href="${mapUrl}">Ver localização no mapa</a>`;

      await recordAlertLog(env.DB, {
        device_id: device.id,
        alert_type: 'SPEEDING',
        title: 'Excesso de Velocidade',
        message: `Velocidade registrada: ${current.speed} km/h (Limite: ${speedLimit} km/h)`,
        latitude: current.latitude,
        longitude: current.longitude,
        speed: current.speed
      });

      await Promise.allSettled([
        env.NTFY_TOPIC ? sendNtfyAlert(env.NTFY_TOPIC, title, `Velocidade: ${current.speed} km/h (Limite: ${speedLimit} km/h)`, mapUrl, 'urgent') : Promise.resolve(),
        env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `${title}\n${text}`) : Promise.resolve()
      ]);
    }
  }

  // 2. Alerta de Cercas Virtuais (Geofence Exit / Enter)
  const geofences = await listGeofences(env.DB, device.id);
  for (const fence of geofences) {
    const isNowInside = isPointInsideGeofence(
      current.latitude,
      current.longitude,
      fence.center_latitude,
      fence.center_longitude,
      fence.radius_meters
    );

    let wasPreviouslyInside = true;
    if (previous) {
      wasPreviouslyInside = isPointInsideGeofence(
        previous.latitude,
        previous.longitude,
        fence.center_latitude,
        fence.center_longitude,
        fence.radius_meters
      );
    }

    // Saída da Cerca
    if (fence.alert_on_exit === 1 && wasPreviouslyInside && !isNowInside) {
      const title = `⚠️ SAÍDA DE CERCA: ${fence.name}`;
      const text = `O veículo <b>${deviceName}</b> saiu da área segura [<b>${fence.name}</b>].\nVelocidade: ${current.speed} km/h.\n📍 <a href="${mapUrl}">Ver no mapa</a>`;

      await recordAlertLog(env.DB, {
        device_id: device.id,
        alert_type: 'GEOFENCE_EXIT',
        title: `Saída de Cerca: ${fence.name}`,
        message: `Veículo saiu da cerca ${fence.name}.`,
        latitude: current.latitude,
        longitude: current.longitude,
        speed: current.speed
      });

      await Promise.allSettled([
        env.NTFY_TOPIC ? sendNtfyAlert(env.NTFY_TOPIC, title, `Veículo saiu da área segura [${fence.name}]`, mapUrl, 'high') : Promise.resolve(),
        env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `${title}\n${text}`) : Promise.resolve()
      ]);
    }

    // Entrada na Cerca
    if (fence.alert_on_enter === 1 && !wasPreviouslyInside && isNowInside) {
      const title = `✅ CHEGADA / ENTRADA: ${fence.name}`;
      const text = `O veículo <b>${deviceName}</b> entrou na área segura [<b>${fence.name}</b>].\n📍 <a href="${mapUrl}">Ver no mapa</a>`;

      await recordAlertLog(env.DB, {
        device_id: device.id,
        alert_type: 'GEOFENCE_ENTER',
        title: `Entrada na Cerca: ${fence.name}`,
        message: `Veículo entrou na cerca ${fence.name}.`,
        latitude: current.latitude,
        longitude: current.longitude,
        speed: current.speed
      });

      await Promise.allSettled([
        env.NTFY_TOPIC ? sendNtfyAlert(env.NTFY_TOPIC, title, `Veículo chegou em [${fence.name}]`, mapUrl, 'default') : Promise.resolve(),
        env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `${title}\n${text}`) : Promise.resolve()
      ]);
    }
  }

  // 3. Alerta de Bateria Fraca
  if (current.batteryLevel !== undefined && current.batteryLevel <= (device.battery_alert_threshold || 20)) {
    const wasAlreadyLow = previous && previous.battery_level <= (device.battery_alert_threshold || 20);
    if (!wasAlreadyLow) {
      const title = `🔋 BATERIA FRACA: ${deviceName}`;
      const text = `O nível de bateria está em <b>${current.batteryLevel}%</b>. Conecte o carregador ou verifique a alimentação 12V.`;

      await recordAlertLog(env.DB, {
        device_id: device.id,
        alert_type: 'LOW_BATTERY',
        title: 'Bateria Fraca',
        message: `Nível atual: ${current.batteryLevel}%`,
        latitude: current.latitude,
        longitude: current.longitude
      });

      await Promise.allSettled([
        env.NTFY_TOPIC ? sendNtfyAlert(env.NTFY_TOPIC, title, `Nível de bateria: ${current.batteryLevel}%`, mapUrl, 'default') : Promise.resolve(),
        env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, `${title}\n${text}`) : Promise.resolve()
      ]);
    }
  }
}
