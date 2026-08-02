import { Code2, Network, Trophy } from "@/components/icons"

/**
 * The IT Olympics arenas, in one place.
 *
 * Shared by the arena overview, each arena's own workspace, and the admin
 * challenges list. `questionTypes` is the arena's contract with the question
 * builder: an arena problem IS a question, so these are ids from
 * `QUESTION_TYPES` in `components/questions/question-editors` rather than a
 * parallel taxonomy that would drift from the bank's validation.
 */
export const ARENAS = [
  {
    id: "codestrike",
    name: "CodeStrike",
    icon: Code2,
    tone: "bg-rb-macaw-wash text-rb-macaw-lip",
    format: "Solo",
    blurb:
      "Ten coding problems back to back, judged against real unit tests and scored on time complexity as well as correctness.",
    questionTypes: ["PROGRAMMING"],
    // World Cup matchmaking is locked to a certification track; the solo runs
    // draw from every published bank, so they have nothing to select.
    tracked: false,
    fields: [
      { key: "problems", label: "Problems per run", value: "10", hint: "Fixed-length run" },
      { key: "timeLimit", label: "Run time limit (min)", value: "45", hint: "0 for untimed" },
      { key: "weightCorrect", label: "Weight — correctness (%)", value: "60" },
      { key: "weightSpeed", label: "Weight — speed (%)", value: "20" },
      { key: "weightBigO", label: "Weight — complexity (%)", value: "20" },
    ],
  },
  {
    id: "blueprint",
    name: "Blueprint Arena",
    icon: Network,
    tone: "bg-rb-beetle-wash text-rb-beetle-lip",
    format: "Solo",
    blurb:
      "Ten UML and system design problems on a drag-and-drop canvas, checked against structural rules rather than opinion.",
    questionTypes: ["DIAGRAM"],
    tracked: false,
    fields: [
      { key: "problems", label: "Problems per run", value: "10" },
      { key: "timeLimit", label: "Run time limit (min)", value: "60" },
      {
        key: "passRules",
        label: "Rules to pass a problem (%)",
        value: "80",
        hint: "Structural checks satisfied",
      },
      {
        key: "components",
        label: "Palette components",
        value: "8",
        hint: "Load balancer, database, …",
      },
    ],
  },
  {
    id: "worldcup",
    name: "World Cup",
    icon: Trophy,
    tone: "bg-rb-bee-wash text-[#8a6d00]",
    format: "8-player tournament",
    blurb:
      "An eight-player bracket on one certification track — quarterfinals, semis, and a timed grand final.",
    questionTypes: ["MCQ", "SHORT_ANSWER", "DESCRIPTIVE"],
    // Every opponent is studying the same syllabus, so each question has to say
    // which certification it belongs to.
    tracked: true,
    fields: [
      { key: "lobbySize", label: "Lobby size", value: "8", hint: "Bracket requires a power of two" },
      { key: "roundSeconds", label: "Seconds per round", value: "180" },
      { key: "countdown", label: "Lock-in countdown (s)", value: "3" },
      {
        key: "queueTimeout",
        label: "Queue timeout (s)",
        value: "120",
        hint: "Before offering a bot lobby",
      },
    ],
  },
]

export function getArena(arenaId) {
  return ARENAS.find((arena) => arena.id === arenaId) ?? null
}

/** The certification tracks a World Cup lobby can queue into. */
export const ARENA_TRACKS = [
  { id: "it-passport", name: "IT Passport", enabled: true },
  { id: "topcit", name: "TOPCIT", enabled: true },
  { id: "fe-exam", name: "FE Exam", enabled: false },
]
