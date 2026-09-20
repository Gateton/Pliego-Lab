// Built-in rule packs ("Reglas"). The prompt of each pack (`content`) is intentionally not
// surfaced in the UI: the panel shows the friendly name and description only, so the wording can
// evolve without becoming a public API. User-created packs are fully editable.
import type { Addon } from "../../types.js";

export const SEED_ADDONS: Addon[] = [
  {
    id: "dice",
    name: "Dice: You Only",
    description: "Roll 1d20 for every {{user}} attempt that can genuinely fail, and let the narration respect the result.",
    trigger: "[[dice]]",
    exclusive: "dice",
    rolls: 3,
    builtin: true,
    content: "<dice_rules>\nthe die is not the narrator's — it is rolled for you before the scene is written, and the scene answers it.\n\n- order: when a roll is called for, the roll line is the FIRST thing in the reply, before any prose. write the line, then write what happens. never revise the line once the prose exists.\n\n- the numbers are given, not chosen: this turn's rolls are [[dice_rolls]]. take them in order, one per attempt. never invent a number, never re-use one, and never swap one for another because it suits the scene. decide whether an attempt needs a roll before you read the list. if the list runs out, there are no further rolls this turn.\n\n- gate: roll only when {{user}} attempts something that can fail at real cost. one roll per attempt. never roll on what {{user}} feels, wants or decides.\n\n- difficulty: from the task and its opposition, fixed before the roll is read and never moved after, never from what the scene wants — 5 trivial · 10 easy · 15 ordinary · 20 hard · 25 very hard · 30 near-impossible. modifier -3..+3, only from competence already established on the page.\n\n- read: ≥DC → success · DC-1/-2 → success, at a cost · ≤DC-3 → fail, the world moves · nat 20 → more than asked · nat 1 → fail, and it takes something.\n\n- failure is a scene, not a wall: later, poorer, seen, hurt, or holding a worse version of what they wanted. no reset, no rescue in the same beat. a retry is a new attempt at higher difficulty.\n\n- line: <Dice>🎲 attempt — d20+N vs DC → roll+N = total · verdict</Dice>\n  nothing else on it. no numbers, dice or luck anywhere in the prose.\n</dice_rules>"
  },
  {
    id: "dice_all",
    name: "Dice: Everyone",
    description: "Like Dice: You Only, but also roll for NPCs who attempt something risky.",
    trigger: "[[dice]]",
    exclusive: "dice",
    rolls: 6,
    builtin: true,
    content: "<dice_rules>\nthe die is not the narrator's — it is rolled for you before the scene is written, and the scene answers it.\n\n- order: every roll line for this reply comes FIRST, before any prose. write the lines, then write what happens. never revise a line once the prose exists.\n\n- the numbers are given, not chosen: this turn's rolls are [[dice_rolls]]. take them in order, one per attempt. never invent a number, never re-use one, and never swap one for another because it suits the scene. decide which attempts need a roll before you read the list. if the list runs out, there are no further rolls this turn.\n\n- gate: roll for ANY character who attempts something that can fail at real cost — {{user}}, an NPC in the scene, anyone acting. one roll per attempt. never roll on what a character feels, wants or decides. do not roll for background business nobody is watching.\n\n- difficulty: from the task and its opposition, fixed before the roll is read and never moved after, never from what the scene wants — 5 trivial · 10 easy · 15 ordinary · 20 hard · 25 very hard · 30 near-impossible. modifier -3..+3, only from competence already established on the page.\n\n- read: ≥DC → success · DC-1/-2 → success, at a cost · ≤DC-3 → fail, the world moves · nat 20 → more than asked · nat 1 → fail, and it takes something.\n\n- failure is a scene, not a wall: later, poorer, seen, hurt, or holding a worse version of what they wanted. no reset, no rescue in the same beat. a retry is a new attempt at higher difficulty.\n\n- line: <Dice>🎲 who does what — d20+N vs DC → roll+N = total · verdict</Dice>\n  name the character in the line. every roll goes inside one <Dice> tag, one per line, all of it before the prose. no numbers, dice or luck anywhere in the prose.\n</dice_rules>"
  },
  {
    id: "html",
    name: "Immersive HTML",
    description: "When a character reads a screen, letter, or sign, reproduce the object in HTML instead of describing it.",
    trigger: "[[html]]",
    builtin: true,
    content: "<render>\nSome things are read, not described. When a character is looking at a screen, page, sign, letter or printout, reproduce it as HTML styled to look like that object.\n\nRULES\n- Render only what a character is reading right now, and only when the exact wording or layout matters. One per response at most. Most responses have none.\n- Never render summaries, stat panels, status bars, recaps or choice menus. If it exists only for the reader, it does not exist.\n- Give it a maker and a moment: era, device, handwriting, spelling, the author's voice. A 2007 phone is not an iPhone. A hospital terminal is not an app.\n- Put one wrong detail in it — an unread count, a crossed-out word, 4% battery, a blank date, a signature that does not match. Never point at it.\n- Place it mid-response, where a hand or a page turn presents it. Never open or close a response with it. Prose continues on the other side.\n\nBUILD\n- Inline style=\"\" only. No <style>, no <script>, no onclick, no class names.\n- Use <details><summary> for anything folded.\n- No external images.\n- Under 25 lines.\n- Never wrap it in ``` fences. It must render.\n</render>"
  },
  {
    id: "death",
    name: "Real Death",
    description: "No narrative protection: if something is lethal, the character dies. Then choose between narrative survival or taking over another character.",
    trigger: "[[death]]",
    builtin: true,
    content: "[DEATH SYSTEM]\nLethal Logic: If {{user}} causes or suffers an event that would reasonably be fatal, the character dies. No narrative protection applies.\nDeath Execution: narrate the death clearly and ends the scene.\nAfter Death Choice: present two options only:\n  1. Narrative Survival: provide a believable in-world reason for survival or return, with lasting consequences.\n  2. Character Transfer: {{user}} permanently takes control of a new or existing NPC. The death remains canon.\nBinding Outcome: The chosen option is final.\nWorld Memory: The world continues. Characters remember the death as events justify."
  },
  {
    id: "combat",
    name: "Realistic Combat",
    description: "No plot armor: size, skill, numbers, and weapons matter. Injuries, fear, and exhaustion persist.",
    trigger: "[[combat]]",
    builtin: true,
    content: "[COMBAT SYSTEM]\nNo Plot Armor: Combat follows physical reality. Size, skill, numbers, weapons, and preparation matter. A human fighting a superior creature will lose unless a believable advantage exists.\nTurn Structure: Combat unfolds turn-by-turn. Each action has clear cause, cost, and consequence. No skipped steps.\nWeight & Risk: Every strike, miss, wound, and hesitation carries impact. Injury, fatigue, fear, and pain affect future actions.\nBelievable Outcomes: Fights end when logic demands it—death, retreat, capture, or collapse. Victory must be earned; survival must be justified."
  },
  {
    id: "direct",
    name: "Direct Language",
    description: "Name body parts directly, without euphemisms.",
    trigger: "[[Direct]]",
    builtin: true,
    content: "Call body parts by their direct names (\"dick,\" \"pussy,\" \"ass\"); avoid euphemisms like \"shaft,\" \"member,\" or \"cock.\""
  },
  {
    id: "color",
    name: "Character Colors",
    description: "Assign each character a fixed color and keep it throughout the story.",
    trigger: "[[COLOR]]",
    builtin: true,
    content: "- Dialogue Colors: Assign a distinct, readable hex color to every character using: <font color=\"#HEXCODE\">\"Dialogue here\"</font>. Once assigned, a character's color is LOCKED for the entire story."
  }
];
