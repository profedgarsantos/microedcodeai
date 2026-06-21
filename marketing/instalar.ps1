# Instalador do microedcode.ai para VS Code
# Execute com PowerShell:  ./instalar.ps1
# (clique com o botao direito e "Executar com PowerShell")

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==> microedcode.ai - Instalador" -ForegroundColor Cyan

$code = Get-Command code -ErrorAction SilentlyContinue
if (-not $code) {
    Write-Host "ERRO: comando 'code' nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Abra o VS Code, pressione Ctrl+Shift+P e execute:" -ForegroundColor Yellow
    Write-Host "  Shell Command: Install 'code' command in PATH" -ForegroundColor Yellow
    exit 1
}

$vsix = Join-Path $PSScriptRoot "microedcodeai.vsix"
if (-not (Test-Path $vsix)) {
    Write-Host "ERRO: microedcodeai.vsix nao encontrado nesta pasta." -ForegroundColor Red
    exit 1
}

Write-Host "==> Instalando microedcode.ai no VS Code..." -ForegroundColor Cyan
code --install-extension $vsix --force

Write-Host ""
Write-Host "microedcode.ai instalado com sucesso!" -ForegroundColor Green
Write-Host "Reinicie o VS Code e clique no icone da extensao na barra lateral." -ForegroundColor Green
