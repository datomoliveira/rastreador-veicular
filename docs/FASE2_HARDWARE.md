# Guia da Fase 2: Escolha, Instalação e Configuração do Rastreador Físico

Quando você decidir dar o próximo passo e instalar um módulo de rastreamento dedicado no veículo, siga as orientações deste guia para garantir compatibilidade nativa com o ecossistema gratuito da Cloudflare.

---

## 1. O Que Buscar no Rastreador Físico (Requisitos Técnicos)

Para funcionar diretamente com a Cloudflare sem precisar pagar servidores VPS extras:

1. **Conectividade 4G LTE:**
   - As redes 2G estão sendo gradualmente desligadas no Brasil. **Nunca compre rastreadores 2G baratos legados**. Adquira aparelhos **4G LTE Cat-1** ou **Cat-M1**.
2. **Suporte a Protocolo HTTP / Webhooks:**
   - O rastreador deve conseguir enviar pacotes via `HTTP POST` ou `HTTP GET` para o endpoint da Cloudflare.
3. **Sensor de Ignição Físico (Fio ACC / Pós-Chave):**
   - Permite que o sistema saiba exatamente quando a chave do carro foi virada, sem depender apenas do movimento do GPS.

---

## 2. Modelos Altamente Recomendados

### Opção A (Profissional / Top de Linha): Teltonika FMB920 ou FMC003 (OBD2)
- **Marca:** Teltonika (Fabricação Europeia).
- **Por que é o melhor?**
  - Possui o recurso nativo **GPRS Data Sending via HTTP/HTTPS** (Codec 8 over HTTP).
  - Pode enviar os dados direto para o seu Worker da Cloudflare.
  - O modelo **FMC003** é plug-and-play na porta **OBD2** do carro (basta espetar na porta de diagnóstico embaixo do volante do Fiat Argo, sem cortar nenhum fio da garantia!).
  - Bateria de backup interna (se a bateria do carro for desconectada, ele continua transmitindo e dispara alerta de violação).

### Opção B (Custo-Benefício 12V com Bloqueio): Micodus MV720 4G
- **Tipo:** Rastreador oculto no formato de relé veicular.
- **Vantagem:** Parece um relé elétrico comum original do veículo, dificultando sua localização por criminosos.
- **Recursos:** Suporta envio via HTTP, corte de combustível e bateria de backup.

### Opção C (Mais Econômico): SinoTrack ST-901 4G
- **Atenção:** Certifique-se de comprar a versão **4G** (geralmente identificada como ST-901L ou ST-901 4G) e habilitar o modo de transmissão de parâmetros via Webhook.

---

## 3. Chip de Telemetria (SIM Card M2M) no Brasil

Para o rastreador transmitir os dados via rede celular:
- **Não use chips pré-pagos convencionais de voz**, pois as operadoras bloqueiam por "uso indevido" após algumas semanas de tráfego de dados contínuo.
- **Use um Chip M2M Multi-Operadora:**
  - Custo médio no Brasil: **R$ 10,00 a R$ 15,00 por mês** (com pacote de 20MB a 50MB, que é mais do que suficiente para milhões de coordenadas).
  - O chip multi-operadora conecta automaticamente na melhor rede disponível (Vivo, Claro ou TIM), garantindo que o carro não fique sem sinal na estrada.
  - Fornecedores fáceis de contratar online: *Vodafone M2M, Brasil M2M, SuperSIM IoT, Links Field*.

---

## 4. Esquema Básico de Instalação Elétrica (Instalação Oculta 12V)

A maioria dos rastreadores veiculares possui um chicote com 4 fios:

| Fio | Cor Padrão | Onde Conectar no Carro | Função |
|---|---|---|---|
| **VCC (+)** | Vermelho | 12V Direto da Bateria (com fusível) | Alimentação contínua mesmo com carro desligado |
| **GND (-)** | Preto | Chassi do veículo (Terra / Negativo) | Aterramento |
| **ACC** | Laranja ou Amarelo | Pós-Chave (linha 15 da ignição) | Detecta quando a ignição foi ligada |
| **RELÉ** | Amarelo/Verde | Bomba de combustível ou partida | Permite bloqueio remoto do motor |

> [!IMPORTANT]
> **Aviso de Segurança Crítico sobre o Alerta de Velocidade:**
> O cálculo e alerta de velocidade máxima (> 80 km/h) é **100% informativo**. Ele existe única e exclusivamente para estatística no painel e envio de notificações push (Telegram / ntfy.sh). Em hipótese alguma o sistema aciona corte de combustível ou desligamento do motor baseado em velocidade. Bloqueios de motor são comandos manuais e deliberados do proprietário em caso de roubo/furto.

> [!TIP]
> **Se você comprou o modelo OBD2 (ex: Teltonika FMC003):** Não há instalação elétrica. Basta plugar o conector na porta OBD2 do carro (localizada próxima aos pedais / caixa de fusíveis do motorista).

---

## 5. Exemplo de Comandos de Configuração (Via SMS)

Depois de inserir o chip M2M no rastreador, envia-se alguns comandos SMS do seu celular para o número do chip para configurá-lo:

1. **Configurar APN da Operadora M2M:**
   ```text
   APN,nome_da_apn,usuario,senha#
   ```
2. **Configurar URL do Servidor Cloudflare:**
   ```text
   SERVER,1,rastreador-api.SEU-SUBDOMINIO.workers.dev,443,1#
   ```
   Ou no formato HTTP:
   ```text
   HTTP,1,https://rastreador-api.SEU-SUBDOMINIO.workers.dev/api/v1/telemetry/hardware#
   ```
3. **Configurar Intervalo de Envio:**
   - Carro ligado: a cada 10 segundos (`TIMER,10#`).
   - Carro desligado: a cada 600 segundos (10 minutos) (`STATIC,600#`).
