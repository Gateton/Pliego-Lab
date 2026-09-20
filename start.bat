@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==============================================
echo   Pliego Lab
echo ==============================================
echo.

rem 1) Node.js instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [X] Node.js no esta instalado.
  echo     Instalalo desde https://nodejs.org ^(version 20 o superior^) y volve a correr este archivo.
  pause
  exit /b 1
)
echo [OK] Node.js disponible

rem 2) Configuracion opcional del proveedor
if not exist backend\.env (
  echo [!] No existe backend\.env
  echo     Podes configurar un proveedor desde Presets ^> Proveedor despues de abrir Pliego Lab.
  echo     Para OpenRouter por entorno: copia backend\.env.example a backend\.env y completa la key.
) else (
  echo [OK] backend\.env encontrado
)

rem 3) Dependencias (solo la primera vez)
if not exist backend\node_modules (
  echo ==^> Instalando dependencias del backend ^(primera vez^)...
  cd backend && call npm install --silent && cd ..
)
if not exist frontend\node_modules (
  echo ==^> Instalando dependencias del frontend ^(primera vez^)...
  cd frontend && call npm install --silent && cd ..
)

rem 4) Compilar backend + frontend
echo ==^> Compilando backend...
cd backend && call npm run build && cd ..
echo ==^> Compilando frontend...
cd frontend && call npm run build && cd ..

rem 5) Abrir navegador y levantar el servidor (frontend + API en un solo puerto)
echo.
echo [OK] Levantando en http://localhost:3001 ...
start "" http://localhost:3001
cd backend && node dist\index.js
