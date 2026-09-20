-- ==========================================================
-- SISTEMA DE RASTREAMENTO VEICULAR SERVERLESS (CLOUDFLARE D1)
-- SCHEMA D1 (SQLite) - Otimizado para Zero Custo (Free Tier)
-- ==========================================================

-- 1. Tabela de Dispositivos Cadastrados
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,                       -- UUID, IMEI ou identificador configurado (ex: "carro-edna-01")
    name TEXT NOT NULL,                        -- Nome amigável (ex: "Fiat Argo", "Celular Motorista")
    device_type TEXT NOT NULL,                 -- 'MOBILE_APP' ou 'GPS_HARDWARE'
    protocol TEXT DEFAULT 'TRACCAR',           -- 'TRACCAR', 'STANDARD_JSON', 'TELTONIKA_HTTP', 'MICODUS_HTTP'
    api_key TEXT NOT NULL,                     -- Chave de segurança para validar o envio
    max_speed_limit REAL DEFAULT 80.0,         -- Limite de velocidade para alerta (km/h)
    battery_alert_threshold INTEGER DEFAULT 20,-- Alerta de bateria fraca (%)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Último Posição (Substitui KV com 100.000 writes/dia gratuitos)
-- Utiliza UPSERT (INSERT OR REPLACE) por device_id
CREATE TABLE IF NOT EXISTS latest_positions (
    device_id TEXT PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL DEFAULT 0,                      -- km/h
    heading REAL DEFAULT 0,                    -- Direção (0 a 360 graus)
    altitude REAL DEFAULT 0,                   -- Altitude em metros
    battery_level INTEGER DEFAULT 100,         -- % de bateria (celular ou bateria do rastreador)
    ignition_status INTEGER DEFAULT 0,         -- 0 = Desligada / Parado, 1 = Ligada / Em viagem
    accuracy REAL DEFAULT 0,                   -- Precisão do GPS em metros
    is_moving INTEGER DEFAULT 0,               -- 0 = Parado, 1 = Em movimento
    address TEXT,                              -- Geocodificação reversa ou ponto de referência (opcional)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- 3. Histórico de Posições (Gravação somente quando em movimento ou heartbeat a cada X minutos)
CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL DEFAULT 0,
    heading REAL DEFAULT 0,
    altitude REAL DEFAULT 0,
    battery_level INTEGER DEFAULT 100,
    ignition_status INTEGER DEFAULT 0,
    accuracy REAL DEFAULT 0,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Índices vitais para consultas de rotas rápidas e de baixo custo no D1
CREATE INDEX IF NOT EXISTS idx_positions_device_time ON positions(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_time ON positions(timestamp DESC);

-- 4. Tabela de Cercas Eletrônicas (Geofences)
CREATE TABLE IF NOT EXISTS geofences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                        -- Ex: "Garagem de Casa", "Escola", "Oficina"
    device_id TEXT,                            -- Opcional: vinculado a um dispositivo específico ou a todos (NULL)
    center_latitude REAL NOT NULL,
    center_longitude REAL NOT NULL,
    radius_meters REAL NOT NULL,               -- Raio circular em metros
    alert_on_exit INTEGER DEFAULT 1,           -- 1 = Alerta ao sair da cerca
    alert_on_enter INTEGER DEFAULT 0,          -- 1 = Alerta ao entrar na cerca
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Logs de Alertas Disparados (Excesso de velocidade, saída de cerca, bateria baixa)
CREATE TABLE IF NOT EXISTS alert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,                  -- 'SPEEDING', 'GEOFENCE_EXIT', 'GEOFENCE_ENTER', 'LOW_BATTERY', 'SOS'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    speed REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_device ON alert_logs(device_id, created_at DESC);

-- Dispositivo Padrão Inicial para Testes Imediatos
INSERT OR IGNORE INTO devices (id, name, device_type, protocol, api_key, max_speed_limit) 
VALUES ('veiculo-01', 'Meu Veículo / Celular', 'MOBILE_APP', 'TRACCAR', 'edna-secret-token-2026', 80.0);

-- Cerca Inicial de Exemplo (Raio de 250m)
INSERT OR IGNORE INTO geofences (id, name, center_latitude, center_longitude, radius_meters, alert_on_exit, alert_on_enter)
VALUES (1, 'Garagem Principal', -23.55052, -46.633308, 250, 1, 0);
