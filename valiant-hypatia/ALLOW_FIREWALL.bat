@echo off
title SpeedTest Pro - Firewall Permission Helper
color 0E
cls

echo ================================================================
echo      SPEEDTEST PRO - WINDOWS FIREWALL PERMISSION HELPER
echo ================================================================
echo.
echo Requesting Administrator privileges to allow Port 8000 ^& 3000...
echo.

:: Check for Administrator permissions
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run_firewall_rules
) else (
    echo Elevating to Administrator...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:run_firewall_rules
cls
color 0A
echo ================================================================
echo        ADDING INBOUND FIREWALL RULES (ALLOW ACCESS)
echo ================================================================
echo.

echo [1/2] Allowing Port 8000 for Mobile / LAN access...
netsh advfirewall firewall add rule name="SpeedTestPro_Port_8000" dir=in action=allow protocol=TCP localport=8000 profile=any >nul 2>&1

echo [2/2] Allowing Port 3000 for Mobile / LAN access...
netsh advfirewall firewall add rule name="SpeedTestPro_Port_3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1

echo.
echo ================================================================
echo  SUCCESS! Windows Firewall has unlocked Port 8000 and 3000!
echo ================================================================
echo.
echo  Now your Mobile and other PCs will easily connect!
echo.
pause
