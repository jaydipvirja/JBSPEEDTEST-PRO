@echo off
title SpeedTest Pro - Make Free Online Mobile App
color 0A
cls

echo ================================================================
echo      SPEEDTEST PRO - 100%% FREE ONLINE 24/7 MOBILE APP
echo ================================================================
echo.
echo  This will create a permanent website for your phone that works
echo  ANYWHERE in the world on 4G / 5G / Wi-Fi (Even when PC is OFF)!
echo.
echo ----------------------------------------------------------------
echo  STEPS:
echo  1. Netlify Drop page is opening in your browser...
echo  2. The 'public' folder will open in File Explorer.
echo  3. Drag and Drop the 'public' folder into the Netlify box!
echo  4. It will give you a permanent link (e.g. https://yoursite.netlify.app)
echo ================================================================
echo.

start https://app.netlify.com/drop
timeout /t 2 /nobreak >nul
explorer.exe "c:\Users\pc\Documents\antigravity\valiant-hypatia"

echo Folder opened! Drag the 'public' folder onto the website!
echo.
pause
