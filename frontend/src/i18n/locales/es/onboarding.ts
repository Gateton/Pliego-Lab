/**
 * First-run wizard, interface tour, help menu and first steps.
 *
 * Keys are English and camelCase; only the values are translated. Add keys here and to the English
 * file in the same commit: the guard fails on a catalog that is out of sync.
 */
export const onboarding = {
  /** Name of the first-run setup screen, used by the dialog itself and by every way back into it. */
  initialSetup: "Configuración inicial",
  /** "Paso N de M" counter, shared by the wizard rail and the guide card. */
  progress: "Paso {current} de {total}",
  /** Footer navigation, shared by the wizard and the guide. */
  nav: {
    previous: "Anterior",
    next: "Siguiente",
    done: "Listo",
  },

  wizard: {
    brandTagline: "primer arranque",
    railNote: "Todo esto se puede cambiar después desde Configuración. Si querés cortar, salteá: la app funciona igual.",
    /** Name of the preset the model step creates on a fresh install. */
    defaultPresetName: "Default",
    stepLabels: {
      language: "Idioma",
      sillyTavern: "SillyTavern",
      welcome: "Qué es esto",
      provider: "Proveedor y API key",
      model: "Modelo",
      theme: "Tema",
      persona: "Vos en la historia",
      character: "Primer personaje",
      done: "Listo",
    },
    language: {
      title: "Elegí tu idioma",
      lead: "Podés cambiarlo después desde Configuración. La elección se aplica inmediatamente.",
      groupLabel: "Idioma de la interfaz",
      option: {
        es: "Interfaz en español",
        en: "Interface in English",
      },
    },
    sillyTavern: {
      title: "¿Venís de SillyTavern?",
      lead: "Podés traer tus personajes, presets, personas y lorebooks antes de configurar el resto de Pliego Lab.",
      import: {
        title: "Importar mi configuración de SillyTavern",
        body: "Elegí tu carpeta de SillyTavern, revisá lo encontrado y seleccioná exactamente qué querés traer.",
      },
      skip: {
        title: "Estoy empezando de cero",
        body: "Continuá sin importar nada. Podés usar el importador después desde Configuración.",
      },
    },
    errors: {
      demoCardRead: "No se pudo leer la card de ejemplo.",
      demoCardImport: "No se pudo importar la card de ejemplo.",
      cardImport: "No se pudo importar la card.",
    },
    providersLoading: "Cargando proveedores…",
    welcome: {
      title: "Bienvenido a tu laboratorio de historias",
      lead: "Esto corre en tu máquina: personajes, chats, imágenes y memoria viven en archivos de tu disco. Para que el modelo responda necesitás una API key de algún proveedor, y el resto es opcional. Vamos a dejarlo andando en un minuto.",
      featuresTitle: "Lo que vas a poder hacer",
    },
    provider: {
      title: "Tu proveedor de IA",
      lead: "El proveedor es el que genera todo: las respuestas, las imágenes por tags, los NPCs y la memoria. Las API keys se guardan solo en el backend, en tu disco, y nunca vuelven al navegador.",
      hint: "Probá la conexión antes de seguir: si responde, estamos listos. Usá un modelo barato para la prueba, es un mensaje corto.",
      keyLink: "Sacar una API key de {provider}",
      noKeyNeeded: "{provider} no necesita key: apuntá la Base URL a tu servidor y listo.",
      keyReady: "Ya hay una key configurada para {provider}. Podés seguir.",
    },
    model: {
      title: "Elegí el modelo",
      lead: "El modelo vive en el preset activo, junto con la temperatura y el contexto. Podés cambiarlo cuando quieras desde Presets; acá alcanza con elegir uno para empezar.",
      fieldWithPreset: "Modelo del preset «{preset}»",
      field: "Modelo",
      hint: "Buscá por nombre o pegá el ID exacto y apretá Enter.",
      placeholder: "Buscar modelo…",
      noPresets: "Esta instalación todavía no tiene presets. Elegí un modelo acá y creamos el primero, ya activado.",
      noModelList: "Este proveedor no publica su lista de modelos: escribí el ID a mano y apretá Enter.",
    },
    theme: {
      title: "Elegí tu tema",
      lead: "Se aplica al instante y lo podés cambiar cuando quieras desde Configuración. Todo el asistente se ve con el tema que elijas.",
    },
    persona: {
      title: "Quién sos en la historia",
      leadPrefix: "La persona reemplaza a",
      leadSuffix: "en todos los prompts: es el nombre con el que el personaje te habla. Podés tener varias y cambiar de persona en cada chat.",
      /** Base form plus the plural variants the runtime picks with `count`. */
      existing: "Ya tenés {count} personas. Si preferís, salteá este paso.",
      existing_one: "Ya tenés una persona. Si preferís, salteá este paso.",
      existing_other: "Ya tenés {count} personas. Si preferís, salteá este paso.",
      saved: "Listo: es tu persona por defecto.",
      name: "Tu nombre",
      namePlaceholder: "Como querés que te llamen",
      description: "Descripción",
      descriptionHint: "Opcional: quién sos, qué hacés, cómo te ven los demás.",
      descriptionPlaceholder: "Opcional",
      save: "Guardar persona",
      saving: "Guardando…",
    },
    character: {
      title: "Tu primer personaje",
      lead: "Sin personaje no hay historia. Elegí el camino que te quede más cómodo, o salteá y hacelo después desde la biblioteca.",
      demo: {
        title: "Usar el personaje de ejemplo",
        body: "Vera, la cronista del faro. Listo para chatear en un click, y lo podés borrar después.",
      },
      importCard: {
        title: "Importar una card",
        body: "PNG de SillyTavern (el personaje viaja dentro de la imagen) o un JSON suelto.",
      },
      create: {
        title: "Crear desde cero",
        body: "Abre el editor de cards y lo armás campo por campo, con ayuda de IA si querés.",
      },
      fromSillyTavern: {
        title: "Traer de SillyTavern",
        body: "Apunta a tu carpeta de SillyTavern y elegí qué personajes, presets y personas copiar.",
      },
      importing: "Importando…",
      imported: "{name} ya está en tu biblioteca.",
      alreadyHave: "Ya tenés personajes en la biblioteca.",
    },
    done: {
      title: "Todo listo",
      lead: "Esto es lo que quedó configurado. Ahora te puedo mostrar la pantalla principal botón por botón, o dejarte explorar.",
      provider: "Proveedor",
      providerNoKey: " (sin key)",
      model: "Modelo",
      persona: "Persona",
      personaNone: "Sin crear",
      characters: "Personajes",
      charactersNone: "Todavía ninguno",
      charactersCount: "{count} en la biblioteca",
      startTour: "Hacer el recorrido",
      explore: "Empezar a explorar",
    },
    skip: "Saltear configuración",
    finishWithTour: "Terminar y ver la guía",
  },

  /** "Lo que vas a poder hacer" list: the same entries feed the help menu. */
  features: {
    characters: {
      name: "Personajes",
      blurb: "Cards V2: crear, importar PNG o JSON, editar y marcar favoritos.",
    },
    presets: {
      name: "Presets",
      blurb: "Modelo, sampling, contexto y razonamiento. El proveedor y su API key viven acá.",
    },
    personas: {
      name: "Personas",
      blurb: "Quién sos vos en la historia. Reemplaza a {{user}} en todos los prompts.",
    },
    lorebooks: {
      name: "Lorebooks",
      blurb: "World info con palabras clave, presupuesto de tokens e inspector de activación.",
    },
    director: {
      name: "Director",
      blurb: "Decide dónde va cada imagen y con qué tags, leyendo la prosa generada.",
    },
    comfyInject: {
      name: "ComfyInject",
      blurb: "Genera las imágenes contra tu ComfyUI local: workflow, checkpoint y LoRAs.",
      requires: "Necesita ComfyUI corriendo en tu máquina.",
    },
    recast: {
      name: "Recast",
      blurb: "Reescribe la prosa en varias pasadas, con diff palabra por palabra antes de aplicar.",
    },
    estudio: {
      name: "Estudio",
      blurb: "Packs de reglas opcionales que se suman al prompt, más el diálogo coloreado.",
    },
    gatetonRp: {
      name: "Gateton RP",
      blurb: "Módulos de juego: mente, pluma, mundo, combate, inventario, diario y más.",
    },
    npc: {
      name: "NPC Tracker",
      blurb: "Detecta personajes secundarios y les arma ficha, retrato y relación con vos.",
    },
    memory: {
      name: "Memoria Viva",
      blurb: "Canon, hilos abiertos y aviso cuando una respuesta se contradice. Experimental.",
    },
    gallery: {
      name: "Galería e imágenes",
      blurb: "Todo lo generado en el chat, con tags y seed para regenerar.",
    },
    usage: {
      name: "Uso y costos",
      blurb: "Tokens y costo real por mensaje, chat y modelo. Solo con OpenRouter.",
    },
    importSt: {
      name: "Importar de SillyTavern",
      blurb: "Trae personajes, presets y personas de tu instalación, eligiendo qué copiar.",
    },
    themes: {
      name: "Temas",
      blurb: "Seis atmósferas para la interfaz, incluido un modo claro para leer de día.",
    },
    guide: {
      name: "Guía y ayuda",
      blurb: "El recorrido por la interfaz y los atajos, siempre a un click.",
    },
  },

  /** "?" menu: ways back into the guide and the setup, plus the composer shortcuts. */
  help: {
    /** Keyboard keys: the name is the same in every language, so they never get "translated". */
    keys: {
      enter: "Enter",
      shiftEnter: "Shift+Enter",
      escape: "Esc",
    },
    openGuide: "Ver la guía de la interfaz",
    openGuideHint: "Recorrido por cada botón de la pantalla principal.",
    openWizardHint: "Proveedor, API key, tema y persona otra vez.",
    shortcuts: {
      title: "Atajos",
      send: "envía ·",
      lineBreak: "salto de línea",
      mention: "menciona un NPC del chat",
      closePanel: "cierra el panel abierto",
    },
  },

  /** Configuración → Guía. The permanent way back into the first-run onboarding. */
  guide: {
    title: "Guía y primeros pasos",
    description:
      "El recorrido por la interfaz se muestra una sola vez, en el primer arranque. Desde acá podés repetirlo, o volver a pasar por la configuración inicial si cambiaste de proveedor o de tema.",
    open: "Ver la guía de la interfaz",
    repeatSetup: "Repetir la configuración inicial",
    hintPrefix: "El botón",
    hintSuffix: "de la barra superior abre lo mismo en cualquier momento, junto con los atajos del compositor.",
  },

  /** Progress checklist for a fresh install, rendered in the empty chat. */
  firstSteps: {
    title: "Primeros pasos",
    provider: {
      label: "Configurar tu proveedor y probar la conexión",
      action: "Configurar",
    },
    persona: {
      label: "Decir quién sos en la historia",
      action: "Crear persona",
    },
    character: {
      label: "Traer o crear un personaje",
      action: "Ver biblioteca",
    },
    chat: {
      label: "Abrir tu primer chat",
      action: "Elegir personaje",
    },
  },

  /** First-run guide script. */
  tour: {
    ariaLabel: "Guía: {title}",
    live: "Paso {current} de {total}: {title}",
    skip: "Saltear guía",
    steps: {
      welcome: {
        title: "Bienvenido a Pliego Lab",
        body:
          "Este es tu laboratorio de historias: un frontend de rol que corre en tu máquina, con personajes, memoria e imágenes propias. En un minuto te muestro para qué sirve cada cosa, y podés cortar cuando quieras.",
      },
      brand: {
        title: "Tu estudio",
        body:
          "Todo vive local: personajes, chats y configuración son archivos en tu disco, dentro de la carpeta del proyecto. Lo único que sale a internet es lo que el modelo necesita para responder.",
      },
      topbar: {
        title: "Las herramientas",
        body:
          "Cada botón de esta fila abre un panel a pantalla completa. Nada de esto hace falta para chatear: son las piezas que tocás cuando querés afinar cómo responde el modelo, cómo se ve la escena o qué recuerda la historia.",
      },
      library: {
        title: "Tu biblioteca",
        body: "Acá viven tus personajes, y todo empieza acá.",
        bullet1: "Click en una card la abre y te muestra sus chats.",
        bullet2: "La estrella la marca como favorita y la sube en la lista.",
        bullet3: "El número en el borde dice cuántos chats tenés con ese personaje.",
      },
      libraryEmpty: {
        title: "Primero, un personaje",
        body:
          "Todavía no tenés ninguno. Con Nuevo lo creás desde cero; con PNG importás una card V2 exportada de SillyTavern (el personaje viaja dentro de la imagen) y con JSON una card suelta.",
      },
      libraryActions: {
        title: "Sumar personajes",
        body:
          "Nuevo crea uno desde cero, PNG importa una card V2 (el personaje viaja dentro de la imagen) y JSON una card suelta. Arriba tenés el buscador y el filtro de favoritos.",
      },
      responsePanel: {
        title: "Panel de Respuesta",
        body:
          "Es el constructor del prompt que ve el modelo: el preset activo, el idioma de salida forzado, cuánto contexto entra por turno y los bloques de prompt en el orden en que se envían.",
        bullet1: "Streaming y diálogo coloreado se prenden y se apagan acá.",
        bullet2:
          "En los bloques, system y top van antes de la conversación; in-chat entra por profundidad y post-history va al final.",
      },
      comfyInjectTab: {
        title: "ComfyInject acá mismo",
        body:
          "Si estás generando imágenes, tus ajustes de ComfyInject (workflow, checkpoint, estilos, LoRAs, resoluciones) aparecen en esta pestaña, sin abrir el panel grande.",
      },
      chatHeader: {
        title: "La escena",
        body:
          "Arriba de todo: quién es el personaje y el botón para editar su card al vuelo. A la derecha está todo lo de este chat.",
      },
      chatEmpty: {
        title: "Tu mesa de trabajo",
        body:
          "Cuando abras un chat, en el centro aparece la escena arriba, el hilo en el medio y el compositor abajo. Ahora mismo está vacío porque todavía no elegiste con quién jugar: tocá una card de la biblioteca y después el + para empezar.",
      },
      chatThread: {
        title: "La conversación",
        body:
          "Debajo de cada respuesta tenés las acciones: swipes para leer alternativas, regenerar, continuar, editar, borrar y pedir imágenes. Si el Director está activo, las imágenes aparecen solas en la narración.",
      },
      viewMenu: {
        title: "Opciones de la vista",
        body:
          "Este menú ajusta cómo leés y con quién jugás: tamaño de letra, tamaño de las imágenes, densidad, la persona de este chat y su lorebook. También abre la galería de todo lo generado y las variables del chat.",
      },
      chatButtons: {
        title: "El elenco y el estado",
        body:
          "Al lado del menú tenés tres cosas del chat: NPCs (los secundarios que detectó el tracker), Estado (los datos visuales que mantiene el Director para que la ropa y el aspecto no cambien de imagen en imagen) y Memoria (el canon y los hilos abiertos).",
      },
      composer: {
        title: "Escribí acá",
        body: "Enter envía y Shift+Enter hace un salto de línea.",
        bullet1:
          "Escribís como vos, o cambiás a \"Como {personaje}\" para hablar en su voz y dejar que el modelo siga desde ahí.",
        bullet2:
          "Con @ mencionás NPCs del chat; con / aparecen los comandos (por ahora /img, para pedir una imagen de reacción de un NPC).",
        bullet3: "Instantánea genera una imagen de lo que está haciendo un NPC ahora mismo.",
      },
      presets: {
        title: "Presets",
        body:
          "Cómo responde el modelo: temperatura, muestreo, penalizaciones, tokens máximos, cuánto contexto entra por turno y si te devuelve el razonamiento. En la pestaña Proveedor configurás la API key, la Base URL y probás la conexión.",
      },
      personas: {
        title: "Personas",
        body:
          "Quién sos vos en la historia: nombre, descripción y avatar. Reemplaza a {{user}} en todos los prompts, y podés tener varias para elegir una distinta en cada chat.",
      },
      lorebooks: {
        title: "Lorebooks",
        body:
          "World info: entradas con palabras clave que se inyectan solas cuando el tema aparece en la conversación, con presupuesto de tokens y un inspector que te muestra qué se activó y por qué.",
      },
      characterCreator: {
        title: "Crear personaje",
        body:
          "Arma una card desde cero, campo por campo, y también puede generarla con IA a partir de una idea. Descripción, personalidad, escenario, diálogos de ejemplo, primer mensaje y retrato.",
      },
      director: {
        title: "Director",
        body:
          "Lee la prosa que escribió el modelo y decide dónde va una imagen y con qué tags. Vos no escribís prompts de imagen: la narración los genera.",
      },
      comfyInject: {
        title: "ComfyInject",
        body:
          "Es el que dibuja de verdad: agarra los marcadores de imagen y los manda a tu ComfyUI local con tu checkpoint, tu workflow y tus LoRAs. Necesita ComfyUI corriendo en tu máquina; si lo activás, acá se configuran el host, el workflow y las resoluciones. Este panel es extenso y va a tener su propia guía.",
      },
      estudio: {
        title: "Estudio",
        body:
          "Packs de reglas opcionales que se suman al prompt, y cómo se renderiza el diálogo coloreado. Son reglas de juego que no dependen del personaje, así que las prendés y las apagás por historia.",
      },
      gatetonRp: {
        title: "Gateton RP",
        body:
          "El sistema de juego: módulos que activás o desactivás (mente, estilo de pluma, mundo, lore, personajes, combate, defensa, inventario, diario, exploración, director). Si lo dejás vacío, el chat funciona igual: esto es para campañas con estado.",
      },
      recast: {
        title: "Recast",
        body:
          "Post-procesado en varias pasadas: reescribe la prosa con el estilo que le pidas sin tocar diálogos ni marcadores de imagen. Antes de aplicar te muestra un diff palabra por palabra para aceptar o rechazar.",
      },
      npc: {
        title: "NPC Tracker",
        body:
          "Detecta los personajes secundarios que aparecen en la historia y les arma una ficha: retrato, rasgos, relación con vos y estado. Se actualizan solos después de cada respuesta.",
      },
      usage: {
        title: "Uso y costos",
        body:
          "Cuánto gastaste de verdad: tokens y costo por mensaje, por chat y por modelo. Solo aparece con OpenRouter, que es el único proveedor que publica precios.",
      },
      moreMenu: {
        title: "¿Traés lo que ya tenés?",
        body:
          "Si venís de SillyTavern, no empieces de cero: desde acá se importan personajes, presets y personas eligiendo puntualmente qué traer.",
        importNow: "Importar ahora",
        later: "Después",
      },
      settings: {
        title: "Y la configuración general",
        body:
          "Acá están los temas de la interfaz, el resumen de Memoria Viva y los botones para volver a ver esta guía o repetir la configuración inicial cuando quieras.",
      },
      done: {
        title: "Eso es todo",
        body:
          "Elegí un personaje de la biblioteca y empezá a escribir. Si te perdés, el botón ? de la barra de arriba tiene la guía, los atajos y la configuración inicial otra vez.",
        startWriting: "Empezar a escribir",
      },
    },
  },
};
