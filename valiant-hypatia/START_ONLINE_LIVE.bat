@echo off
title SpeedTest Pro - Live Online Link Launcher
color 0B
cls

set PORT=8000

echo ================================================================
echo         SPEEDTEST PRO - LIVE ONLINE CLOUD LAUNCHER
echo ================================================================
echo.
echo [1/3] Freeing Port %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo [2/3] Starting SpeedTest Pro backend...
start /B node server.js

timeout /t 2 /nobreak >nul

echo [3/3] Launching Public Online HTTPS Tunnel...
start /B npx --yes localtunnel --port 8000

timeout /t 3 /nobreak >nul

cls
color 0A
echo ================================================================
echo               🚀 SPEEDTEST PRO IS LIVE ONLINE!
echo ================================================================
echo.
echo  🌐 LIVE ONLINE HTTPS LINK (આ લિંક મોબાઈલમાં ખોલો):
echo  👉 https://smooth-boxes-serve.loca.lt
echo.
echo  🔑 Password (જો માંગે તો): 103.125.75.24
echo.
echo ----------------------------------------------------------------
echo  📱 MOBILE USAGE:
echo  1. Open Chrome or Safari on your phone.
echo  2. Open: https://smooth-boxes-serve.loca.lt
echo  3. Click "Submit" (if password requested: 103.125.75.24)
echo ================================================================
echo.
echo  [Keep this window open while using]
echo.

cmd /k
