@echo off
title SpeedTest Pro Launcher (192.168.1.115:8000)
color 0B
cls

set PORT=8000
set TARGET_IP=192.168.1.115
set CUSTOM_IP=192.168.1.115

echo ================================================================
echo               SPEEDTEST PRO - PC ^& MOBILE LAUNCHER
echo ================================================================
echo.
echo [1/3] Checking and freeing Port %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

echo [2/3] Starting SpeedTest Server on %TARGET_IP%:%PORT%...
start /B node server.js

timeout /t 2 /nobreak >nul

echo [3/3] Opening Dashboard in your browser...
start http://localhost:%PORT%

cls
color 0A
echo ================================================================
echo               🚀 SPEEDTEST PRO IS RUNNING LIVE!
echo ================================================================
echo.
echo  💻 THIS PC URL         :  http://localhost:%PORT%
echo  📱 MOBILE / OTHER PC   :  http://192.168.1.115:%PORT%
echo.
echo ----------------------------------------------------------------
echo  💡 INSTRUCTIONS FOR MOBILE / OTHER SYSTEM:
echo  1. Connect your Mobile to the SAME Wi-Fi router.
echo  2. Open Chrome or Safari.
echo  3. Enter this EXACT URL: http://192.168.1.115:%PORT%
echo ================================================================
echo.
echo  [Keep this window open while using SpeedTest]
echo  [Press Ctrl + C or Close this window to STOP]
echo.

cmd /k
