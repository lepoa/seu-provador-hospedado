# Deploy Script for lepoa_v3
$remoteUrl = "https://github.com/lepoa/lepoa_v3.git"
$distPath = "dist_v3"

Write-Host "Iniciando deploy automatico para lepoa_v3..." -ForegroundColor Cyan

if (!(Test-Path $distPath)) {
    Write-Host "Pasta dist_v3 nao encontrada. Verifique se o caminho esta correto." -ForegroundColor Red
    exit 1
}

cd $distPath

# Garante que o Git esta inicializado na pasta dist_v3
if (!(Test-Path ".git")) {
    git init
    git branch -m main
}

# Forca o remote correto
git remote remove origin 2>$null
git remote add origin $remoteUrl

# Configuracoes de identidade local
git config user.email "comercial@lepoa.com.br"
git config user.name "lepoa"

# Adiciona todos os arquivos
git add .
git commit -m "deploy: upload automatico da versao funcional v3 ($(Get-Date -Format 'dd/MM/yyyy HH:mm'))"

# Push forcado para garantir que o repositorio remoto sempre reflita o dist local
Write-Host "Subindo arquivos para o GitHub (lepoa_v3)..." -ForegroundColor Yellow
git push origin main --force

Write-Host "Deploy concluido com sucesso no lepoa_v3!" -ForegroundColor Green
cd ..
