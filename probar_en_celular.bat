@echo off
chcp 65001 >nul
title EL TERNERO - Enlace para celular
cd /d "%~dp0"
echo ============================================
echo   EL TERNERO - Prueba desde el celular
echo ============================================
echo IMPORTANTE: la otra ventana (instalar_y_ejecutar.bat) debe estar abierta.
echo.

findstr /C:"delivery-el-ternero" package.json >nul 2>&1 || goto :carpeta_incorrecta

set "CF="
where cloudflared >nul 2>&1 && set "CF=cloudflared"
if not defined CF if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not defined CF if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"

if not defined CF (
  echo Instalando Cloudflare Tunnel con el instalador oficial de Windows - solo la primera vez.
  echo Si Windows pide permiso, aceptar.
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
  if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
)

echo.
echo SEGURIDAD: cualquiera con el enlace puede entrar. Usar solo datos de prueba
echo y cerrar esta ventana al terminar. Cada vez que se abre, el enlace cambia.
echo.

if defined CF (
  echo Creando enlace seguro... buscar abajo la direccion que termina en .trycloudflare.com
  echo.
  "%CF%" tunnel --no-autoupdate --url http://127.0.0.1:3200 --logfile "%TEMP%\ternero_tunel.log"
  echo.
  echo El enlace de Cloudflare se cerro o fallo. Probando plan B...
)

echo.
echo === PLAN B: enlace con localtunnel ===
echo Aparecera una direccion https://....loca.lt
echo Al abrirla en el celular pide una "Tunnel Password": es esta IP publica:
powershell -NoProfile -Command "(Invoke-WebRequest -UseBasicParsing https://loca.lt/mytunnelpassword).Content"
echo.
call npx --yes localtunnel --port 3200 --local-host 127.0.0.1
pause
exit /b 0

:carpeta_incorrecta
echo [DETENIDO] Ejecutar solo desde la carpeta del proyecto EL TERNERO.
pause
exit /b 1
