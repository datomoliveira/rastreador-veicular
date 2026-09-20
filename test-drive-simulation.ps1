# ==========================================================
# Script de Teste e Simulação de Trajeto Veicular
# Envia pontos GPS simulando uma viagem real com excesso de velocidade
# ==========================================================

param (
    [string]$ApiUrl = "http://localhost:8787",
    [string]$DeviceId = "veiculo-01"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SIMULADOR DE TELEMETRIA VEICULAR - TESTE EM TEMPO REAL" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Alvo: $ApiUrl/api/v1/telemetry/json" -ForegroundColor Yellow
Write-Host "Dispositivo: $DeviceId" -ForegroundColor Yellow
Write-Host ""

# Trajeto simulado: Saindo do Marco Zero em direção à Av. Paulista
$pontos = @(
    @{ Lat = -23.55052; Lng = -46.633308; Speed = 0;  Heading = 0;   Batt = 95; Desc = "Veículo parado na garagem (Marco Zero)" },
    @{ Lat = -23.55180; Lng = -46.634500; Speed = 25; Heading = 210; Batt = 95; Desc = "Saindo da garagem e acelerando" },
    @{ Lat = -23.55390; Lng = -46.636900; Speed = 45; Heading = 215; Batt = 94; Desc = "Tráfego urbano normal" },
    @{ Lat = -23.55620; Lng = -46.639800; Speed = 60; Heading = 210; Batt = 94; Desc = "Entrando na via expressa" },
    @{ Lat = -23.55950; Lng = -46.643200; Speed = 88; Heading = 210; Batt = 93; Desc = "🚨 EXCESSO DE VELOCIDADE (88 km/h > 80 km/h) - Disparo de Alerta" },
    @{ Lat = -23.56310; Lng = -46.646800; Speed = 92; Heading = 210; Batt = 93; Desc = "🚨 Continuando em excesso (92 km/h)" },
    @{ Lat = -23.56650; Lng = -46.650200; Speed = 50; Heading = 215; Batt = 92; Desc = "Desacelerando ao sair da via expressa" },
    @{ Lat = -23.56900; Lng = -46.652800; Speed = 30; Heading = 220; Batt = 92; Desc = "Aproximando do destino" },
    @{ Lat = -23.57100; Lng = -46.655000; Speed = 0;  Heading = 220; Batt = 91; Desc = "Estacionado e chave desligada" }
)

$step = 1
foreach ($p in $pontos) {
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $ignition = if ($p.Speed -gt 0) { 1 } else { 0 }

    $payload = @{
        device_id = $DeviceId
        lat       = $p.Lat
        lng       = $p.Lng
        speed     = $p.Speed
        heading   = $p.Heading
        battery   = $p.Batt
        ignition  = $ignition
        timestamp = $timestamp
    } | ConvertTo-Json

    Write-Host "[$step/$($pontos.Count)] $($p.Desc)..." -ForegroundColor White
    Write-Host "  -> Coords: $($p.Lat), $($p.Lng) | Vel: $($p.Speed) km/h | Bateria: $($p.Batt)%" -ForegroundColor DarkGray

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/telemetry/json" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 5
        Write-Host "  ✔ Sucesso: $($response.timestamp)" -ForegroundColor Green
    } catch {
        Write-Host "  ✖ Falha no envio: $_" -ForegroundColor Red
    }

    $step++
    if ($step -le $pontos.Count) {
        Start-Sleep -Seconds 3
    }
}

Write-Host ""
Write-Host "Simulação concluída! Abra o Dashboard para verificar a rota e os alertas." -ForegroundColor Cyan
