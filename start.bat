@echo off
title JT-Meet Platform
echo ====================================================
echo      Lancement de JT-Meet (Plateforme & API)
echo ====================================================
cd /d "%~dp0backend"
echo Demarrage du serveur sur http://localhost:5000 ...
start http://localhost:5000
node src/server.js
pause
