# Guia de Publicação: Cloudflare Free Tier (Custo R$ 0/Mês)

Este tutorial ensina o passo a passo para colocar a API e o Dashboard no ar utilizando os planos gratuitos da Cloudflare.

---

## 1. Pré-Requisitos

1. Uma conta gratuita no site [cloudflare.com](https://cloudflare.com).
2. O Node.js instalado no seu computador para usar a ferramenta de linha de comando `wrangler` (ou você pode fazer diretamente pelo painel web da Cloudflare).

---

## 2. Passo 1: Criar o Banco de Dados D1 (SQLite Gratuito)

No terminal, dentro da pasta `backend`:

```bash
cd backend
npx wrangler d1 create rastreador_db
```

O comando retornará um bloco parecido com este:
```toml
[[d1_databases]]
binding = "DB"
database_name = "rastreador_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

1. Abra o arquivo [backend/wrangler.toml](file:///c:/Users/Escola/Downloads/product_for_asperustech/Dona%20Edna/backend/wrangler.toml).
2. Cole o `database_id` gerado no campo correspondente.

---

## 3. Passo 2: Executar as Tabelas no Banco D1

Ainda na pasta `backend`, execute o script de migração:

```bash
# Executa a criação das tabelas no banco de dados remoto da Cloudflare
npx wrangler d1 execute rastreador_db --remote --file=./db/schema.sql
```

Pronto! As tabelas `devices`, `latest_positions`, `positions`, `geofences` e `alert_logs` estão criadas e prontas.

---

## 4. Passo 3: Configurar Alertas (Telegram e ntfy.sh)

### ntfy.sh (Push Web/App no Celular):
1. Instale o aplicativo **ntfy** no seu celular (Google Play ou App Store) ou acesse no navegador.
2. Crie um tópico com um nome único seu (ex: `meu_fiat_argo_9921`).
3. No arquivo [backend/wrangler.toml](file:///c:/Users/Escola/Downloads/product_for_asperustech/Dona%20Edna/backend/wrangler.toml), altere `NTFY_TOPIC = "meu_fiat_argo_9921"`.

### Telegram Bot (Opcional, altamente recomendado):
Se desejar alertas no Telegram:
1. Abra o Telegram e inicie uma conversa com `@BotFather`.
2. Digite `/newbot` e siga as instruções para obter o seu **Token**.
3. Obtenha o seu ID de chat com `@userinfobot`.
4. Salve os segredos de forma segura no Worker:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```

---

## 5. Passo 4: Publicar a API (Cloudflare Worker)

Dentro da pasta `backend`, execute:

```bash
npx wrangler deploy
```

O terminal mostrará a sua URL pública ativa, algo como:
```text
Published rastreador-veicular-api (0.91 sec)
  https://rastreador-veicular-api.SEU-SUBDOMINIO.workers.dev
```

Guarde essa URL! Ela é a base de tudo.

---

## 6. Passo 5: Publicar o Dashboard (Cloudflare Pages)

Você tem duas formas super fáceis e gratuitas de colocar o Dashboard no ar:

### Método A: Via Arrastar e Soltar (Sem terminal)
1. Acesse o painel da Cloudflare: **Workers & Pages > Create application > Pages**.
2. Clique na aba **Upload assets** (Carregar recursos).
3. Dê um nome ao seu projeto (ex: `meu-rastreador-dashboard`).
4. Arraste a pasta `frontend` completa e clique em **Deploy site**.
5. Em 10 segundos seu dashboard estará acessível em `https://meu-rastreador-dashboard.pages.dev`!

### Método B: Via Linha de Comando (Wrangler)
No terminal, dentro da pasta `frontend`:
```bash
cd ../frontend
npx wrangler pages deploy . --project-name=meu-rastreador-dashboard
```

---

## 7. Passo 6: Conectar o Dashboard à API

1. Abra o site do seu dashboard (`https://meu-rastreador-dashboard.pages.dev`).
2. Clique no ícone de **Engrenagem (Configurações)** no canto superior direito.
3. No campo **URL da API Cloudflare Workers**, cole a URL obtida no Passo 4:
   ```text
   https://rastreador-veicular-api.SEU-SUBDOMINIO.workers.dev
   ```
4. Clique em **Salvar Configurações**.

A luz verde de status no topo mudará para **"Ao Vivo"**. Agora você já pode configurar o Traccar Client no seu celular ou usar o simulador interno para testar!
