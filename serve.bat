@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo   DOOYOOR 本地预览服务
echo ============================================================
echo.
echo   [1] 本机浏览器打开：
echo       http://localhost:8080
echo.
echo   [2] 手机浏览器打开（手机必须与这台电脑连同一个 Wi-Fi）：
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo       http://%%b:8080
)
echo.
echo   注意：
echo     - 手机打不开时，多半是 Windows 防火墙拦了 8080 端口。
echo       首次运行若弹出"是否允许访问网络"，请勾选"专用网络"并允许。
echo     - 电脑换 Wi-Fi 或重启后 IP 可能变化，重新运行本脚本看新地址。
echo     - 必须用这个服务打开，不要直接双击 html 文件：
echo       账号 / 购物袋 / 订单 / 收藏 依赖浏览器本地存储，
echo       用 file:// 打开时部分手机会禁用本地存储，功能会失效。
echo.
echo   按 Ctrl+C 停止服务。
echo ============================================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
  echo 正在用 Python 启动...
  python -m http.server 8080 --bind 0.0.0.0
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo 正在用 Python Launcher 启动...
  py -m http.server 8080 --bind 0.0.0.0
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  echo 正在用 Node 启动...
  npx --yes serve -l 8080 .
  goto :eof
)

echo 未找到 Python 或 Node.js。
echo 请任选其一安装后重新运行本脚本：
echo   Python  https://www.python.org/downloads/
echo   Node.js https://nodejs.org/
echo.
pause
endlocal
