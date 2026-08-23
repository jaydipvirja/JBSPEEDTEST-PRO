@echo off
title SpeedTest Pro (Port 8080)
color 0B
cls

set PORT=8080
set TARGET_IP=192.168.1.115
set CUSTOM_IP=192.168.1.115

echo ================================================================
echo          SPEEDTEST PRO - SECOND LAUNCHER (PORT 8080)
echo ================================================================
echo.
echo [1/2] Starting SpeedTest Server on %TARGET_IP%:%PORT%...
start /B node server.js

timeout /t 2 /nobreak >nul

echo [2/2] Opening Dashboard on Port 8080...
start http://localhost:8080

cls
color 0A
echo ================================================================
echo         🚀 SPEEDTEST PRO (PORT 8080) IS RUNNING LIVE!
echo ================================================================
echo.
echo  💻 THIS PC URL         :  http://localhost:8080
echo  📱 MOBILE / OTHER PC   :  http://192.168.1.115:8080
echo.
echo ----------------------------------------------------------------
echo  💡 MOBILE / OTHER SYSTEM STEPS:
echo  1. Connect your Mobile to the SAME Wi-Fi router.
echo  2. Open Chrome or Safari.
echo  3. Enter URL: http://192.168.1.115:8080
echo ================================================================
echo.
echo  [Keep this window open while using SpeedTest]
echo  [Press Ctrl + C or Close this window to STOP]
echo.

cmd /k
