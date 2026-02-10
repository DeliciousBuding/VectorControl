#!/usr/bin/env pwsh
# dev_up.ps1 - 一键启动 VectorControl 本地开发环境
# 用途：同时启动后端（uvicorn 21345）和前端（vite 5173）
# 用法：在 VectorControl 根目录执行 .\scripts\dev_up.ps1

param(
    [switch]$Background
)

$ErrorActionPreference = "Stop"

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "=== VectorControl 本地开发环境启动 ===" -ForegroundColor Cyan
Write-Host "项目根目录: $ProjectRoot" -ForegroundColor Gray

# 检查后端依赖
$BackendDir = Join-Path $ProjectRoot "backend"
$BackendVenv = Join-Path $BackendDir "venv"
$BackendActivate = Join-Path $BackendVenv "Scripts\Activate.ps1"

if (-not (Test-Path $BackendVenv)) {
    Write-Host "[后端] 创建虚拟环境..." -ForegroundColor Yellow
    Push-Location $BackendDir
    python -m venv venv
    Pop-Location
}

Write-Host "[后端] 激活虚拟环境并安装依赖..." -ForegroundColor Yellow
if (Test-Path $BackendActivate) {
    & $BackendActivate
}

Push-Location $BackendDir
pip install -q -r requirements.txt 2>$null
Pop-Location

# 启动后端
Write-Host "[后端] 启动 uvicorn (端口 21345)..." -ForegroundColor Green
$BackendJob = Start-Job -ScriptBlock {
    param($BackendDir)
    Set-Location $BackendDir
    python -m uvicorn app.main:app --host 127.0.0.1 --port 21345
} -ArgumentList $BackendDir

Start-Sleep -Seconds 2

# 检查后端健康
Write-Host "[后端] 检查健康状态..." -ForegroundColor Yellow
$BackendHealth = $false
try {
    $Response = Invoke-WebRequest -Uri "http://127.0.0.1:21345/api/healthz" -TimeoutSec 5 -UseBasicParsing
    if ($Response.StatusCode -eq 200) {
        $BackendHealth = $true
        Write-Host "[后端] ✓ 健康检查通过" -ForegroundColor Green
    }
} catch {
    Write-Host "[后端] ✗ 健康检查失败，请检查后端日志" -ForegroundColor Red
}

# 启动前端
$FrontendDir = Join-Path $ProjectRoot "frontend"

Write-Host "[前端] 安装依赖..." -ForegroundColor Yellow
Push-Location $FrontendDir
npm install --silent 2>$null
Pop-Location

Write-Host "[前端] 启动 Vite (端口 5173)..." -ForegroundColor Green
$FrontendJob = Start-Job -ScriptBlock {
    param($FrontendDir)
    Set-Location $FrontendDir
    npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
} -ArgumentList $FrontendDir

Start-Sleep -Seconds 3

# 检查前端
Write-Host "[前端] 检查 Vite 状态..." -ForegroundColor Yellow
try {
    $Response = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -TimeoutSec 5 -UseBasicParsing
    if ($Response.StatusCode -eq 200) {
        Write-Host "[前端] ✓ Vite 启动成功" -ForegroundColor Green
    }
} catch {
    Write-Host "[前端] ✗ Vite 启动失败，请检查前端日志" -ForegroundColor Red
}

Write-Host "`n=== 启动完成 ===" -ForegroundColor Cyan
Write-Host "前端地址: http://127.0.0.1:5173" -ForegroundColor White
Write-Host "后端健康: http://127.0.0.1:21345/api/healthz" -ForegroundColor White
Write-Host "`n提示:" -ForegroundColor Yellow
Write-Host "  - 查看日志: Get-Job | Receive-Job" -ForegroundColor Gray
Write-Host "  - 停止服务: .\scripts\dev_down.ps1" -ForegroundColor Gray
Write-Host "  - 或手动停止: Get-Job | Stop-Job" -ForegroundColor Gray

if (-not $Background) {
    Write-Host "`n按任意键退出（后台服务将继续运行）..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
