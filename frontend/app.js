/**
 * TrackZero - Aplicação Frontend de Rastreamento Veicular
 * Cloudflare Pages + Leaflet.js
 */

// Estado Global da Aplicação
const state = {
  apiUrl: localStorage.getItem('trackzero_api_url') || 'https://rastreador-veicular-api.kistenmackermaia.workers.dev',
  pollIntervalMs: parseInt(localStorage.getItem('trackzero_poll_interval') || '5000', 10),
  demoMode: localStorage.getItem('trackzero_demo_mode') === 'true',
  activeDeviceId: 'veiculo-01',
  followVehicle: true,
  mapLayerType: 'dark', // 'dark' ou 'streets'
  
  // Instâncias do Leaflet
  map: null,
  vehicleMarker: null,
  accuracyCircle: null,
  historyPolyline: null,
  historyMarker: null,
  geofenceLayers: [],

  // Dados em Tempo Real
  latestTelemetry: null,
  pollTimer: null,
  lastAlertCount: 0,

  // Histórico e Player
  historyPoints: [],
  playerIndex: 0,
  playerTimer: null,
  isPlaying: false,

  // Simulador
  simTimer: null,
  simStep: 0
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initEventListeners();
  loadDevices();
  loadGeofences();
  startLivePolling();
});

