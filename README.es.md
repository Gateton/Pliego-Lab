<p align="center">
  <img src="frontend/public/logo.png" alt="Pliego Lab" width="200" />
</p>

<h1 align="center">Pliego Lab</h1>

<p align="center"><strong>Un espacio local para crear historias interactivas.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://github.com/Gateton/Pliego-Lab/actions/workflows/ci.yml"><img src="https://github.com/Gateton/Pliego-Lab/actions/workflows/ci.yml/badge.svg" alt="Estado de CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Licencia Apache 2.0" /></a>
  <img src="https://img.shields.io/badge/status-desarrollo%20temprano-orange.svg" alt="Desarrollo temprano" />
</p>

> Software en etapa temprana. Hay áreas incompletas y pueden existir cambios incompatibles mientras el proyecto evoluciona.

## Capturas de pantalla

<p align="center">
  <img src="docs/screenshots/Home-example.png" alt="Pantalla principal de Pliego Lab" width="48%" />
  <img src="docs/screenshots/Chat-with-image-example.png" alt="Chat de Pliego Lab con una imagen generada" width="48%" />
</p>

<p align="center">
  <img src="docs/screenshots/Character-creator-example.png" alt="Creador de personajes de Pliego Lab" width="48%" />
  <img src="docs/screenshots/living-memory-example.png" alt="Espacio de Memoria Viva de Pliego Lab" width="48%" />
</p>

Estas capturas muestran el espacio principal, un chat con imagen, la creación de personajes y las herramientas de continuidad narrativa. Las mejores diferencias de Pliego Lab aparecen destacadas abajo para mostrar las partes que van más allá de un frontend de chat convencional.

## ¿Qué es Pliego Lab?

Pliego Lab es una aplicación web local y de un solo usuario para roleplay y ficción interactiva. Reúne personajes, personas, lore, control de prompts, herramientas de continuidad, generación opcional de imágenes y múltiples proveedores LLM en un único espacio de trabajo.

Tus chats y configuraciones permanecen en tu máquina por defecto. Al generar una respuesta, los prompts y el contexto seleccionado para esa solicitud se envían al proveedor que configures. Pliego Lab no necesita SillyTavern para funcionar, pero permite importar de forma práctica formatos de SillyTavern para traer personajes y contenido relacionado.

## ¿Por qué Pliego Lab?

La mayoría de los frontends de chat se limitan a generar una respuesta. Pliego Lab trata cada escena como un estado narrativo y visual vivo:

- **Director** decide cuándo la prosa necesita una imagen y convierte el momento en un prompt visual estructurado.
- **NPC Tracker** recuerda a los personajes secundarios recurrentes como dossiers editables, en lugar de tratarlos como contexto descartable.
- **Estado Visual Persistente** conserva atuendos y condiciones físicas duraderas entre generaciones.
- **ComfyInject** renderiza la escena resultante mediante workflows locales de ComfyUI.

Juntas, estas funciones conectan el contexto narrativo, la continuidad del elenco y la generación de imágenes en un único espacio de trabajo local.

## Qué incluye

### Espacio narrativo

- Cards de personajes, personas, chats, ramas, swipes, regeneración, edición y continuación.
- Lorebooks y world info para enriquecer los prompts.
- Seguimiento de NPCs y herramientas para construir escenas.
- Memoria Viva para continuidad narrativa experimental y seguimiento del canon.

<p align="center">
  <img src="docs/screenshots/living-memory-example.png" alt="Espacio de Memoria Viva de Pliego Lab" width="900" />
</p>

### Control de generación

- Prompt Manager con bloques ordenables, posiciones de inyección, roles y conteo de tokens.
- Presets de respuesta para modelos, sampling, contexto, reasoning y compatibilidad por proveedor.
- Recast para post-procesamiento de prosa en varias pasadas con diffs revisables.
- Proveedores para OpenRouter, OpenAI, Anthropic, Google Gemini, servicios compatibles con OpenAI y endpoints personalizados.

## Funciones destacadas

### Director

**Director** es la capa de dirección visual de Pliego Lab. Un modelo secundario lee la prosa generada, identifica momentos que vale la pena ilustrar e inserta marcadores de imagen estructurados sin obligar al modelo principal del chat a encargarse del prompting visual.

Puede:

- Colocar imágenes en momentos adecuados de la escena y limitar la cantidad por turno.
- Construir prompts estructurados a partir de personajes, personas, NPCs, mensajes recientes e historial visual.
- Conservar anclas de identidad como pelo, ojos, rostro, piel, cuerpo y especie.
- Permitir generación automática, reacciones manuales de NPC mediante `/img`, diagnósticos y cancelación.
- Entregar los marcadores a ComfyInject para renderizarlos mediante workflows locales de ComfyUI.

<p align="center">
  <img src="docs/screenshots/Chat-with-image-example.png" alt="Resultado de Director y ComfyInject en el chat" width="900" />
</p>

### NPC Tracker

**NPC Tracker** convierte a los personajes secundarios recurrentes en un elenco vivo. Detecta NPCs nombrados en la conversación y mantiene un dossier editable para cada uno, en lugar de tratar cada aparición como contexto descartable.

Puede:

