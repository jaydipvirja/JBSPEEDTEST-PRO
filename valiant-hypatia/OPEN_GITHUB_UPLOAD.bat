@echo off
title SpeedTest Pro - Instant GitHub Upload Helper
color 0A
cls

echo ================================================================
echo       SPEEDTEST PRO - INSTANT GITHUB WEB UPLOAD HELPER
echo ================================================================
echo.
echo  Opening GitHub Upload page in your browser...
echo  Opening project folder in File Explorer...
echo.
echo  STEPS:
echo  1. Select the files in the opened folder (Ctrl + A).
echo  2. Drag and drop them into the GitHub browser window.
echo  3. Click the green "Commit changes" button at the bottom!
echo ================================================================
echo.

start https://github.com/jaydipvirja/JBSPEEDTEST-PRO/upload/main
timeout /t 2 /nobreak >nul
explorer.exe /select,"c:\Users\pc\Documents\antigravity\valiant-hypatia\index.html"

pause
