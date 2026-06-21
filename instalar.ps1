# Instalador da extensao microedcode.ai para o VS Code.
# Uso: clique com o botao direito e "Executar com PowerShell",
# ou no terminal:  ./instalar.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==> microedcode.ai - instalador para VS Code" -ForegroundColor Cyan

# 1) Verifica o comando 'code'
$code = Get-Command code -ErrorAction SilentlyContinue
if (-not $code) {
    Write-Host "ERRO: comando 'code' nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Abra o VS Code, pressione Ctrl+Shift+P e execute:" -ForegroundColor Yellow
    Write-Host "  Shell Command: Install 'code' command in PATH" -ForegroundColor Yellow
    exit 1
}

# 2) Verifica o npm
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "ERRO: 'npm' nao encontrado. Instale o Node.js (https://nodejs.org)." -ForegroundColor Red
    exit 1
}

# 3) Instala dependencias (se necessario)
if (-not (Test-Path "node_modules")) {
    Write-Host "==> Instalando dependencias (npm install)..." -ForegroundColor Cyan
    npm install
}

# 4) Compila o codigo TypeScript
Write-Host "==> Compilando (npm run compile)..." -ForegroundColor Cyan
npm run compile

# 5) Gera o pacote .vsix
Write-Host "==> Gerando pacote microedcodeai.vsix..." -ForegroundColor Cyan
npm run package

if (-not (Test-Path "microedcodeai.vsix")) {
    Write-Host "ERRO: o pacote microedcodeai.vsix nao foi gerado." -ForegroundColor Red
    exit 1
}

# 6) Instala a extensao no VS Code
Write-Host "==> Instalando a extensao no VS Code..." -ForegroundColor Cyan
code --install-extension microedcodeai.vsix --force

Write-Host ""
Write-Host "Concluido! Reinicie o VS Code e abra o microedcode.ai na barra lateral." -ForegroundColor Green
