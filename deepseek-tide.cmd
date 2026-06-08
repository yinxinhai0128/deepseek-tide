@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\codewhale.ps1" %*
exit /b %ERRORLEVEL%
