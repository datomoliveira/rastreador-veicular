# TrackZero: Sistema de Rastreamento Veicular Serverless (Cloudflare)

Sistema completo de telemetria e rastreamento veicular em tempo real desenvolvido com foco em **Custo Zero (R$ 0/mês)**, utilizando a camada gratuita do ecossistema Cloudflare (Workers, D1 Database e Pages).

O sistema foi desenhado de forma híbrida e modular para atender a duas fases:
- **Fase 1 (Atual):** O smartphone (Android ou iPhone) atua como rastreador via aplicativo em segundo plano (**Traccar Client**).
- **Fase 2 (Futura):** Rastreador físico 12V/OBD2 com chip M2M transmite para o mesmo backend sem alterar a estrutura.

---

## 🚀 Arquitetura & Otimizações Free Tier

| Recurso | Tecnologia | Otimização para Manter R$ 0 / Mês |
|---|---|---|
| **API Serverless** | Cloudflare Workers (Hono / TypeScript) | Suporta até 100.000 requisições/dia gratuitas |
| **Banco de Dados** | Cloudflare D1 (SQLite Serverless) | Tabela `latest_positions` com UPSERT (evita o limite de 1k gravações do KV) + 100.000 writes/dia |
| **Filtro de Economia** | Stationary Deadband Filtering | Quando o carro está parado, filtra dados redundantes, economizando gravações e bateria |
| **Alertas Push** | Telegram Bot API + ntfy.sh | Notificações push gratuitas ilimitadas para excesso de velocidade e cercas virtuais |
| **Dashboard** | Cloudflare Pages (Leaflet.js / OSM) | Hospedagem estática ilimitada e gratuita com mapas interativos |
| **Tarefas Agendadas** | Cloudflare Cron Triggers | Limpeza periódica automática de históricos antigos (> 45 dias) |

---

## 📁 Estrutura do Projeto

```
.
├── backend/
│   ├── db/
│   │   └── schema.sql              # Schema D1 (devices, latest_positions, positions, geofences, alerts)
│   ├── src/
│   │   ├── index.ts                # Ponto de entrada do Worker + CORS + Cron
│   │   ├── types.ts                # Interfaces TypeScript canônicas
│   │   ├── normalizers/            # Adaptadores de protocolo
│   │   │   ├── traccar.ts          # Normalizador Traccar Client (converte nós -> km/h)
│   │   │   ├── standard.ts         # Normalizador JSON
│   │   │   └── hardware.ts         # Normalizador Webhook Hardware 4G (Teltonika/Micodus)
│   │   ├── services/
│   │   │   ├── db.ts               # Camada de queries parametrizadas D1
│   │   │   ├── geofence.ts         # Cálculo Haversine de distância em metros
│   │   │   └── alerts.ts           # Motor de regras, Telegram Bot e ntfy.sh
│   │   └── routes/
│   │       ├── telemetry.ts        # Ingestão multi-protocolo (/api/v1/telemetry)
│   │       ├── devices.ts          # Gerenciamento de veículos (/api/v1/devices)
│   │       ├── history.ts          # Trajetos e estatísticas (/api/v1/history)
│   │       ├── geofences.ts        # Cercas eletrônicas (/api/v1/geofences)
│   │       └── alerts.ts           # Consulta de alertas (/api/v1/alerts)
│   ├── wrangler.toml               # Configurações do Cloudflare Worker e D1
│   └── package.json
│
├── frontend/
│   ├── index.html                  # Dashboard SPA responsivo
│   ├── style.css                   # Design moderno, dark theme, glassmorphism e animações
│   └── app.js                      # Leaflet.js, polling ao vivo, player de histórico e simulador
│
├── docs/
│   ├── FASE1_CELULAR.md            # Guia passo a passo para configurar o Traccar Client no celular
│   ├── FASE2_HARDWARE.md           # Guia de compra, chip M2M, esquema elétrico 12V/OBD2
│   └── DEPLOY_CLOUDFLARE.md        # Tutorial para publicar o backend e frontend na Cloudflare
│
└── test-drive-simulation.ps1       # Script PowerShell para simular viagens com alertas de velocidade
```

---

## ⚡ Como Começar Imediatamente

1. **Testar o Dashboard Localmente:**
   - Basta abrir o arquivo `frontend/index.html` em qualquer navegador! O painel possui um **Simulador de Direção GPS** embutido para você testar todas as funcionalidades (velocímetro, rotação de pino, alertas de excesso de velocidade e cercas virtuais) mesmo antes de publicar a API.

2. **Configurar o Celular (Fase 1):**
   - Siga as instruções do guia [docs/FASE1_CELULAR.md](file:///c:/Users/Escola/Downloads/product_for_asperustech/Dona%20Edna/docs/FASE1_CELULAR.md).

3. **Publicar na Cloudflare Gratuitamente:**
   - Siga o passo a passo detalhado no guia [docs/DEPLOY_CLOUDFLARE.md](file:///c:/Users/Escola/Downloads/product_for_asperustech/Dona%20Edna/docs/DEPLOY_CLOUDFLARE.md).
