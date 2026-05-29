@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════╗
echo ║   Story Editor - 本地故事包编辑器   ║
echo ╚════════════════════════════════════╝
echo.

if not exist "node_modules" (
    echo [1/2] 首次运行，安装依赖...
    call npm install
    echo.
)

echo [2/2] 启动服务...
echo.
start http://localhost:4001
npx tsx server/index.ts

pause
