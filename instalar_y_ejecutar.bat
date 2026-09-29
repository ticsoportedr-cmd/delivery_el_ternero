@echo off
chcp 65001 >nul
title EL TERNERO - Servidor local
cd /d "%~dp0"
echo ============================================
echo   EL TERNERO - Instalacion y arranque
echo   Carpeta: %CD%
echo ============================================

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado. Descargar LTS desde https://nodejs.org
  echo NODE_NO_INSTALADO> instalacion.log
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo Node: %%v
where git >nul 2>&1 && (for /f "delims=" %%v in ('git --version') do echo %%v) || echo [AVISO] Git no esta instalado - necesario para GitHub

rem --- Seguridad: solo ejecutar dentro de la carpeta propia de EL TERNERO ---
if not exist delivery_el_ternero.zip if not exist package.json goto :carpeta_incorrecta
if not exist package.json (
  echo Descomprimiendo proyecto...
  powershell -NoProfile -Command "Expand-Archive -Path 'delivery_el_ternero.zip' -DestinationPath '.' -Force"
)
findstr /C:"delivery-el-ternero" package.json >nul 2>&1 || goto :carpeta_incorrecta

if not exist .env (
  copy .env.example .env >nul
  echo Se creo el archivo .env - completar VITE_GOOGLE_MAPS_API_KEY para ver el mapa
)

netstat -ano | findstr /R /C:":3200 .*LISTENING" >nul && (
  echo [AVISO] El puerto 3200 ya esta en uso. Cerrar la otra ventana del servidor o cambiar PORT en .env
)

echo.
echo Instalando dependencias (puede tardar unos minutos)...
call npm install > instalacion.log 2>&1
if errorlevel 1 (
  echo [ERROR] Fallo la instalacion. Ver instalacion.log
  pause
  exit /b 1
)
echo Dependencias instaladas.

echo.
echo Arrancando servidor en http://localhost:3200
echo NO CERRAR ESTA VENTANA mientras se usa el sistema. Para detener: Ctrl+C
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3200"
call npm run dev > servidor.log 2>&1
echo El servidor se detuvo. Ver servidor.log
pause
exit /b 0

:carpeta_incorrecta
echo.
echo [DETENIDO] Esta carpeta no es la del proyecto EL TERNERO.
echo Ejecutar este archivo SOLO desde: Documentos\Proyectos\delivery_el_ternero
echo No se instalo nada.
pause
exit /b 1
