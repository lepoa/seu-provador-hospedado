# Deploy Script for lepoa_v2
$remoteUrl = "https://github.com/lepoa/lepoa_v2.git"
$distPath = "dist"

Write-Host "🚀 Iniciando deploy automático para lepoa_v2..." -ForegroundColor Cyan

if (!(Test-Path $distPath)) {
    Write-Host "❌ Pasta dist não encontrada. Rode 'npm run build' primeiro." -ForegroundColor Red
    exit 1
}

cd $distPath

# Garante que o Git está inicializado na pasta dist
if (!(Test-Path ".git")) {
    git init
    git branch -m main
    git remote add origin $remoteUrl
}

# Configurações de identidade local (escopo do repositório dist)
git config user.email "comercial@lepoa.com.br"
git config user.name "lepoa"

# Adiciona todos os arquivos do build
git add .
git commit -m "deploy: upload automático da versão funcional ($(Get-Date -Format 'dd/MM/yyyy HH:mm'))"

# Push forçado para garantir que o repositório remoto sempre reflita o dist local
Write-Host "Subindo arquivos para o GitHub..." -ForegroundColor Yellow
git push origin main --force

Write-Host "Deploy concluido com sucesso!" -ForegroundColor Green
cd ..
