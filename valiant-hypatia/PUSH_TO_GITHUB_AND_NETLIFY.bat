@echo off
title SpeedTest Pro - Auto Sync to GitHub & Netlify
color 0A
cls

echo ================================================================
echo       AUTO SYNC CODE TO GITHUB ^& NETLIFY LIVE WEBSITE
echo ================================================================
echo.

git status --short

echo.
echo [1/3] Adding all updated code files...
git add .

echo [2/3] Creating automatic update commit...
set /p commitMsg="Enter what you changed (or press Enter for Auto): "
if "%commitMsg%"=="" set commitMsg=Auto update SpeedTest Pro code

git commit -m "%commitMsg%"

echo.
echo [3/3] Pushing to GitHub (Netlify will auto-deploy in 10s)...
git push

echo.
echo ================================================================
echo  ✅ SUCCESS! Code pushed to GitHub!
echo  🚀 Netlify is now automatically updating your live website!
echo ================================================================
echo.
pause
