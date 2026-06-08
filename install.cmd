@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-codewhale.ps1" -Configure
exit /b %ERRORLEVEL%