// ==========================================
// MAPA (LEAFLET)
// ==========================================
function initMap() {
  // Ponto inicial padrão (São Paulo - Marco Zero / Praça da Sé)
  const defaultCoords = [-23.55052, -46.633308];

  state.map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(defaultCoords, 15);

  // Zoom control no canto inferior direito
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  setMapLayer('dark');

  // Marcador customizado do veículo com ícone e rotação
  const carIcon = L.divIcon({
    className: 'custom-car-marker',
    html: `
      <div class="car-marker-container">
        <div class="car-marker-halo"></div>
        <div class="car-marker-body" id="mapCarIconBody">
          <i class="fa-solid fa-car-side"></i>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });

  state.vehicleMarker = L.marker(defaultCoords, { icon: carIcon }).addTo(state.map);
  state.accuracyCircle = L.circle(defaultCoords, {
    radius: 30,
    color: '#06b6d4',
    fillColor: '#06b6d4',
    fillOpacity: 0.15,
    weight: 1
  }).addTo(state.map);

  // Clique no mapa para definir o centro da cerca virtual
  state.map.on('click', (e) => {
    const geofenceTab = document.getElementById('tab-geofences');
    if (geofenceTab.classList.contains('active')) {
      state.pendingFenceCoords = [e.latlng.lat, e.latlng.lng];
      updateTemporaryFenceMarker(e.latlng.lat, e.latlng.lng);
    }
  });
}

function setMapLayer(type) {
  if (state.currentTileLayer) {
    state.map.removeLayer(state.currentTileLayer);
  }

  let tileUrl = '';
  let attribution = '';

  if (type === 'dark') {
    tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    attribution = '&copy; OpenStreetMap &copy; CARTO';
  } else {
    tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    attribution = '&copy; OpenStreetMap contributors';
  }

  state.currentTileLayer = L.tileLayer(tileUrl, {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution
  }).addTo(state.map);
  state.mapLayerType = type;
}

// ==========================================
// POLLING E COMUNICAÇÃO COM API
// ==========================================
async function startLivePolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);

  // Primeira execução imediata
  await fetchLiveTelemetry();

  state.pollTimer = setInterval(async () => {
    await fetchLiveTelemetry();
  }, state.pollIntervalMs);
}

async function fetchLiveTelemetry() {
  updateConnectionStatus('connecting', 'Atualizando...');

  // Se estiver em modo demonstração local sem backend
  if (state.demoMode) {
    simulateOfflineTelemetry();
    return;
  }

  try {
    const url = `${state.apiUrl}/api/v1/devices/${state.activeDeviceId}/latest`;
    const res = await fetch(url);

    if (!res.ok) {
      if (res.status === 404) {
        updateConnectionStatus('idle', 'Sem telemetria gravada');
        return;
      }
      throw new Error(`Status ${res.status}`);
    }

    const data = await res.json();
    updateDashboardUI(data);
    updateConnectionStatus('online', 'Ao Vivo');
    fetchRecentAlerts();
  } catch (err) {
    // Se a API não responder e ainda não houver dados, oferece usar o simulador
    updateConnectionStatus('offline', 'API Desconectada');
  }
}

function updateConnectionStatus(status, text) {
  const pill = document.getElementById('connectionPill');
  const dot = pill.querySelector('.pulsing-dot');
  const txt = document.getElementById('connectionText');

  txt.textContent = text;

  if (status === 'online') {
    dot.className = 'pulsing-dot';
  } else if (status === 'offline') {
    dot.className = 'pulsing-dot offline';
  } else {
    dot.className = 'pulsing-dot';
  }
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE (TELEMETRIA)
// ==========================================
function updateDashboardUI(data) {
  state.latestTelemetry = data;

  const lat = data.latitude;
  const lng = data.longitude;
  const speed = Math.round(data.speed || 0);
  const heading = Math.round(data.heading || 0);
  const battery = data.battery_level !== undefined ? data.battery_level : 100;
  const ignition = data.ignition_status === 1;
  const isMoving = data.is_moving === 1 || speed > 2;

  // Atualiza Velocímetro
  document.getElementById('liveSpeed').textContent = speed;
  const speedPct = Math.min(100, Math.round((speed / 140) * 100));
  document.getElementById('speedBarFill').style.width = `${speedPct}%`;

  // Status de Movimento
  const motionTag = document.getElementById('motionStatus');
  if (isMoving) {
    motionTag.className = 'tag-status tag-moving';
    motionTag.textContent = 'Em Viagem';
  } else {
    motionTag.className = 'tag-status tag-parked';
    motionTag.textContent = 'Parado';
  }

  // Ignição
  const ignText = document.getElementById('liveIgnition');
  const ignWrap = document.getElementById('ignitionIconWrap');
  if (ignition) {
    ignText.textContent = 'Ligada';
    ignText.className = 'val text-emerald';
    ignWrap.style.background = 'rgba(16, 185, 129, 0.2)';
    ignWrap.style.color = 'var(--accent-emerald)';
  } else {
    ignText.textContent = 'Desligada';
    ignText.className = 'val text-muted';
    ignWrap.style.background = 'rgba(255, 255, 255, 0.05)';
    ignWrap.style.color = 'var(--text-muted)';
  }

  // Bateria
  const battVal = document.getElementById('liveBattery');
  const battIcon = document.getElementById('batteryIcon');
  battVal.textContent = `${battery}%`;
  if (battery > 50) {
    battIcon.className = 'fa-solid fa-battery-full text-emerald';
  } else if (battery > 20) {
    battIcon.className = 'fa-solid fa-battery-half text-amber';
  } else {
    battIcon.className = 'fa-solid fa-battery-quarter text-rose';
  }

  // Bússola / Direção
  const headingVal = document.getElementById('liveHeading');
  const compassIcon = document.getElementById('headingCompass');
  compassIcon.style.transform = `rotate(${heading}deg)`;
  headingVal.textContent = `${heading}° ${getCardinalDirection(heading)}`;

  // Coordenadas
  document.getElementById('liveCoords').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  document.getElementById('btnExternalMap').href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // Tempo relativo
  if (data.updated_at) {
    document.getElementById('liveLastSignal').textContent = formatRelativeTime(data.updated_at);
  }

  // Mobile Bar
  document.getElementById('mSpeedVal').textContent = speed;
  document.getElementById('mIgnitionVal').textContent = ignition ? 'Ignição On' : 'Ignição Off';
  document.getElementById('mUpdatedVal').textContent = formatRelativeTime(data.updated_at);

  // Atualiza Marcador no Mapa
  if (state.vehicleMarker && lat && lng) {
    const latLng = [lat, lng];
    state.vehicleMarker.setLatLng(latLng);
    state.accuracyCircle.setLatLng(latLng);
    if (data.accuracy) {
      state.accuracyCircle.setRadius(Math.max(15, data.accuracy));
    }

    // Rotaciona o ícone do carro no mapa
    const mapIconEl = document.getElementById('mapCarIconBody');
    if (mapIconEl) {
      mapIconEl.style.transform = `rotate(${heading - 90}deg)`;
    }

    // Seguir veículo automaticamente se ativado
    if (state.followVehicle) {
      state.map.panTo(latLng, { animate: true, duration: 0.8 });
    }
  }
}

function getCardinalDirection(angle) {
  const directions = ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'];
  const index = Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
  return directions[index];
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 5) return 'Agora mesmo';
  if (diffSec < 60) return `Há ${diffSec} seg atrás`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Há ${diffMin} min atrás`;
  const diffHours = Math.floor(diffMin / 60);
  return `Há ${diffHours} h atrás`;
}

// ==========================================
// DISPOSITIVOS E CERCAS VIRTUAIS
// ==========================================
async function loadDevices() {
  try {
    const res = await fetch(`${state.apiUrl}/api/v1/devices`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.devices && data.devices.length > 0) {
      const select = document.getElementById('deviceSelect');
      select.innerHTML = '';
      data.devices.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.name} (${d.id})`;
        select.appendChild(opt);
      });
      state.activeDeviceId = select.value;
    }
  } catch {
    // Modo offline / inicial
  }
}

async function loadGeofences() {
  try {
    const res = await fetch(`${state.apiUrl}/api/v1/geofences`);
    if (!res.ok) return;
    const data = await res.json();
    renderGeofences(data.geofences || []);
  } catch {
    // Offline
  }
}

function renderGeofences(fences) {
  // Limpa camadas anteriores do mapa
  state.geofenceLayers.forEach(l => state.map.removeLayer(l));
  state.geofenceLayers = [];

  const listEl = document.getElementById('geofencesList');
  listEl.innerHTML = '';

  if (fences.length === 0) {
    listEl.innerHTML = '<p class="text-muted" style="font-size:0.8rem">Nenhuma cerca cadastrada</p>';
    return;
  }

  fences.forEach(f => {
    // Desenha círculo no mapa com visual suave
    const circle = L.circle([f.center_latitude, f.center_longitude], {
      radius: f.radius_meters,
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.12,
      dashArray: '5, 8',
      weight: 2
    }).addTo(state.map);

    circle.bindPopup(`<strong>Cerca: ${f.name}</strong><br>Raio: ${f.radius_meters}m`);
    state.geofenceLayers.push(circle);

    // Adiciona na lista da barra lateral
    const item = document.createElement('div');
    item.className = 'fence-item';
    item.innerHTML = `
      <div>
        <strong>${f.name}</strong>
        <span class="text-muted" style="display:block; font-size:0.7rem">Raio: ${f.radius_meters}m</span>
      </div>
      <button class="btn-tiny text-rose" onclick="deleteGeofenceItem(${f.id})" title="Excluir">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    listEl.appendChild(item);
  });
}

window.deleteGeofenceItem = async function(id) {
  if (!confirm('Deseja realmente excluir esta cerca?')) return;
  try {
    await fetch(`${state.apiUrl}/api/v1/geofences/${id}`, { method: 'DELETE' });
    loadGeofences();
  } catch (err) {
    alert('Erro ao excluir cerca: ' + err.message);
  }
};

let tempFenceCircle = null;
function updateTemporaryFenceMarker(lat, lng) {
  const radius = parseInt(document.getElementById('fenceRadius').value, 10);
  if (tempFenceCircle) state.map.removeLayer(tempFenceCircle);

  tempFenceCircle = L.circle([lat, lng], {
    radius,
    color: '#06b6d4',
    fillColor: '#06b6d4',
    fillOpacity: 0.2,
    weight: 2
  }).addTo(state.map);

  state.pendingFenceCoords = [lat, lng];
}

// ==========================================
// ALERTAS RECENTES
// ==========================================
async function fetchRecentAlerts() {
  try {
    const res = await fetch(`${state.apiUrl}/api/v1/alerts?device_id=${state.activeDeviceId}&limit=10`);
    if (!res.ok) return;
    const data = await res.json();
    renderAlerts(data.alerts || []);
  } catch {}
}

function renderAlerts(alerts) {
  const listEl = document.getElementById('alertsList');
  const countBadge = document.getElementById('alertCountBadge');
  countBadge.textContent = alerts.length;

  if (alerts.length === 0) {
    listEl.innerHTML = `
      <div class="empty-alerts">
        <i class="fa-regular fa-bell-slash"></i>
        <p>Nenhum alerta disparado hoje</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  alerts.forEach(a => {
    const item = document.createElement('div');
    const isEnter = a.alert_type === 'GEOFENCE_ENTER';
    item.className = `alert-item ${isEnter ? 'enter' : ''}`;
    item.innerHTML = `
      <div class="alert-item-header">
        <span>${a.title}</span>
        <span class="alert-time">${formatRelativeTime(a.created_at)}</span>
      </div>
      <p style="color:var(--text-secondary); margin-top:2px;">${a.message}</p>
    `;
    listEl.appendChild(item);
  });
}

// ==========================================
// HISTÓRICO E PLAYER DE TRAJETO
// ==========================================
async function loadTripHistory() {
  const btn = document.getElementById('btnLoadHistory');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando rota...';
  btn.disabled = true;

  try {
    const res = await fetch(`${state.apiUrl}/api/v1/history/${state.activeDeviceId}?limit=1500`);
    if (!res.ok) throw new Error('Falha ao obter histórico');
    const data = await res.json();

    state.historyPoints = data.points || [];

    if (state.historyPoints.length === 0) {
      alert('Nenhuma rota encontrada para este dispositivo no período.');
      return;
    }

    // Exibe card de estatísticas
    document.getElementById('historyStatsCard').classList.remove('hidden');
    document.getElementById('hDist').textContent = `${data.totalDistanceKm} km`;
    document.getElementById('hMaxSpeed').textContent = `${data.maxSpeed} km/h`;
    document.getElementById('hAvgSpeed').textContent = `${data.avgSpeed} km/h`;
    document.getElementById('hPoints').textContent = data.totalPoints;

    // Plota linha no mapa
    drawHistoryPolyline(state.historyPoints);

    // Prepara o slider
    const slider = document.getElementById('historyTimeline');
    slider.max = state.historyPoints.length - 1;
    slider.value = 0;
    updatePlayerFrame(0);

  } catch (err) {
    alert('Erro ao carregar rota: ' + err.message);
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Carregar Rota';
    btn.disabled = false;
  }
}

function drawHistoryPolyline(points) {
  if (state.historyPolyline) state.map.removeLayer(state.historyPolyline);
  if (state.historyMarker) state.map.removeLayer(state.historyMarker);

  const latLngs = points.map(p => [p.latitude, p.longitude]);

  // Linha brilhante com estilo futurista
  state.historyPolyline = L.polyline(latLngs, {
    color: '#06b6d4',
    weight: 4,
    opacity: 0.85,
    lineJoin: 'round'
  }).addTo(state.map);

  // Marcador de reprodução
  const replayIcon = L.divIcon({
    className: 'custom-replay-marker',
    html: '<div style="width:20px;height:20px;background:#38bdf8;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px #38bdf8;"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  state.historyMarker = L.marker(latLngs[0], { icon: replayIcon }).addTo(state.map);
  state.map.fitBounds(state.historyPolyline.getBounds(), { padding: [40, 40] });
}

function updatePlayerFrame(index) {
  if (!state.historyPoints || state.historyPoints.length === 0) return;
  const pt = state.historyPoints[index];
  if (!pt) return;

  state.playerIndex = index;
  document.getElementById('historyTimeline').value = index;

  const latLng = [pt.latitude, pt.longitude];
  if (state.historyMarker) {
    state.historyMarker.setLatLng(latLng);
  }

  const timeStr = new Date(pt.timestamp).toLocaleTimeString();
  document.getElementById('playerCurrentTime').textContent = timeStr;
  document.getElementById('playerCurrentSpeed').textContent = `${Math.round(pt.speed)} km/h`;
}

function togglePlayPause() {
  state.isPlaying = !state.isPlaying;
  const playIcon = document.getElementById('playIcon');

  if (state.isPlaying) {
    playIcon.className = 'fa-solid fa-pause';
    state.playerTimer = setInterval(() => {
      if (state.playerIndex >= state.historyPoints.length - 1) {
        togglePlayPause();
        return;
      }
      updatePlayerFrame(state.playerIndex + 1);
    }, 200);
  } else {
    playIcon.className = 'fa-solid fa-play';
    if (state.playerTimer) clearInterval(state.playerTimer);
  }
}

// ==========================================
// SIMULADOR DE TRAJETO EM TEMPO REAL
// ==========================================
const SIMULATION_ROUTES = {
  drive_city: [
    { lat: -23.55052, lng: -46.633308, speed: 0, heading: 0, batt: 95 },
    { lat: -23.55120, lng: -46.634100, speed: 28, heading: 210, batt: 95 },
    { lat: -23.55250, lng: -46.635800, speed: 42, heading: 215, batt: 94 },
    { lat: -23.55400, lng: -46.637500, speed: 48, heading: 210, batt: 94 },
    { lat: -23.55620, lng: -46.640100, speed: 35, heading: 220, batt: 93 },
    { lat: -23.55800, lng: -46.642500, speed: 0, heading: 220, batt: 93 }
  ],
  drive_speeding: [
    { lat: -23.56000, lng: -46.645000, speed: 50, heading: 180, batt: 90 },
    { lat: -23.56300, lng: -46.645500, speed: 75, heading: 180, batt: 89 },
    { lat: -23.56700, lng: -46.646000, speed: 94, heading: 180, batt: 88 }, // DISPARA ALERTA > 80 km/h!
    { lat: -23.57100, lng: -46.646500, speed: 85, heading: 180, batt: 88 },
    { lat: -23.57500, lng: -46.647000, speed: 55, heading: 180, batt: 87 }
  ],
  drive_geofence_exit: [
    { lat: -23.55052, lng: -46.633308, speed: 0, heading: 90, batt: 85 }, // Dentro da cerca (marco zero)
    { lat: -23.55050, lng: -46.634500, speed: 25, heading: 90, batt: 85 },
    { lat: -23.55040, lng: -46.638000, speed: 50, heading: 90, batt: 84 }, // Saiu dos 250m! ALERTA
    { lat: -23.55030, lng: -46.642000, speed: 55, heading: 90, batt: 83 }
  ]
};

function startSimulation() {
  const scenarioKey = document.getElementById('simScenario').value;
  const route = SIMULATION_ROUTES[scenarioKey] || SIMULATION_ROUTES.drive_city;

  document.getElementById('btnStartSimulation').classList.add('hidden');
  document.getElementById('btnStopSimulation').classList.remove('hidden');

  state.simStep = 0;
  logSim(`[Iniciando simulação]: Cenário "${scenarioKey}" com ${route.length} pontos.`);

  state.simTimer = setInterval(async () => {
    if (state.simStep >= route.length) {
      stopSimulation();
      logSim('[Simulação finalizada com sucesso]');
      return;
    }

    const pt = route[state.simStep];
    const payload = {
      device_id: state.activeDeviceId,
      lat: pt.lat,
      lng: pt.lng,
      speed: pt.speed,
      heading: pt.heading,
      battery: pt.batt,
      ignition: pt.speed > 0 ? 1 : 0,
      timestamp: new Date().toISOString()
    };

    logSim(`Envio #${state.simStep + 1}: ${pt.speed} km/h | Coords: ${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}`);

    // Atualiza interface imediatamente
    updateDashboardUI({
      latitude: pt.lat,
      longitude: pt.lng,
      speed: pt.speed,
      heading: pt.heading,
      battery_level: pt.batt,
      ignition_status: pt.speed > 0 ? 1 : 0,
      is_moving: pt.speed > 2 ? 1 : 0,
      updated_at: payload.timestamp
    });

    // Envia requisição HTTP para a API real se estiver configurada
    try {
      await fetch(`${state.apiUrl}/api/v1/telemetry/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      logSim(`✔ Resposta 200 da API Cloudflare`);
    } catch {
      logSim(`ℹ Executando em modo local (API offline)`);
    }

    state.simStep++;
  }, 3000);
}

function stopSimulation() {
  if (state.simTimer) clearInterval(state.simTimer);
  document.getElementById('btnStartSimulation').classList.remove('hidden');
  document.getElementById('btnStopSimulation').classList.add('hidden');
}

function logSim(msg) {
  const box = document.getElementById('simLogBox');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

function simulateOfflineTelemetry() {
  const defaultCoords = [-23.55052, -46.633308];
  updateDashboardUI({
    latitude: defaultCoords[0],
    longitude: defaultCoords[1],
    speed: 0,
    heading: 0,
    battery_level: 98,
    ignition_status: 0,
    is_moving: 0,
    updated_at: new Date().toISOString()
  });
  updateConnectionStatus('online', 'Modo Demonstração');
}

// ==========================================
// EVENT LISTENERS & INTERAÇÕES DA UI
// ==========================================
function initEventListeners() {
  // Tabs Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add('active');

      // Se mudou de aba, redimensiona mapa
      setTimeout(() => state.map.invalidateSize(), 200);
    });
  });

  // Troca de Dispositivo Selecionado
  document.getElementById('deviceSelect').addEventListener('change', (e) => {
    state.activeDeviceId = e.target.value;
    fetchLiveTelemetry();
  });

  // Centralizar Veículo
  document.getElementById('btnCenterVehicle').addEventListener('click', () => {
    if (state.latestTelemetry) {
      state.map.setView([state.latestTelemetry.latitude, state.latestTelemetry.longitude], 16);
    }
  });

  // Alternar Camadas do Mapa
  document.getElementById('btnToggleMapLayer').addEventListener('click', () => {
    setMapLayer(state.mapLayerType === 'dark' ? 'streets' : 'dark');
  });

  // Seguir Veículo
  const followBtn = document.getElementById('btnFollowVehicle');
  followBtn.addEventListener('click', () => {
    state.followVehicle = !state.followVehicle;
    followBtn.classList.toggle('active', state.followVehicle);
  });

  // Copiar Coordenadas
  document.getElementById('btnCopyCoords').addEventListener('click', () => {
    const coords = document.getElementById('liveCoords').textContent;
    navigator.clipboard.writeText(coords);
    alert('Coordenadas copiadas para a área de transferência!');
  });

  // Histórico
  document.getElementById('btnLoadHistory').addEventListener('click', loadTripHistory);
  document.getElementById('btnPlayPause').addEventListener('click', togglePlayPause);
  document.getElementById('historyTimeline').addEventListener('input', (e) => {
    updatePlayerFrame(parseInt(e.target.value, 10));
  });

  // Cerca Virtual
  const radiusSlider = document.getElementById('fenceRadius');
  radiusSlider.addEventListener('input', (e) => {
    document.getElementById('radiusValueLabel').textContent = `${e.target.value}m`;
    if (state.pendingFenceCoords) {
      updateTemporaryFenceMarker(state.pendingFenceCoords[0], state.pendingFenceCoords[1]);
    }
  });

  document.getElementById('btnSetFenceAtVehicle').addEventListener('click', () => {
    if (state.latestTelemetry) {
      updateTemporaryFenceMarker(state.latestTelemetry.latitude, state.latestTelemetry.longitude);
    } else {
      updateTemporaryFenceMarker(-23.55052, -46.633308);
    }
  });

  document.getElementById('btnSaveFence').addEventListener('click', async () => {
    const name = document.getElementById('fenceName').value.trim();
    if (!name) {
      alert('Por favor, informe o nome da cerca');
      return;
    }

    const coords = state.pendingFenceCoords || (state.latestTelemetry ? [state.latestTelemetry.latitude, state.latestTelemetry.longitude] : [-23.55052, -46.633308]);
    const radius = parseInt(radiusSlider.value, 10);
    const alertExit = document.getElementById('fenceAlertExit').checked;
    const alertEnter = document.getElementById('fenceAlertEnter').checked;

    try {
      const res = await fetch(`${state.apiUrl}/api/v1/geofences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          center_latitude: coords[0],
          center_longitude: coords[1],
          radius_meters: radius,
          alert_on_exit: alertExit,
          alert_on_enter: alertEnter
        })
      });

      if (!res.ok) throw new Error('Falha ao salvar cerca');
      alert('Cerca virtual criada com sucesso!');
      if (tempFenceCircle) state.map.removeLayer(tempFenceCircle);
      loadGeofences();
    } catch (err) {
      alert('Erro ao salvar cerca: ' + err.message);
    }
  });

  // Simulador
  document.getElementById('btnStartSimulation').addEventListener('click', startSimulation);
  document.getElementById('btnStopSimulation').addEventListener('click', stopSimulation);

  // Modal de Configurações
  const modal = document.getElementById('settingsModal');
  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('apiUrlInput').value = state.apiUrl;
    document.getElementById('pollIntervalInput').value = String(state.pollIntervalMs);
    document.getElementById('demoModeToggle').checked = state.demoMode;
    modal.classList.remove('hidden');
  });

  document.getElementById('btnCloseSettings').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    const newUrl = document.getElementById('apiUrlInput').value.trim().replace(/\/$/, '');
    const newInterval = parseInt(document.getElementById('pollIntervalInput').value, 10);
    const newDemo = document.getElementById('demoModeToggle').checked;

    state.apiUrl = newUrl;
    state.pollIntervalMs = newInterval;
    state.demoMode = newDemo;

    localStorage.setItem('trackzero_api_url', newUrl);
    localStorage.setItem('trackzero_poll_interval', String(newInterval));
    localStorage.setItem('trackzero_demo_mode', String(newDemo));

    modal.classList.add('hidden');
    startLivePolling();
  });
}
