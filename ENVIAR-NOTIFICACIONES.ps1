# Script para enviar notificaciones manualmente
param(
    [Parameter(Mandatory=$false)]
    [string]$Title = "🔔 Notificación GST3D",
    
    [Parameter(Mandatory=$false)]
    [string]$Body = "Prueba de notificación push",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("normal", "test", "ip")]
    [string]$Type = "normal"
)

$headers = @{
    "Authorization" = "Bearer 31W99vbPAlSZPYPYTLKPHJyT1MKwHVi4y8Z1jtmwOPze9dcv4PLYte7AdRxJDaGV"
    "Content-Type" = "application/json"
}

$serverUrl = "http://localhost:3000"

Write-Host "📨 Enviando notificación..." -ForegroundColor Cyan
Write-Host "   Tipo: $Type" -ForegroundColor Yellow
Write-Host "   Título: $Title" -ForegroundColor White
Write-Host "   Mensaje: $Body`n" -ForegroundColor White

switch ($Type) {
    "normal" {
        $body = @{
            title = $Title
            body = $Body
            data = @{
                timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                source = "manual_test"
            }
        } | ConvertTo-Json -Depth 5
        
        try {
            $response = Invoke-RestMethod -Uri "$serverUrl/api/push/send" -Method POST -Headers $headers -Body $body
            Write-Host "✅ Enviada exitosamente!" -ForegroundColor Green
            Write-Host "   Exitosas: $($response.summary.successful)" -ForegroundColor Green
            Write-Host "   Fallidas: $($response.summary.failed)" -ForegroundColor $(if($response.summary.failed -gt 0){'Yellow'}else{'Green'})
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "test" {
        $body = @{
            testType = "complete"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$serverUrl/api/push/test" -Method POST -Headers $headers -Body $body
            Write-Host "✅ Test enviado exitosamente!" -ForegroundColor Green
            Write-Host "   Android API: $($response.androidCompatibility.minSdkVersion)" -ForegroundColor Cyan
            Write-Host "   Cobertura: $($response.androidCompatibility.marketCoverage)" -ForegroundColor Cyan
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "ip" {
        $body = @{
            title = "📍 Detección por IP"
            body = $Body
            data = @{
                type = "ip_detection"
                timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                location = "detected_by_ip"
            }
        } | ConvertTo-Json -Depth 5
        
        try {
            $response = Invoke-RestMethod -Uri "$serverUrl/api/push/send" -Method POST -Headers $headers -Body $body
            Write-Host "✅ Notificación con detección IP enviada!" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}