- Escanear conversaciones automáticamente, manualmente o con heurísticas locales.
- Registrar apariencia, personalidad, rol, historia, estilo de habla, motivaciones, secretos, manerismos y límites narrativos.
- Evolucionar dossiers con comportamiento append o replace.
- Consolidar campos, regenerar dossiers, marcar NPCs favoritos e importarlos en otros chats.
- Generar retratos de NPC mediante ComfyInject y asociarlos usando nombres o coincidencia de tags.
- Usar campos personalizados reordenables y permitir el seguimiento opcional del personaje principal.

<p align="center">
  <img src="docs/screenshots/npc-tracker.png" alt="Roster y dossiers de NPC Tracker" width="900" />
</p>

### Estado Visual Persistente

**Estado Visual Persistente** mantiene la continuidad visual entre generaciones. Registra el atuendo actual y las condiciones físicas duraderas de cada personaje, y devuelve ese estado al Director para evitar que la ropa, las heridas o el aspecto cambien silenciosamente de una imagen a otra.

Puede:

- Establecer una línea base de vestimenta cuando un personaje aparece por primera vez.
- Detectar cambios de ropa y condiciones duraderas como estar mojado, sucio, herido, golpeado, transpirado o despeinado.
- Eliminar condiciones obsoletas o resueltas en lugar de acumular contradicciones.
- Representar explícitamente estados vestido, desnudo y con vestimenta parcial.
- Evitar que la ropa eliminada reaparezca en los tags generados.
- Ofrecer edición manual, historial con timestamps, eliminación de registros y una auditoría independiente.

<p align="center">
  <img src="docs/screenshots/Persistent-visual-state.png" alt="Panel e historial de Estado Visual Persistente" width="900" />
</p>

### Dirección visual

- ComfyInject convierte marcadores de imagen en generaciones de ComfyUI.
- Configuración de workflows locales, galerías de imágenes y controles de reintento.
- Image Director, NPC Tracker y Estado Visual Persistente funcionan juntos como un pipeline de continuidad visual, no como botones de imagen aislados.

### Compatibilidad e interfaz

- Importación de personajes, presets, personas y lorebooks desde formatos compatibles con SillyTavern.
- Catálogos de interfaz en español e inglés.
- Layout responsive, temas, onboarding y una base mínima para plugins en runtime.
- Funciones opcionales de Estudio para voz narrativa y reglas definidas por el usuario.

Pliego Lab es intencionalmente más pequeño y específico que SillyTavern. No es un fork, no incluye SillyTavern y no busca reproducir su ecosistema de extensiones.

## Requisitos

- Node.js 20 o superior.
- npm.
- Una API key de un proveedor de texto compatible.
- ComfyUI en `http://127.0.0.1:8188` solo si querés usar generación local de imágenes.

## Inicio rápido

### Linux y macOS

```bash
./start.sh
```

### Windows

```bat
start.bat
```

El launcher comprueba Node.js, instala dependencias cuando hace falta, compila el frontend y el backend, inicia la aplicación en `http://localhost:3001` y abre el navegador. Podés configurar los proveedores desde la aplicación o definir antes las variables de entorno del backend.

## Desarrollo

Instalá y ejecutá el backend:

```bash
cd backend
npm install
npm run dev
```

En otra terminal, instalá y ejecutá el frontend:

```bash
cd frontend
npm install
npm run dev
```

El servidor de desarrollo de Vite hace proxy de `/api` hacia el backend local. Para validar los cambios, ejecutá:

```bash
cd backend
npm test
npm run build

cd ../frontend
npm run i18n:check
npm run lint
npm run build
```

El backend escucha en `127.0.0.1` por defecto. No lo expongas directamente a Internet. Si cambiás el host, colocá la aplicación detrás de autenticación, control de acceso y aislamiento de red adecuados.

## Datos y privacidad

Los datos locales se guardan en `backend/data/`, incluidos chats, personajes, personas, presets, lorebooks y settings. Mantené esta carpeta fuera del control de versiones y hacé una copia antes de cambios importantes.

Las credenciales de los proveedores son gestionadas por el backend y no se envían al frontend. Los prompts pueden contener mensajes, datos de personajes, lorebooks o contexto de continuidad según la solicitud. Revisá las políticas de cada proveedor que configures.

Leé [`PRIVACY.md`](PRIVACY.md) para conocer el flujo de datos y [`SECURITY.md`](SECURITY.md) antes de exponer cualquier servicio local.

## Documentación y comunidad

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — desarrollo local y pull requests.
- [`SECURITY.md`](SECURITY.md) — reporte responsable de vulnerabilidades y seguridad.
- [`PRIVACY.md`](PRIVACY.md) — almacenamiento local y flujo de datos externo.
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — dependencias, integraciones y atribuciones.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — normas de convivencia.
- [`docs/COMMUNITY_CONTENT_POLICY.md`](docs/COMMUNITY_CONTENT_POLICY.md) — guía para issues, ejemplos y capturas públicas.
- [`docs/`](docs/) — documentación técnica de diseño e implementación.

Usá GitHub Issues para reportar bugs y proponer funcionalidades. No incluyas API keys, chats privados, imágenes personales ni archivos de `backend/data/` en issues o pull requests.

## Licencia y marca

El código fuente de Pliego Lab está licenciado bajo la [Apache License 2.0](LICENSE). La licencia no autoriza usar el nombre, logo o identidad visual de Pliego Lab para sugerir respaldo o carácter oficial.

Las dependencias de terceros, providers, ComfyUI, modelos, workflows, material importado y contenido creado por usuarios conservan sus propios términos. Consultá [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
