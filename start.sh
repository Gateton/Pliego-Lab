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

# Puerto efectivo, con el mismo orden que el backend: variable de entorno > backend/.env > 3001.
ENV_PORT="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' backend/.env 2>/dev/null | tail -n 1 | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-${ENV_PORT:-3001}}"

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

# 5) Detener una instancia previa que todavía tenga tomado el puerto. Sin esto, el server nuevo
#    no puede arrancar y el navegador sigue hablando con el viejo (que puede estar usando otra
#    carpeta de datos, p. ej. la del repo en lugar de PLIEGO_DATA_DIR).
listening_pid() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v p=":${PORT}$" '$4 ~ p' | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1
  fi
}

stop_previous_instance() {
  local pid cmd
  pid="$(listening_pid)"
  [ -n "$pid" ] || return 0

  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  if ! printf '%s' "$cmd" | grep -q "dist/index.js"; then
    echo -e "${YELLOW}⚠ El puerto ${PORT} está ocupado por otro proceso:${NC}"
    echo "    ${cmd}"
    echo "  No lo toco. Cerralo o cambiá PORT en backend/.env."
    exit 1
  fi

  echo -e "${YELLOW}⚠ Ya había una instancia de Pliego Lab corriendo (pid ${pid}); la detengo...${NC}"
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "  No respondió al cierre amable; la fuerzo."
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.5
  fi
}

stop_previous_instance

# 6) Abrir el navegador apenas el servidor esté listo (en segundo plano, sin bloquear)
(
  for _ in $(seq 1 30); do
    curl -s "http://localhost:${PORT}/api/settings" >/dev/null 2>&1 && break
    sleep 0.5
  done
  xdg-open "http://localhost:${PORT}" >/dev/null 2>&1 || true
) &

echo ""
echo -e "${GREEN}==> Levantando en http://localhost:${PORT}  (Ctrl+C para salir)${NC}"

# 7) Servidor en primer plano — logs visibles en esta consola, Ctrl+C lo detiene
cd backend
node dist/index.js
