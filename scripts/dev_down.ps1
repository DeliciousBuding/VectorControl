#!/usr/bin/env pwsh
# dev_down.ps1 - 一键停止 VectorControl 本地开发环境
# 用途：停止所有由 dev_up.ps1 启动的后台任务
# 用法：在 VectorControl 根目录执行 .\scripts\dev_down.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== VectorControl 本地开发环境停止 ===" -ForegroundColor Cyan

# 获取所有后台任务
$Jobs = Get-Job

if ($Jobs.Count -eq 0) {
    Write-Host "没有发现运行中的后台任务" -ForegroundColor Yellow
    exit 0
}

Write-Host "发现 $($Jobs.Count) 个后台任务" -ForegroundColor Yellow

# 停止所有任务
foreach ($Job in $Jobs) {
    $JobName = $Job.Name
    $JobCommand = $Job.Command -join " "
    
    # 检查是否是我们的开发任务（uvicorn 或 vite）
    if ($JobCommand -match "uvicorn|vite|npm run dev") {
        Write-Host "停止任务: $JobName ($($Job.Command[0..2] -join ' '))" -ForegroundColor Gray
        Stop-Job -Job $Job -ErrorAction SilentlyContinue
        Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "`n=== 停止完成 ===" -ForegroundColor Green
Write-Host "提示: 如需重启，执行 .\scripts\dev_up.ps1" -ForegroundColor Gray
