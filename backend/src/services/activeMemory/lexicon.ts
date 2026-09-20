/**
 * Vocabulary for the heuristic memory extractor.
 *
 * Every list holds *regex source fragments* that are compiled by `wholeWord`, which wraps them in a
 * Unicode-aware word boundary: `(?<![\p{L}\p{N}])(?:source)(?![\p{L}\p{N}])`. Two things follow, and
 * both were bugs before:
 *
 *  - Accents keep working. `\b` treats "ó" as a non-word character, so `\bconfesó\b` and the old
 *    `hasWord` helper missed the very sentences that matter most in Spanish.
 *  - Substrings stop matching. "skill" does not contain the threat term "kill", "planes" is not
 *    "plan", "monkey" is not "key" and "mapa" is not "map" unless "mapa" is listed on its own.
 *
 * Explicit verb endings are spelled out where conjugation matters (`promet` + `ió|er|emos|…`) so a
 * past-tense promise is recognised without dragging in nouns that merely share the stem.
 */

const regexCache = new Map<string, RegExp>();

/** Compiles a whole-word (Unicode aware) matcher for a regex source fragment. */
export function wholeWord(source: string): RegExp {
  const cached = regexCache.get(source);
  if (cached) return cached;
  const compiled = new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, "iu");
  regexCache.set(source, compiled);
  return compiled;
}

/** True when `text` contains `source` as a whole word. Accents fold, substrings do not match. */
export function hasWord(text: string, source: string): boolean {
  return wholeWord(source).test(text);
}

/** First term of `sources` present as a whole word, or `undefined`. */
export function findTerm(text: string, sources: readonly string[]): string | undefined {
  for (const source of sources) {
    if (hasWord(text, source)) return source;
  }
  return undefined;
}

export function hasAnyTerm(text: string, sources: readonly string[]): boolean {
  return findTerm(text, sources) !== undefined;
}

