# Build Script — gera a pasta dist para upload manual na Hostinger
Set-Location "C:\seuprovador"

Write-Host "Construindo projeto..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Build concluido! Suba a pasta dist/ para a Hostinger." -ForegroundColor Green
} else {
    Write-Host "Erro no build!" -ForegroundColor Red
    exit 1
}
