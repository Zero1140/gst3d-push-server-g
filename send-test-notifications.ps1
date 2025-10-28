# Script para enviar notificaciones de prueba
$headers = @{
    "Authorization" = "Bearer 31W99vbPAlSZPYPYTLKPHJyT1MKwHVi4y8Z1jtmwOPze9dcv4PLYte7AdRxJDaGV"
    "Content-Type" = "application/json"
}

$serverUrl = "http://localhost:3000"

Write-Host "🧪 ENVIANDO NOTIFICACIONES DE PRUEBA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Notificación simple
Write-Host "1️⃣ Enviando notificación simple..." -ForegroundColor Yellow
$body1 = @{
    title = "🧪 Notificación Simple"
    body = "Esta es una notificación de prueba simple - $(Get-Date -Format 'HH:mm:ss')"
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$serverUrl/api/push/send" -Method POST -Headers $headers -Body $body1
    Write-Host "✅ Enviada: $($response1.successful) exitosas, $($response1.summary.failed) fallidas" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# 2. Notificación con datos adicionales
Write-Host "`n2️⃣ Enviando notificación con datos..." -ForegroundColor Yellow
$body2 = @{
    title = "📦 Notificación con Datos"
    body = "Prueba del sistema push GST3D - $(Get-Date -Format 'HH:mm:ss')"
    data = @{
        type = "test"
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        testData = "prueba de notificacion push"
    }
} | ConvertTo-Json -Depth 5

try {
    $response2 = Invoke-RestMethod -Uri "$serverUrl/api/push/send" -Method POST -Headers $headers -Body $body2
    Write-Host "✅ Enviada: $($response2.successful) exitosas, $($response2.summary.failed) fallidas" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 3

# 3. Notificación de prueba completa
Write-Host "`n3️⃣ Enviando test completo..." -ForegroundColor Yellow
$body3 = @{
    testType = "complete"
} | ConvertTo-Json

try {
    $response3 = Invoke-RestMethod -Uri "$serverUrl/api/push/test" -Method POST -Headers $headers -Body $body3
    Write-Host "✅ Enviada: $($response3.successful) exitosas" -ForegroundColor Green
    Write-Host "   Cobertura: $($response3.androidCompatibility.marketCoverage)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ PROCESO COMPLETADO" -ForegroundColor Green
Write-Host "`n📱 Verifica tu dispositivo para ver las notificaciones" -ForegroundColor Yellow



