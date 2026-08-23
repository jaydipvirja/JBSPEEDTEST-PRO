@echo off
title SpeedTest Pro - Push to GitHub
color 0A
cls

echo ================================================================
echo       PUSHING SPEEDTEST PRO TO GITHUB (jaydipvirja)
echo ================================================================
echo.
echo Connecting to: https://github.com/jaydipvirja/JBSPEEDTEST-PRO.git
echo.

git branch -M main
git push -u origin main

echo.
echo ================================================================
echo  If Git asks to sign in, click "Sign in with your browser"!
echo ================================================================
echo.
pause
