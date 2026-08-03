/**
 * Dummy problem sets for the arena runs.
 *
 * These stand in for the arena-problems endpoint that does not exist yet. They
 * are shaped exactly like the questions `learner-assessment-attempt-page` hands
 * to `ProgrammingQuestionLayout` / `DiagramQuestionLayout` — same field names,
 * same `attemptQuestionId` key — so when the endpoint lands, only where the
 * array comes from changes, not how the run renders it.
 *
 * Nothing here is scored. The run/check stubs below replay a fixed result set
 * so the environment can be reviewed end to end; no judge exists yet, and a
 * fake pass rate would be worse than none.
 */

const CODESTRIKE_TITLES = [
  "Two Sum",
  "Valid Parentheses",
  "Merge Intervals",
  "LRU Cache",
  "Binary Tree Paths",
  "Course Schedule",
  "Word Ladder",
  "Median of Two Arrays",
  "Trapping Rain Water",
  "Longest Substring",
]

const CODESTRIKE_PROMPTS = {
  "Two Sum":
    "Given an array of integers and a target, return the indices of the two numbers that add up to the target. Each input has exactly one solution, and the same element may not be used twice.",
  "Valid Parentheses":
    "Given a string containing only '(', ')', '{', '}', '[' and ']', decide whether the brackets are closed in the correct order.",
  "Merge Intervals":
    "Given a collection of intervals, merge every set of overlapping intervals and return the result sorted by start.",
  "LRU Cache":
    "Design a cache with a fixed capacity that evicts the least recently used entry once full. Both get and put must run in constant time.",
  "Binary Tree Paths":
    "Given the root of a binary tree, return every root-to-leaf path as a string.",
  "Course Schedule":
    "Given a number of courses and their prerequisite pairs, decide whether every course can be finished.",
  "Word Ladder":
    "Given two words and a dictionary, return the length of the shortest transformation sequence changing one letter at a time.",
  "Median of Two Arrays":
    "Given two sorted arrays, return the median of the combined set in logarithmic time.",
  "Trapping Rain Water":
    "Given an elevation map, compute how much water it can trap after raining.",
  "Longest Substring":
    "Return the length of the longest substring without repeating characters.",
}

const DIFFICULTIES = ["easy", "easy", "easy", "average", "average", "average", "average", "difficult", "difficult", "difficult"]

export const CODESTRIKE_PROBLEMS = CODESTRIKE_TITLES.map((title, index) => ({
  attemptQuestionId: `cs-${index + 1}`,
  questionType: "CRITICAL_THINKING",
  criticalThinkingType: "PROGRAMMING",
  title,
  question: CODESTRIKE_PROMPTS[title],
  instructions:
    "Your solution is judged on correctness first, then on how close it lands to the target time complexity.",
  difficultyLevel: DIFFICULTIES[index],
  points: 10,
  starterCode: "public class Solution {\n    // your code here\n}\n",
  // Shaped for TestCasesPanel: sample cases expand to show their input, hidden
  // ones never expose theirs. Same contract as a real attempt.
  testCases: [
    { index: 0, label: "Sample case 1", sample: true, input: "[2, 7, 11, 15], target 9", status: "NOT_RUN" },
    { index: 1, label: "Sample case 2", sample: true, input: "[3, 2, 4], target 6", status: "NOT_RUN" },
    { index: 2, label: "Hidden case 1", sample: false, input: null, status: "NOT_RUN" },
    { index: 3, label: "Hidden case 2 — edge", sample: false, input: null, status: "NOT_RUN" },
  ],
  subQuestions: [],
}))

/* `diagramType` values are the canonical ids from `DIAGRAM_TYPE_OPTIONS`, not
   invented labels: `DiagramArea` scopes the draw.io sidebar by that id and
   silently falls back to ERD for anything it does not recognise, so a
   "SEQUENCE" typo would open a sequence problem in the ER shape library. */
