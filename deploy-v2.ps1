# Deploy Script — envia o código para o GitHub e aciona o deploy automático na Hostinger
# O GitHub Actions (deploy.yml) cuida do build e do upload via FTPS.

Set-Location "C:\seuprovador"

Write-Host "Subindo codigo para o GitHub..." -ForegroundColor Yellow
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deploy iniciado! GitHub Actions esta construindo e enviando para Hostinger." -ForegroundColor Green
    Write-Host "Acompanhe em: https://github.com/lepoa/seu-provador-hospedado/actions" -ForegroundColor Cyan
} else {
    Write-Host "Erro ao fazer push!" -ForegroundColor Red
    exit 1
}
