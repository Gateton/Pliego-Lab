#!/usr/bin/env bash
set -e

# Si stdout no es una terminal (ej. doble clic desde el gestor de archivos), relanzarse
# dentro de un emulador visible para que veas los logs del server y puedas frenarlo con Ctrl+C.
if [ ! -t 1 ]; then
  SCRIPT="$(readlink -f "$0")"
  for term in ghostty kitty alacritty konsole; do
    if command -v "$term" >/dev/null 2>&1; then
      case "$term" in
        ghostty)   exec ghostty -e bash "$SCRIPT" ;;
        kitty)     exec kitty bash "$SCRIPT" ;;
        alacritty) exec alacritty -e bash "$SCRIPT" ;;
        konsole)   exec konsole -e bash "$SCRIPT" ;;
      esac
    fi
  done
  echo "No se encontró un emulador de terminal. Ejecutá manualmente: bash '$SCRIPT'"
  exit 1
fi

cd "$(dirname "$0")"

GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RED=$'\033[0;31m'
NC=$'\033[0m'

echo "=============================================="
echo "  Pliego Lab"
echo "=============================================="
echo ""

# 1) Node.js instalado y con versión soportada
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}✗ Node.js no está instalado.${NC}"
  echo "  Instalalo desde https://nodejs.org (versión 20 o superior) y volvé a correr este script."
  exit 1
fi
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}✗ Node.js ${NODE_MAJOR} es muy viejo. Se necesita 20 o superior.${NC}"
  echo "  Actualizalo desde https://nodejs.org"
  exit 1
fi
echo -e "✓ Node.js $(node --version)"

# 2) Configuración opcional del proveedor
if [ ! -f backend/.env ]; then
  echo -e "${YELLOW}⚠ No existe backend/.env${NC}"
  echo "  Podés configurar un proveedor desde Presets → Proveedor después de abrir Pliego Lab."
  echo "  Para usar OpenRouter por entorno: cp backend/.env.example backend/.env y completá la key."
else
  echo "✓ backend/.env encontrado"
fi

# 3) Dependencias (solo la primera vez; después arranca al toque)
if [ ! -d backend/node_modules ]; then
  echo "==> Instalando dependencias del backend (primera vez)..."
  (cd backend && npm install --silent)
fi
if [ ! -d frontend/node_modules ]; then
  echo "==> Instalando dependencias del frontend (primera vez)..."
  (cd frontend && npm install --silent)
fi

# 4) Compilar backend + frontend (rápido, garantiza que el servidor sirva lo último)
echo "==> Compilando backend..."
(cd backend && npm run build)
echo "==> Compilando frontend..."
(cd frontend && npm run build)

# 5) Abrir el navegador apenas el servidor esté listo (en segundo plano, sin bloquear)
(
  for _ in $(seq 1 30); do
    curl -s "http://localhost:3001/api/settings" >/dev/null 2>&1 && break
    sleep 0.5
  done
  xdg-open "http://localhost:3001" >/dev/null 2>&1 || true
) &

echo ""
echo -e "${GREEN}==> Levantando en http://localhost:3001  (Ctrl+C para salir)${NC}"

# 6) Servidor en primer plano — logs visibles en esta consola, Ctrl+C lo detiene
cd backend
node dist/index.js