const BLUEPRINT_PROBLEMS_RAW = [
  ["Scalable order processing", "UML_COMPONENT", "Design a system that accepts client orders, authenticates each request, and persists them. Traffic must be distributed, and reads should not hit the database directly."],
  ["Class diagram — library system", "UML_CLASS", "Model the classes behind a library: members, titles, copies, and loans, with the relationships and multiplicities between them."],
  ["Sequence diagram — checkout", "SEQUENCE_DIAGRAM", "Show the message order for a checkout: cart validation, payment authorisation, stock reservation, and confirmation."],
  ["Read-heavy news feed", "UML_COMPONENT", "Design the components behind a feed read far more often than it is written. Show where caching and fan-out sit."],
  ["ER model — school registry", "ERD", "Model students, sections, subjects, and enrolments, with keys and the cardinality of each relationship."],
  ["Use case — ATM withdrawal", "USE_CASE", "Capture the actors and use cases for an ATM withdrawal, including the bank's authorisation as a supporting actor."],
  ["Chat message delivery", "SEQUENCE_DIAGRAM", "Show how a message travels from sender to recipient, including the acknowledgement and the offline path."],
  ["Rate-limited public API", "UML_COMPONENT", "Design an API edge that enforces per-client rate limits without the limiter becoming the bottleneck."],
  ["Order status flow", "ACTIVITY_DIAGRAM", "Model the states an order moves through from placed to delivered, including cancellation and refund."],
  ["Event-driven inventory", "ACTIVITY_DIAGRAM", "Design stock updates as events rather than synchronous writes, and show where consistency is reconciled."],
]

export const BLUEPRINT_PROBLEMS = BLUEPRINT_PROBLEMS_RAW.map(
  ([title, diagramType, question], index) => ({
    attemptQuestionId: `bp-${index + 1}`,
    questionType: "CRITICAL_THINKING",
    criticalThinkingType: "DIAGRAM",
    title,
    question,
    instructions:
      "Marking is structural: each rule is a fact about the diagram, not a matter of taste.",
    diagramType,
    difficultyLevel: DIFFICULTIES[index],
    points: 10,
    rubric: [],
    subQuestions: [],
  }),
)

/**
 * A stubbed judge for one problem, in the shape the layout's real runner
 * returns. Results are scripted and say so: there is no executor, and a fake
 * pass rate is worse than an honest "not scored".
 *
 * `createdAt` is passed in rather than stamped here so the fixtures stay pure;
 * the caller supplies it at run time.
 */
export function makeProgrammingRunner(problem) {
  const executions = []

  const replay = (mode) => async (code, language) => {
    const submitted = String(code ?? "").trim().length > 0

    const tests = (problem.testCases ?? []).map((testCase, index) => ({
      ...testCase,
      // Sample cases pass, the last hidden one fails, so the panel shows both
      // states rather than a uniform column of ticks.
      status: !submitted ? "NOT_RUN" : index < 3 ? "PASSED" : "FAILED",
    }))

    executions.unshift({
      executionId: `${problem.attemptQuestionId}-${executions.length + 1}`,
      mode: mode === "run" ? "Run" : "Check",
      language,
      status: submitted ? "COMPLETED" : "UNAVAILABLE",
      passedTests: submitted ? 3 : 0,
      totalTests: tests.length,
      createdAt: new Date().toISOString(),
    })

    return {
      tests,
      message: submitted
        ? "Demo run — no judge is wired up yet, so these results are scripted."
        : "Write some code first: there is nothing to run.",
    }
  }

  return {
    run: replay("run"),
    check: replay("check"),
    listExecutions: () => executions,
  }
}

/**
 * One runner per problem, built once at module load.
 *
 * Identity matters: the layout's execution-history effect depends on the runner
 * it was handed, so a runner constructed inside render would be a new object
 * every pass and the effect would re-fire forever. Keying them here also gives
 * each problem its own execution history, which is what a real attempt has.
 */
export const CODESTRIKE_RUNNERS = Object.fromEntries(
  CODESTRIKE_PROBLEMS.map((problem) => [
    problem.attemptQuestionId,
    makeProgrammingRunner(problem),
  ]),
)

/** The structural rules a Blueprint problem is marked against, in the shape
 *  `RubricPanel` renders. Unscored until a submission exists. */
const BLUEPRINT_RULES = [
  "Client reaches the load balancer",
  "API gateway sits behind the load balancer",
  "Auth service guards the gateway",
  "Services connect to a database",
  "Cache sits between service and database",
]

export async function checkBlueprintDiagram(submission) {
  const drawn = String(submission ?? "").trim().length > 0

  return {
    rubric: BLUEPRINT_RULES.map((name, index) => ({
      name,
      maxPoints: 2,
      // Last rule unmet, so a partially-correct diagram is what the panel shows.
      awardedPoints: drawn ? (index < 4 ? 2 : 0) : null,
      feedback: drawn
        ? index < 4
          ? "Satisfied"
          : "Not satisfied — no cache between the service and the database."
        : null,
      status: drawn ? "SCORED" : "PENDING",
    })),
    message: drawn
      ? "Demo check — structural marking is not wired up yet, so these results are scripted."
      : "Draw something on the canvas, then check it.",
  }
}
