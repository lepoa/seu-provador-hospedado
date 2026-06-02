# Deploy Script — envia o código-fonte para o GitHub
# O GitHub Actions (deploy.yml) cuida do build e do upload via FTPS para a Hostinger.

Write-Host "Verificando alteracoes..." -ForegroundColor Cyan

Set-Location "C:\seuprovador"

# Verifica se há algo para commitar
$status = git status --porcelain
if ($status) {
    Write-Host "Existem arquivos nao commitados. Commite antes de fazer deploy." -ForegroundColor Yellow
    git status
    exit 1
}

# Envia para o GitHub (origem correta que tem o GitHub Actions configurado)
Write-Host "Subindo codigo para o GitHub (seu-provador-hospedado)..." -ForegroundColor Yellow
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Push concluido! O GitHub Actions esta construindo e enviando para Hostinger." -ForegroundColor Green
    Write-Host "Acompanhe em: https://github.com/lepoa/seu-provador-hospedado/actions" -ForegroundColor Cyan
} else {
    Write-Host "Erro ao fazer push!" -ForegroundColor Red
    exit 1
}