/** Counts how many distinct terms of `sources` appear as whole words. */
export function countTerms(text: string, sources: readonly string[]): number {
  let total = 0;
  for (const source of sources) {
    if (hasWord(text, source)) total += 1;
  }
  return total;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Words that are never a character name on their own: pronouns, determiners, prepositions,
 * conjunctions, adverbs and the ubiquitous English function words. The list is stored lowercased;
 * compare with `normalizeToken`.
 */
export const FUNCTION_WORDS = new Set([
  // Spanish determiners / possessives / pronouns
  "el", "la", "los", "las", "un", "una", "unos", "unas", "su", "sus", "mi", "mis", "tu", "tus",
  "nuestro", "nuestra", "nuestros", "nuestras", "vuestro", "vuestra", "este", "esta", "estos",
  "estas", "ese", "esa", "esos", "esas", "aquel", "aquella", "aquellos", "aquellas", "esto",
  "eso", "aquello", "algo", "alguien", "nadie", "nada", "todo", "toda", "todos", "todas", "otro",
  "otra", "otros", "otras", "mismo", "misma", "yo", "tú", "tu", "él", "ella", "ello", "nosotros",
  "nosotras", "vosotros", "vosotras", "ustedes", "usted", "vos", "ellos", "ellas", "me", "te",
  "se", "nos", "os", "le", "les", "lo", "la", "ti", "sí", "si", "no", "ni", "ya",
  // prepositions / conjunctions / adverbs
  "a", "al", "de", "del", "en", "con", "sin", "por", "para", "sobre", "bajo", "entre", "hacia",
  "hasta", "desde", "según", "contra", "mediante", "durante", "tras", "ante", "y", "e", "o", "u",
  "pero", "sino", "porque", "pues", "que", "qué", "quien", "quién", "quienes", "quiénes", "cual",
  "cuál", "cómo", "como", "cuándo", "cuando", "dónde", "donde", "mientras", "aunque", "si",
  "entonces", "también", "tampoco", "solo", "sólo", "aún", "aun", "casi", "luego", "ahora",
  "antes", "después", "siempre", "nunca", "jamás", "aquí", "allí", "allá", "cerca", "lejos",
  "bien", "mal", "muy", "más", "menos", "tan", "tanto", "cuanto", "hay", "sera", "será", "era",
  // English function words
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by", "for", "with",
  "from", "as", "is", "are", "was", "were", "be", "been", "being", "am", "it", "its", "this",
  "that", "these", "those", "he", "she", "they", "we", "you", "i", "his", "her", "their", "our",
  "your", "my", "me", "him", "them", "us", "not", "no", "so", "then", "than", "there", "here",
  "when", "where", "while", "although", "because", "just", "very", "too", "also", "still", "yet",
]);

/**
 * Stable-diffusion / image-generation vocabulary. Image prompt tags are not character names, not
 * scene changes and not facts: they live in `[[IMG: …]]` markers that the sanitizer removes, and
 * when a stray one survives it must never reach the entity list.
 */
export const TAG_VOCABULARY = new Set([
  "masterpiece", "best", "quality", "amazing", "aesthetic", "absurdres", "highres", "lowres",
  "hires", "anime", "manga", "realistic", "photorealistic", "detailed", "detailedface", "1girl",
  "1boy", "2girls", "2boys", "multiple", "solo", "rating", "questionable", "explicit", "safe",
  "sensitive", "general", "lora", "embedding", "square", "medium", "random", "official", "artist",
  "source", "comment", "twitter", "pixiv", "danbooru", "gelbooru", "sketch", "lineart", "cel",
  "shading", "lighting", "blurry", "jpeg", "artifacts", "watermark", "signature", "username",
  "text", "logo", "nude", "naked", "breasts", "thighs", "portrait", "closeup", "wide", "shot",
  "angle", "view", "pose", "expression", "afterglow", "smirk", "smug", "half", "lidded",
  "negative", "sampler", "steps", "cfg", "seed", "hiresfix", "upscaled", "img", "image", "prompt",
]);

/**
 * Sentence-initial verb forms: Spanish prose capitalises the first word of every sentence, so a
 * leading capital is no evidence of a proper noun. These are the shapes that show up most often
 * ("Andamos por el corredor…", "Caminamos hacia…") and are never names.
 */
export const NON_NAME_VERBS = new Set([
  "andamos", "andaba", "andaban", "caminamos", "caminaba", "caminaban", "camina", "camino",
  "empieza", "empiezo", "empezamos", "empiezan", "comienza", "comienzo", "vamos", "voy", "van",
  "mira", "miro", "miró", "miramos", "miran", "sonríe", "sonrío", "sonrió", "sonríen", "ríe",
  "rio", "río", "llora", "lloró", "grita", "gritó", "susurra", "susurró", "responde", "respondió",
  "dice", "digo", "dijo", "dicen", "piensa", "pensó", "siente", "sintió", "ve", "vio", "oye",
  "oyó", "sabe", "supo", "quiere", "quiso", "puede", "pudo", "debe", "debió", "tiene", "tuvo",
  "está", "estaba", "están", "estaban", "hay", "había", "hubo", "era", "eran", "fue", "fueron",
  "respira", "respiró", "suspira", "suspiró", "observa", "observó", "escucha", "escuchó",
  // English: sentence-initial capitals carry no more information here than they do in Spanish.
  "walks", "runs", "smiles", "says", "said", "looks", "sees", "thinks", "moves", "turns",
  "walked", "ran", "smiled", "looked", "saw", "thought", "moved", "turned", "stood", "sat",
  "took", "went", "came", "spoke", "whispered", "shouted", "replied", "answered", "nodded",
  "laughed", "cried", "sighed", "breathed", "watched", "listened", "heard", "felt", "knew",
  "wanted", "asked", "told", "gave", "held", "kept", "opened", "closed", "entered", "left",
  "stands", "sits", "takes", "goes", "comes", "speaks", "replies", "answers", "nods", "laughs",
  "cries", "sighs", "breathes", "watches", "listens", "hears", "feels", "knows", "wants",
  "asks", "tells", "gives", "holds", "keeps", "opens", "closes", "enters", "leaves", "wonders",
]);

/**
 * Verbs that mark a *completed* change of state, used to promote a beat into an episode. Only past
 * forms are listed: "morirá" is a threat, not an event, and mixing the two is how an open thread
 * becomes a fake memory of something that never happened.
 */
export const CHANGE_VERBS = [
  "acept(?:ó|aron|é|amos)",
  "firm(?:ó|aron|é|amos)",
  "romp(?:ió|ieron)",
  "mur(?:ió|ieron)",
  "mat(?:ó|aron)",
  "nac(?:ió|ieron)",
  "se fue",
  "se marchó",
  "se marcharon",
  "lleg(?:ó|aron|é|amos)",
  "leg(?:ó|aron)",
  "encontr(?:ó|aron|é|amos)",
  "revel(?:ó|aron)",
  "confes(?:ó|aron)",
  "escap(?:ó|aron)",
  "acord(?:ó|aron)",
  "rechaz(?:ó|aron)",
  "gan(?:ó|aron)",
  "perd(?:ió|ieron)",
  "jur(?:ó|aron)",
  "promet(?:ió|ieron)",
  "hir(?:ió|ieron)",
  "rescat(?:ó|aron)",
  "entreg(?:ó|aron)",
  "recibi(?:ó|eron)",
  "renunci(?:ó|aron)",
  "abandon(?:ó|aron)",
  "cerr(?:ó|aron)",
  "abri(?:ó|eron)",
  "descubr(?:ió|ieron)",
  "rob(?:ó|aron)",
  "bes(?:ó|aron)",
  "abraz(?:ó|aron)",
  "cur(?:ó|aron)",
  "salv(?:ó|aron)",
  "termin(?:ó|aron)",
  "empez(?:ó|aron)",
  "comenz(?:ó|aron)",
  "decid(?:ió|ieron)",
  "elig(?:ió|eron)",
  "traicion(?:ó|aron)",
  "mint(?:ió|ieron)",
  "cumpl(?:ió|ieron)",
  "fallec(?:ió|ieron)",
  "destruy(?:ó|eron)",
  "entr(?:ó|aron)",
  "sali(?:ó|eron)",
  "parti(?:ó|eron)",
  "viaj(?:ó|aron)",
  "se cas(?:ó|aron)",
  "huy(?:ó|eron)",
  // English equivalents — same shapes, same promotion rule.
  "accept(?:ed|s)?",
  "sign(?:ed|s)?",
  "broke",
  "di(?:ed|es)",
  "kill(?:ed|s)?",
  "was born",
  "left",
  "arriv(?:ed|es)",
  "found",
  "reveal(?:ed|s)?",
  "confess(?:ed|es)?",
  "escap(?:ed|es)?",
  "agreed",
  "reject(?:ed|s)?",
  "won",
  "lost",
  "swore",
  "promis(?:ed|es)?",
  "hurt",
  "rescu(?:ed|es)?",
  "receiv(?:ed|es)?",
  "quit",
  "abandon(?:ed|s)?",
  "clos(?:ed|es)?",
  "open(?:ed|s)?",
  "discover(?:ed|s)?",
  "stole",
  "kiss(?:ed|es)?",
  "hugg(?:ed|es)?",
  "heal(?:ed|s)?",
  "sav(?:ed|es)?",
  "finish(?:ed|es)?",
  "start(?:ed|s)?",
  "began",
  "decid(?:ed|es)?",
  "chose",
  "betray(?:ed|s)?",
  "destroy(?:ed|s)?",
  "enter(?:ed|s)?",
  "depart(?:ed|s)?",
  "travel(?:ed|s)?",
  "got married",
  "fled",
  "returned",
];

/** Change verbs that already imply completion: a single hit is enough for an episode. */
export const TERMINAL_VERBS = [
  "mur(?:ió|ieron)",
  "mat(?:ó|aron)",
  "nac(?:ió|ieron)",
  "se fue",
  "escap(?:ó|aron)",
  "huy(?:ó|eron)",
  "leg(?:ó|aron)",
  "lleg(?:ó|aron)",
  "termin(?:ó|aron)",
  "se cas(?:ó|aron)",
  "di(?:ed|es)",
  "kill(?:ed|s)?",
  "was born",
  "left",
  "escap(?:ed|es)?",
  "fled",
  "arriv(?:ed|es)",
  "finish(?:ed|es)?",
  "got married",
  "destroy(?:ed|s)?",
];

/** Explicit "this is over, and it mattered" markers. */
export const COMPLETION_MARKERS = [
  "por primera vez",
  "for the first time",
  "finalmente",
  "por fin",
  "al final",
  "así que",
  "por eso",
  "desde entonces",
  "a partir de ese momento",
  "de una vez",
  "con éxito",
  "lo logró",
  "lo consiguió",
  "de inmediato",
  "justo entonces",
  "en ese momento",
  "una vez más",
  "ya está",
  "no volverá a",
  // English equivalents. Bare "so" / "already" are deliberately absent: too common in prose to
  // signal completion on their own.
  "finally",
  "at last",
  "in the end",
  "ever since",
  "since then",
  "from that moment",
  "once and for all",
  "for good",
  "successfully",
  "managed to",
  "right then",
  "at that moment",
  "once again",
  "no longer",
  "as a result",
];

/** Movement that changes the scene's location. */
export const MOVEMENT_TERMS = [
  "caminamos", "caminó", "caminaron", "fuimos", "fue", "fueron", "vamos", "van", "nos dirigimos",
  "se dirigió", "avanzamos", "avanzó", "llegamos", "llegó", "llegaron", "entramos", "entró",
  "entraron", "salimos", "salió", "salieron", "volvimos", "volvió", "partimos", "partió",
  "viajamos", "viajó", "nos marchamos", "se marchó", "cruzamos", "cruzó", "subimos", "subió",
  "bajamos", "bajó", "walked", "arrived", "entered", "left", "headed", "went", "traveled",
  "crossed", "climbed", "descended", "returned", "departed", "moved", "ran", "marched",
];

/** Prospective threat language. Completed violence belongs to episodes, not to an open thread. */
export const THREAT_TERMS = [
  "amenaz(?:o|as|a|amos|an|ó|aron|ar|aré|ará|arán|aría|ando|ado|ante|antes)",
  "matar(?:é|ás|á|emos|án|ía|ías)",
  "matar",
  "destru(?:ir|iré|irá|irás|irán|iría|yó|ye|ido|yendo)",
  "acabar(?:é|á|ás|emos|án|ía) con",
  "kill(?:s|ed)? you",
  "kill you",
  "threat(?:en|ens|ened|ening)?",
  "te voy a",
  "te vas a arrepentir",
  "te arrepentirás",
  "you will regret",
];

export const PROMISE_TERMS = [
  "promet(?:o|es|e|emos|éis|en|í|ió|ieron|er|eré|erás|erá|eremos|erán|ería|ido|ida|idos|idas|iendo)",
  "promes(?:a|as)",
  "jur(?:o|as|a|amos|áis|an|ó|aron|ar|aré|ará|arán|aría|ado|ando)",
  "palabra de honor",
  "te lo juro",
  "promise(?:d|s)?",
  "swore",
  "swear",
  "vow(?:ed|s)?",
];

export const SECRET_TERMS = [
  "secret(?:o|os|a|as)",
  "ocult(?:o|as|a|amos|an|ó|aron|ar|aré|ará|aría|ando|ado|ada)",
  "escond(?:o|es|e|emos|en|ió|ieron|er|eré|erá|ería|iendo|ido|ida)",
  "nadie sabe",
  "nadie debe saber",
  "no le digas",
  "no se lo digas",
  "guarda(?:r|ré|rá|mos|rán)? el secreto",
  "hidden",
  "conceal(?:ed|s|ing)?",
  "keep it a secret",
];

export const PLAN_TERMS = [
  "plan",
  "plane(?:o|as|a|amos|áis|an|ó|aron|ar|aré|ará|arán|aría|ando|ado)",
  "plane(?:ar)",
  "tiene(?:n)? pensado",
  "piensa(?:n)? (?:hacer|ir|irnos|huir)",
  "vamos a",
  "voy a",
  "intent(?:o|as|a|amos|an|ó|aron|ar|aré|ará|arán|aría|ando|ado)",
  "pretend(?:o|es|e|emos|en|er|erá|ería)",
  "intend(?:s|ed|ing)?",
  "plan to",
];

export const CONFLICT_TERMS = [
  "conflict(?:o|os|ivo|iva)?",
  "discusi(?:ón|ones)",
  "discut(?:o|es|e|imos|en|ió|ieron|ir|irá|irán|iría|iendo|ido)",
  "disputa(?:s)?",
  "enfrent(?:ó|aron|amiento|ará|arán)",
  "enemig(?:o|os|a|as)",
  "rival(?:es|idad)?",
  "pele(?:a|as|ar|ará|arán|aron|ando)",
  "pleit(?:o|os|ear|eará)",
  "confront(?:ó|aron|ará|arán|ar)",
  "fight(?:s|ing)?",
  "argu(?:e|es|ed|ing|ment)",
];

export const CLUE_TERMS = [
  "pista(?:s)?",
  "llave(?:s)?",
  "mapa(?:s)?",
  "símbolo(?:s)?",
  "simbol(?:o|os)",
  "acertijo(?:s)?",
  "código(?:s)?",
  "codigo(?:s)?",
  "clue(?:s)?",
  "key(?:s)?",
  "map(?:s)?",
  "symbol(?:s)?",
  "encontr(?:ó|aron|é|aste|amos|ará|arán|aría|ado|ada|ando)",
  "descubr(?:ió|ieron|irá|irán|iría|ir|iendo|imiento|e)",
  "hall(?:ó|aron|é|amos|ar|ará)",
  "revel(?:ó|aron|ará|arán|ar)",
];

export const GOAL_TERMS = [
  "debemos", "debo", "debes", "debe", "debéis", "deben", "debía", "debíamos",
  "tenemos que", "tengo que", "tienes que", "tiene que", "tenéis que", "tienen que", "tenía que",
  "hay que", "habrá que", "había que",
  "objetivo(?:s)?", "misi(?:ón|ones)", "meta(?:s)?",
  "must", "need to", "have to", "goal(?:s)?", "mission(?:s)?",
];

export const INTERRUPTED_TERMS = [
  "interrump(?:o|es|e|imos|en|ió|ieron|ir|irá|irán|iría|iendo|ido|ida)",
  "antes de poder",
  "antes de que pudiera",
  "antes de que pudiera",
  "quedó a medias",
  "quedaron a medias",
  "a medias",
  "sin terminar",
  "inacabado",
  "inacabada",
  "pending",
  "unfinished",
  "se cortó",
];

/** Terms whose presence identifies a thread kind, in precedence order. */
export const THREAD_TERMS: Record<string, readonly string[]> = {
  promise: PROMISE_TERMS,
  threat: THREAT_TERMS,
  secret: SECRET_TERMS,
  clue: CLUE_TERMS,
  goal: GOAL_TERMS,
  conflict: CONFLICT_TERMS,
  plan: PLAN_TERMS,
  interrupted_action: INTERRUPTED_TERMS,
};

/**
 * Modality categories. A descriptive present-tense beat ("la sicubo discute el contrato") is not an
 * open thread: the sentence must carry a future, obligation, commitment, threat or concealment mark.
 */
export const MODALITY = {
  future: [
    "iré", "irás", "irá", "iremos", "iréis", "irán", "iría", "irías", "iríamos",
    "voy a", "vas a", "va a", "vamos a", "vais a", "van a",
    "haré", "harás", "hará", "haremos", "harán", "será", "serán", "será que",
    "tendré", "tendrás", "tendrá", "tendremos", "tendrán",
    "will", "going to", "shall", "won't", "won't be",
  ],
  obligation: [
    "debo", "debes", "debe", "debemos", "debéis", "deben", "debía", "debíamos",
    "tengo que", "tienes que", "tiene que", "tenemos que", "tenéis que", "tienen que", "tenía que",
    "hay que", "habrá que", "must", "need to", "needs to", "have to", "has to", "should", "ought to",
  ],
  commitment: [
    "promet(?:o|es|e|emos|éis|en|í|ió|ieron|er|eré|erá|erán|ería|ido|iendo)",
    "promes(?:a|as)",
    "jur(?:o|as|a|amos|an|ó|aron|ar|aré|ará|aría|ado|ando)",
    "palabra de honor", "te lo juro", "trato hecho", "acordamos", "acordaron", "pactamos",
    "promise(?:d|s)?", "swore", "swear", "vow(?:ed|s)?",
  ],
  threat: [
    "amenaz(?:o|as|a|amos|an|ó|aron|ar|aré|ará|arán|aría|ando|ado|ante|antes)",
    "matar(?:é|ás|á|emos|án|ía)",
    "destru(?:ir|iré|irá|irás|irán|iría)",
    "acabar(?:é|á|ás|emos|án) con",
    "kill you", "te voy a", "te arrepentirás", "te vas a arrepentir", "you will regret",
  ],
  concealment: [
    "ocult(?:o|as|a|amos|an|ó|aron|ar|aré|ará|aría|ando|ado|ada)",
    "secret(?:o|os|a|as)",
    "escond(?:o|es|e|emos|en|ió|ieron|er|eré|erá|ería|iendo|ido|ida)",
    "nadie sabe", "nadie debe saber", "no le digas", "no se lo digas",
    "hidden", "conceal(?:ed|s|ing)?", "keep it a secret",
  ],
  intention: [
    "voy a", "vamos a", "pienso", "pensamos", "planeo", "planea", "planeamos", "planean",
    "intento", "intenta", "intentamos", "quiero", "queremos", "quiere", "quieren",
    "tengo ganas de", "tiene pensado", "pretendo", "pretende", "intend(?:s|ed|ing)?", "want to",
    "plan to",
  ],
  pending: [
    "interrump(?:o|es|e|imos|en|ió|ieron|ir|irá|irán|iría|iendo|ido|ida)",
    "antes de poder", "antes de que", "queda pendiente", "queda por", "todavía falta",
    "aún falta", "sin terminar", "a medias", "pending", "unfinished", "still need",
  ],
  discovery: [
    "encontr(?:ó|aron|é|aste|amos|ará|arán|aría|ado|ada|ando)",
    "descubr(?:ió|ieron|irá|irán|iría|ir|iendo|imiento|e)",
    "hall(?:ó|aron|é|amos|ar|ará)",
    "reveal(?:ed|s|ing)?", "found", "discover(?:ed|s|ing)?",
  ],
} as const;

export type ModalityCategory = keyof typeof MODALITY;

/**
 * Which modality mark each thread kind requires. `question` is handled separately: it is defined by
 * an addressed interrogative beat, not by a keyword.
 */
export const THREAD_MODALITY: Record<string, readonly ModalityCategory[]> = {
  promise: ["commitment", "intention"],
  goal: ["obligation", "future", "intention"],
  threat: ["threat", "future"],
  secret: ["concealment", "commitment"],
  plan: ["intention", "future"],
  clue: ["discovery", "concealment", "obligation", "intention"],
  conflict: ["threat", "obligation", "future", "commitment"],
  interrupted_action: ["pending", "future"],
};

/** Curated fact predicates: a sentence becomes a fact only when it states one of these. */
export const FACT_PREDICATES = [
  "es", "son", "era", "eran", "fue", "fueron",
  "está", "están", "estaba", "estaban",
  "tiene", "tienen", "tenía", "tenían",
  "posee", "poseía", "perdió", "perdieron", "ganó", "ganaron",
  "sabe", "saben", "sabía", "sabían", "conoce", "conocen", "conocía",
  "odia", "odiaba", "ama", "amaba", "prefiere", "prefería",
  "lleva", "llevaba", "necesita", "necesitaba", "quiere", "quería",
  "prometió", "prometieron", "juró", "juraron", "confesó", "confesaron",
  "descubrió", "descubrieron", "recuerda", "recordaba", "olvidó", "olvidaron",
  "robó", "robaron", "guardó", "guardaron", "escondió", "escondieron", "esconde",
  "firmó", "firmaron", "aceptó", "aceptaron", "rechazó", "rechazaron",
  "abandonó", "abandonaron", "protege", "protegía", "miente", "mintió",
  "debe", "debía", "debe", "teme", "temía", "sospecha", "sospechaba",
  "is", "was", "were", "has", "had", "lost", "knows", "knew", "hates", "loves",
  "prefers", "needs", "promised", "confessed", "owns", "remembered", "forgot",
  "stole", "keeps", "hides", "wants", "fears",
];

/** Filler questions that close a clause instead of opening a thread. */
export const RHETORICAL_QUESTION_TERMS = [
  "sí", "si", "no", "verdad", "cierto", "eh", "ah", "ajá", "ok", "okay", "vale", "entiendes",
  "me entiendes", "me sigues", "verdad que sí", "right", "righto", "see", "huh", "yes", "ok",
];

/**
 * Second-person shapes ("¿Vas a contarme…?", "dime la verdad") that mark a question as addressed to
 * someone concrete.
 */
export const SECOND_PERSON_TERMS = [
  "tú", "tu", "tus", "usted", "ustedes", "vos", "vosotros", "te", "ti", "contigo", "tuyo", "tuya",
  "vas", "vais", "tienes", "quieres", "puedes", "debes", "estás", "eres", "sabes", "harás", "irás",
  "ven", "dime", "cuéntame", "cuentame", "contame", "you", "your", "yours", "yourself",
  "yourselves", "you're", "you are", "you'll", "you'd", "you've", "tell me", "answer me",
];

/** Beats that read as an inner monologue rather than a physical action. */
export const THOUGHT_CUES = [
  "pienso", "pensé", "pensaba", "piensa", "pensó", "creo", "creí", "creía", "recuerdo",
  "recuerda", "recordé", "imagino", "imaginé", "me pregunto", "se pregunta", "se preguntó",
  "quiero", "quería", "siento", "sentía", "piensan", "piensas",
  // English: the same inner-monologue shapes, first and third person.
  "i think", "i thought", "i believe", "i remember", "i imagine", "i wonder", "i feel", "i want",
  "i wish", "i hope", "i suppose", "i recall", "i realize", "i realised", "i realized",
  "thinks", "thought", "believes", "believed", "remembers", "remembered", "imagines", "imagined",
  "wonders", "wondered", "feels", "felt", "wants", "wanted", "wishes", "wished", "hopes", "hoped",
  "realizes", "realised", "realized", "recalls", "recalled", "maybe", "perhaps",
];
