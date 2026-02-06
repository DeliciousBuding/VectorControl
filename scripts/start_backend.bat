@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

cd /d %~dp0\..

echo [1/3] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Python。请安装 Python 3.11+ 并加入 PATH。
  pause
  exit /b 1
)

echo [2/3] 安装后端依赖...
if exist backend\requirements.txt (
  python -m pip install -r backend\requirements.txt
) else (
  echo 未找到 backend\requirements.txt，请检查仓库目录。
  pause
  exit /b 1
)

echo [3/3] 启动后端 http://127.0.0.1:21345 ...
echo 提示：若 .env 未配置 API_TOKEN，系统会生成运行时 Token。
cd /d backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 21345

pause