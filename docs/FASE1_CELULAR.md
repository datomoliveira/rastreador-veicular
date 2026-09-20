# Guia da Fase 1: Transformando o Celular em Rastreador Veicular

Este guia orienta a configuração do smartphone (Android ou iPhone) para funcionar como o rastreador GPS do veículo, enviando dados em segundo plano diretamente para o seu backend na Cloudflare de forma **100% gratuita**.

---

## 1. Aplicativo Recomendado: Traccar Client

O **Traccar Client** é um aplicativo open source, gratuito e altamente estável para Android e iOS.
- Funciona em segundo plano mesmo com a tela desligada.
- Possui fila de envio offline (se o carro passar por um túnel ou área sem sinal 4G, os pontos são guardados e transmitidos assim que o sinal voltar).
- Possui filtro inteligente de movimento para não gastar a bateria do celular quando o carro estiver estacionado.

### Links para Download:
- **Android (Google Play):** [Traccar Client no Google Play](https://play.google.com/store/apps/details?id=org.traccar.client)
- **iOS (Apple App Store):** [Traccar Client na App Store](https://apps.apple.com/app/traccar-client/id843156976)

---

## 2. Configuração Passo a Passo no Traccar Client

Abra o aplicativo **Traccar Client** no seu smartphone e configure os campos exatamente assim:

1. **Identificador do Dispositivo (Device Identifier):**
   - Digite: `veiculo-01` (ou o identificador que preferir, como a placa do carro).
2. **URL do Servidor (Server URL):**
   - Digite a URL do seu Cloudflare Worker com o endpoint `/api/v1/telemetry/traccar`:
     ```text
     https://rastreador-api.SEU-SUBDOMINIO.workers.dev/api/v1/telemetry/traccar
     ```
   - *Nota: Verifique se utilizou `https://` no início.*
3. **Localização (Location Provider):**
   - Selecione: **Misto** ou **GPS**.
4. **Precisão da Localização (Accuracy):**
   - Selecione: **Alta (High)**.
5. **Intervalo de Frequência (Frequency):**
   - Recomendado para carro em movimento: **5** ou **10** segundos.
   - *Dica:* 10 segundos proporciona uma navegação suave no mapa e consome apenas ~8.640 requisições por dia (o plano gratuito da Cloudflare permite até 100.000 requisições/dia).
6. **Distância (Distance):**
   - Configure para **10** metros (só envia novo ponto se o veículo tiver se deslocado no mínimo 10m).
7. **Ângulo (Angle):**
   - Configure para **30** graus (envia um ponto extra imediatamente se o veículo fizer uma curva acentuada, mantendo o desenho da rota perfeito nas esquinas).
8. **Ativar Serviço (Service Status):**
   - Mude a chave para **LIGADO (ON)**.

---

## 3. Configurações Críticas de Bateria no Celular

Para garantir que o Android ou iOS não "mate" o aplicativo quando a tela estiver apagada:

### No Android:
1. Vá em **Configurações > Aplicativos > Traccar Client**.
2. Clique em **Bateria** e mude de "Otimizado" para **"Irrestrito"** ou **"Sem restrições"**.
3. Em **Permissões de Localização**, selecione **"Permitir o tempo todo"** (Allow all the time).
4. Ative **Início Automático / Auto-start** (especialmente em aparelhos Xiaomi/MIUI, Samsung e Motorola).

### No iPhone (iOS):
1. Vá em **Ajustes > Traccar Client**.
2. Em **Localização**, escolha **"Sempre"** e ative **"Localização Precisa"**.
3. Ative a opção **"Atualização em 2º Plano"**.

---

## 4. Dica de Uso no Carro

Se você tiver um smartphone antigo sobrando:
1. Deixe o aparelho conectado a um carregador veicular 12V escondido no porta-luvas ou sob o painel.
2. Ative um chip de operadora com plano básico ou compartilhado.
3. Configure o aparelho para não bloquear a tela quando conectado à energia ou instale um app de automação (como MacroDroid) para ligar o Traccar ao detectar energia no carregador.
