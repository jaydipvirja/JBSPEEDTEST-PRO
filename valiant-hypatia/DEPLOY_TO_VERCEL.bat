@echo off
title SpeedTest Pro - Deploy to Free Cloud (Vercel)
color 0B
cls

echo ================================================================
echo         SPEEDTEST PRO - FREE CLOUD DEPLOYMENT (VERCEL)
echo ================================================================
echo.
echo  This tool will deploy your SpeedTest app online for FREE!
echo.
echo  After deployment:
echo  - You will get a permanent public link (e.g. https://yoursite.vercel.app)
echo  - You can open it on any mobile/PC anywhere without typing any IP!
echo.
echo ================================================================
echo.
echo Starting Vercel deployment...
echo.

npx vercel --prod

echo.
echo ================================================================
echo  If asked to log in, follow the quick on-screen prompt in browser.
echo ================================================================
pause
