@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d %~dp0\..

echo [1/4] 检查 Node.js 与 npm...
node -v >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Node.js。请安装 Node.js 18+（推荐 LTS）：https://nodejs.org/
  pause
  exit /b 1
)
npm -v >nul 2>&1
if errorlevel 1 (
  echo 未检测到 npm，请重新安装 Node.js 18+。
  pause
  exit /b 1
)

echo [2/4] 定位前端目录...
set FRONTEND_DIR=
if exist fund-watchtower\frontend\package.json set FRONTEND_DIR=fund-watchtower\frontend
if exist frontend\package.json set FRONTEND_DIR=frontend

if "%FRONTEND_DIR%"=="" (
  echo 未找到前端 package.json。
  echo 预期路径：fund-watchtower\frontend\package.json 或 frontend\package.json
  pause
  exit /b 1
)

echo 当前前端目录：%FRONTEND_DIR%
cd /d %FRONTEND_DIR%

echo [3/4] 安装前端依赖...
if not exist node_modules (
  npm install
) else (
  echo 已存在 node_modules，跳过 npm install。
)

echo [4/4] 启动前端 http://127.0.0.1:5173 ...
npm run dev -- --host 127.0.0.1 --port 5173

pause