/**
 * English catalog. Same keys as the Spanish one, same structure, different values. Written as
 * neutral international English, not a literal translation of the Spanish.
 */
export const onboarding = {
  /** Name of the first-run setup screen, used by the dialog itself and by every way back into it. */
  initialSetup: "Initial setup",
  /** "Step N of M" counter, shared by the wizard rail and the guide card. */
  progress: "Step {current} of {total}",
  /** Footer navigation, shared by the wizard and the guide. */
  nav: {
    previous: "Back",
    next: "Next",
    done: "Done",
  },

  wizard: {
    brandTagline: "first run",
    railNote: "You can change all of this later in Settings. If you want to stop, skip it: the app works the same.",
    /** Name of the preset the model step creates on a fresh install. */
    defaultPresetName: "Default",
    stepLabels: {
      language: "Language",
      sillyTavern: "SillyTavern",
      welcome: "What this is",
      provider: "Provider and API key",
      model: "Model",
      theme: "Theme",
      persona: "You in the story",
      character: "First character",
      done: "Done",
    },
    language: {
      title: "Choose your language",
      lead: "You can change it later in Settings. Your choice applies immediately.",
      groupLabel: "Interface language",
      option: {
        es: "Interfaz en español",
        en: "Interface in English",
      },
    },
    sillyTavern: {
      title: "Are you coming from SillyTavern?",
      lead: "You can bring your existing characters, presets, personas, and lorebooks before configuring the rest of Pliego Lab.",
      import: {
        title: "Import my SillyTavern setup",
        body: "Choose your SillyTavern folder, review what was found, and select exactly what you want to bring over.",
      },
      skip: {
        title: "I am starting fresh",
        body: "Continue without importing anything. You can use the importer later from Settings.",
      },
    },
    errors: {
      demoCardRead: "Could not read the example card.",
      demoCardImport: "Could not import the example card.",
      cardImport: "Could not import the card.",
    },
    providersLoading: "Loading providers…",
    welcome: {
      title: "Welcome to your story studio",
      lead: "This runs on your machine: characters, chats, images and memory live in files on your disk. For the model to reply you need an API key from some provider, and everything else is optional. Let's get it running in a minute.",
      featuresTitle: "What you will be able to do",
    },
    provider: {
      title: "Your AI provider",
      lead: "The provider generates everything: the replies, the tag-based images, the NPCs and the memory. API keys are stored only in the backend, on your disk, and never come back to the browser.",
      hint: "Test the connection before moving on: if it answers, we are set. Use a cheap model for the test, it is a short message.",
      keyLink: "Get an API key from {provider}",
      noKeyNeeded: "{provider} does not need a key: point the Base URL at your server and that is it.",
      keyReady: "There is already a key configured for {provider}. You can continue.",
    },
    model: {
      title: "Pick the model",
      lead: "The model lives in the active preset, together with temperature and context. You can change it whenever you want in Presets; here it is enough to pick one to start.",
      fieldWithPreset: "Model of the \"{preset}\" preset",
      field: "Model",
      hint: "Search by name or paste the exact ID and press Enter.",
      placeholder: "Search for a model…",
      noPresets: "This installation has no presets yet. Pick a model here and we create the first one, already active.",
      noModelList: "This provider does not publish its model list: type the ID by hand and press Enter.",
    },
    theme: {
      title: "Pick your theme",
      lead: "It applies instantly and you can change it whenever you want in Settings. The whole wizard uses the theme you pick.",
    },
    persona: {
      title: "Who you are in the story",
      leadPrefix: "The persona replaces",
      leadSuffix: "in every prompt: it is the name the character uses to talk to you. You can have several and switch persona in each chat.",
      /** Base form plus the plural variants the runtime picks with `count`. */
      existing: "You already have {count} personas. Skip this step if you prefer.",
      existing_one: "You already have one persona. Skip this step if you prefer.",
      existing_other: "You already have {count} personas. Skip this step if you prefer.",
      saved: "Done: it is your default persona.",
      name: "Your name",
      namePlaceholder: "What you want to be called",
      description: "Description",
      descriptionHint: "Optional: who you are, what you do, how others see you.",
      descriptionPlaceholder: "Optional",
      save: "Save persona",
      saving: "Saving…",
    },
    character: {
      title: "Your first character",
      lead: "No character, no story. Pick the path that suits you best, or skip it and do it later from the library.",
      demo: {
        title: "Use the example character",
        body: "Vera, the lighthouse chronicler. Ready to chat in one click, and you can delete it later.",
      },
      importCard: {
        title: "Import a card",
        body: "A PNG from SillyTavern (the character travels inside the image) or a loose JSON.",
      },
      create: {
        title: "Create from scratch",
        body: "Opens the card editor so you can build it field by field, with AI help if you want.",
      },
      fromSillyTavern: {
        title: "Bring it from SillyTavern",
        body: "Points at your SillyTavern folder and lets you choose which characters, presets and personas to copy.",
      },
      importing: "Importing…",
      imported: "{name} is already in your library.",
      alreadyHave: "You already have characters in the library.",
    },
    done: {
      title: "All set",
      lead: "This is what got configured. Now I can walk you through the main screen button by button, or let you explore.",
      provider: "Provider",
      providerNoKey: " (no key)",
      model: "Model",
      persona: "Persona",
      personaNone: "Not created",
      characters: "Characters",
      charactersNone: "None yet",
      charactersCount: "{count} in the library",
      startTour: "Take the tour",
      explore: "Start exploring",
    },
    skip: "Skip setup",
    finishWithTour: "Finish and see the guide",
  },

  /** "What you will be able to do" list: the same entries feed the help menu. */
  features: {
    characters: {
      name: "Characters",
      blurb: "V2 cards: create, import PNG or JSON, edit and mark favorites.",
    },
    presets: {
      name: "Presets",
      blurb: "Model, sampling, context and reasoning. The provider and its API key live here.",
    },
    personas: {
      name: "Personas",
      blurb: "Who you are in the story. Replaces {{user}} in every prompt.",
    },
    lorebooks: {
      name: "Lorebooks",
      blurb: "World info with keywords, a token budget and an activation inspector.",
    },
    director: {
      name: "Director",
      blurb: "Decides where each image goes and with which tags, reading the generated prose.",
    },
    comfyInject: {
      name: "ComfyInject",
      blurb: "Generates the images against your local ComfyUI: workflow, checkpoint and LoRAs.",
      requires: "Needs ComfyUI running on your machine.",
    },
    recast: {
      name: "Recast",
      blurb: "Rewrites the prose in several passes, with a word-by-word diff before applying.",
    },
    estudio: {
      name: "Studio",
      blurb: "Optional rule packs added to the prompt, plus colored dialogue.",
    },
    gatetonRp: {
      name: "Gateton RP",
      blurb: "Game modules: mind, pen, world, combat, inventory, journal and more.",
    },
    npc: {
      name: "NPC Tracker",
      blurb: "Detects secondary characters and builds their sheet, portrait and relationship with you.",
    },
    memory: {
      name: "Living Memory",
      blurb: "Canon, open threads and a warning when a reply contradicts itself. Experimental.",
    },
    gallery: {
      name: "Gallery and images",
      blurb: "Everything generated in the chat, with tags and seed to regenerate.",
    },
    usage: {
      name: "Usage and cost",
      blurb: "Tokens and real cost per message, chat and model. OpenRouter only.",
    },
    importSt: {
      name: "Import from SillyTavern",
      blurb: "Brings characters, presets and personas from your installation, choosing what to copy.",
    },
    themes: {
      name: "Themes",
      blurb: "Six moods for the interface, including a light mode for reading by day.",
    },
    guide: {
      name: "Guide and help",
      blurb: "The interface walkthrough and the shortcuts, always one click away.",
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
    openGuide: "See the interface guide",
    openGuideHint: "A walkthrough of every button on the main screen.",
    openWizardHint: "Provider, API key, theme and persona again.",
    shortcuts: {
      title: "Shortcuts",
      send: "sends ·",
      lineBreak: "line break",
      mention: "mentions an NPC in the chat",
      closePanel: "closes the open panel",
    },
  },

  /** Settings → Guide. The permanent way back into the first-run onboarding. */
  guide: {
    title: "Guide and first steps",
    description:
      "The interface walkthrough shows up once, on the first run. From here you can replay it, or go through the initial setup again if you changed provider or theme.",
    open: "See the interface guide",
    repeatSetup: "Repeat the initial setup",
    hintPrefix: "The",
    hintSuffix: "button in the top bar opens the same thing at any time, along with the composer shortcuts.",
  },

  /** Progress checklist for a fresh install, rendered in the empty chat. */
  firstSteps: {
    title: "First steps",
    provider: {
      label: "Set up your provider and test the connection",
      action: "Set up",
    },
    persona: {
      label: "Say who you are in the story",
      action: "Create persona",
    },
    character: {
      label: "Bring in or create a character",
      action: "View library",
    },
    chat: {
      label: "Open your first chat",
      action: "Pick a character",
    },
  },

  /** First-run guide script. */
  tour: {
    ariaLabel: "Guide: {title}",
    live: "Step {current} of {total}: {title}",
    skip: "Skip guide",
    steps: {
      welcome: {
        title: "Welcome to Pliego Lab",
        body:
          "This is your story studio: a roleplay frontend that runs on your machine, with characters, memory and images of your own. In a minute I will show you what everything is for, and you can stop whenever you want.",
      },
      brand: {
        title: "Your studio",
        body:
          "Everything lives locally: characters, chats and settings are files on your disk, inside the project folder. The only thing that goes online is what the model needs to reply.",
      },
      topbar: {
        title: "The tools",
        body:
          "Every button in this row opens a full-screen panel. None of it is needed to chat: these are the pieces you touch when you want to tune how the model replies, how the scene looks or what the story remembers.",
      },
      library: {
        title: "Your library",
        body: "This is where your characters live, and everything starts here.",
        bullet1: "Clicking a card opens it and shows its chats.",
        bullet2: "The star marks it as a favorite and moves it up the list.",
        bullet3: "The number on the edge says how many chats you have with that character.",
      },
      libraryEmpty: {
        title: "First, a character",
        body:
          "You do not have any yet. With New you create one from scratch; with PNG you import a V2 card exported from SillyTavern (the character travels inside the image) and with JSON a loose card.",
      },
      libraryActions: {
        title: "Add characters",
        body:
          "New creates one from scratch, PNG imports a V2 card (the character travels inside the image) and JSON a loose card. Above you have the search box and the favorites filter.",
      },
      responsePanel: {
        title: "Response panel",
        body:
          "It is the prompt builder the model sees: the active preset, the forced output language, how much context fits per turn and the prompt blocks in the order they are sent.",
        bullet1: "Streaming and colored dialogue are switched on and off here.",
        bullet2:
          "In the blocks, system and top go before the conversation; in-chat enters by depth and post-history goes at the end.",
      },
      comfyInjectTab: {
        title: "ComfyInject right here",
        body:
          "If you are generating images, your ComfyInject settings (workflow, checkpoint, styles, LoRAs, resolutions) show up in this tab, without opening the big panel.",
      },
      chatHeader: {
        title: "The scene",
        body:
          "At the very top: who the character is and the button to edit their card on the fly. On the right is everything about this chat.",
      },
      chatEmpty: {
        title: "Your workbench",
        body:
          "When you open a chat, the scene appears at the top, the thread in the middle and the composer at the bottom. Right now it is empty because you have not picked who to play with yet: tap a card in the library and then the + to start.",
      },
      chatThread: {
        title: "The conversation",
        body:
          "Under every reply you have the actions: swipes to read alternatives, regenerate, continue, edit, delete and request images. If the Director is on, images show up on their own in the narration.",
      },
      viewMenu: {
        title: "View options",
        body:
          "This menu tunes how you read and who you play with: font size, image size, density, the persona of this chat and its lorebook. It also opens the gallery of everything generated and the chat variables.",
      },
      chatButtons: {
        title: "The cast and the state",
        body:
          "Next to the menu you have three things about the chat: NPCs (the secondary characters the tracker found), State (the visual data the Director keeps so clothes and looks do not change from image to image) and Memory (the canon and the open threads).",
      },
      composer: {
        title: "Write here",
        body: "Enter sends and Shift+Enter makes a line break.",
        bullet1:
          "You write as yourself, or switch to \"As {character}\" to speak in their voice and let the model continue from there.",
        bullet2:
          "With @ you mention NPCs in the chat; with / the commands appear (for now /img, to request a reaction image of an NPC).",
        bullet3: "Snapshot generates an image of what an NPC is doing right now.",
      },
      presets: {
        title: "Presets",
        body:
          "How the model replies: temperature, sampling, penalties, max tokens, how much context fits per turn and whether it returns its reasoning. In the Provider tab you set the API key, the Base URL and test the connection.",
      },
      personas: {
        title: "Personas",
        body:
          "Who you are in the story: name, description and avatar. It replaces {{user}} in every prompt, and you can keep several to pick a different one in each chat.",
      },
      lorebooks: {
        title: "Lorebooks",
        body:
          "World info: entries with keywords that inject themselves when the topic comes up in the conversation, with a token budget and an inspector that shows what was activated and why.",
      },
      characterCreator: {
        title: "New character",
        body:
          "It builds a card from scratch, field by field, and can also generate it with AI from an idea. Description, personality, scenario, example dialogue, first message and portrait.",
      },
      director: {
        title: "Director",
        body:
          "It reads the prose the model wrote and decides where an image goes and with which tags. You do not write image prompts: the narration generates them.",
      },
      comfyInject: {
        title: "ComfyInject",
        body:
          "It is the one that actually draws: it takes the image markers and sends them to your local ComfyUI with your checkpoint, your workflow and your LoRAs. It needs ComfyUI running on your machine; if you turn it on, the host, the workflow and the resolutions are configured here. This panel is extensive and will have its own guide.",
      },
      estudio: {
        title: "Studio",
        body:
          "Optional rule packs added to the prompt, and how colored dialogue is rendered. They are game rules that do not depend on the character, so you switch them on and off per story.",
      },
      gatetonRp: {
        title: "Gateton RP",
        body:
          "The game system: modules you turn on or off (mind, pen style, world, lore, characters, combat, defense, inventory, journal, exploration, director). If you leave it empty, the chat works the same: this is for campaigns with state.",
      },
      recast: {
        title: "Recast",
        body:
          "Multi-pass post-processing: it rewrites the prose in the style you ask for without touching dialogue or image markers. Before applying it shows you a word-by-word diff to accept or reject.",
      },
      npc: {
        title: "NPC Tracker",
        body:
          "It detects the secondary characters that show up in the story and builds a sheet for them: portrait, traits, relationship with you and state. They update themselves after every reply.",
      },
      usage: {
        title: "Usage and cost",
        body:
          "What you actually spent: tokens and cost per message, per chat and per model. It only shows up with OpenRouter, the only provider that publishes prices.",
      },
      moreMenu: {
        title: "Bringing what you already have?",
        body:
          "If you come from SillyTavern, do not start from scratch: from here you import characters, presets and personas, choosing exactly what to bring.",
        importNow: "Import now",
        later: "Later",
      },
      settings: {
        title: "And the general settings",
        body:
          "Here are the interface themes, the Living Memory summary and the buttons to see this guide again or repeat the initial setup whenever you want.",
      },
      done: {
        title: "That is it",
        body:
          "Pick a character from the library and start writing. If you get lost, the ? button in the top bar has the guide, the shortcuts and the initial setup again.",
        startWriting: "Start writing",
      },
    },
  },
};
