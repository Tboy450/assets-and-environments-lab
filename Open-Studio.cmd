@echo off
powershell.exe -NoProfile -File "%~dp0Launch-Studio.ps1"
start "" "http://127.0.0.1:4193/"
