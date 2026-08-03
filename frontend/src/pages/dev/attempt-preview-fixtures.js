/**
 * Fixture attempt for the dev-only screenshot harness.
 *
 * Shaped exactly like the `AttemptDto` the backend returns from
 * POST /learner/assessments/{id}/attempts, so the real attempt page renders it
 * without knowing it is not talking to a server. Same contract the arena run
 * fixtures follow (`components/challenges/arena-run-fixtures.js`).
 *
 * It exists so the landing hero can carry screenshots of the genuine
 * assessment workspace — real components, real CSS — rather than a hand-built
 * lookalike that drifts from the product every time the attempt page changes.
 *
 * The five showcased items sit at indices 11-15 inside a 24-item exam: the
 * navigator grid only looks like a real mock exam when there are real items
 * around the one on screen.
 */

const FILLER_PROMPTS = [
  "Which layer of the OSI model is responsible for end-to-end delivery?",
  "What does a foreign key constrain?",
  "Which sorting algorithm runs in O(n log n) in the worst case?",
  "In Agile, what is the purpose of a retrospective?",
  "Which HTTP status code indicates a resource was created?",
  "What is the primary role of an index in a relational database?",
  "Which of these is a symmetric encryption algorithm?",
  "What does CI stand for in a delivery pipeline?",
  "Which data structure gives O(1) average lookup by key?",
  "What is the purpose of a load balancer?",
  "Which SQL clause filters rows after aggregation?",
  "What does a race condition require to occur?",
  "Which testing level verifies modules work together?",
  "What is the output of a normalization process?",
  "Which protocol resolves a domain name to an IP address?",
  "What does RAID 1 provide?",
  "Which principle does dependency injection support?",
  "What is a deadlock's minimum number of participants?",
  "Which memory area holds objects in the JVM?",
]

const FILLER_CHOICES = [
  "Transport layer",
  "Network layer",
  "Session layer",
  "Data link layer",
]

function fillerQuestion(id, promptIndex) {
  return {
    attemptQuestionId: id,
    questionType: "MULTIPLE_CHOICE",
    question: FILLER_PROMPTS[promptIndex % FILLER_PROMPTS.length],
    points: 2,
    choices: FILLER_CHOICES.map((choiceText, choiceIndex) => ({
      choiceId: id * 10 + choiceIndex,
      choiceText,
    })),
    subQuestions: [],
  }
}

/* The five items the hero showcases, in the order the carousel cycles them. */

const MCQ = {
  attemptQuestionId: 1200,
  questionType: "MULTIPLE_CHOICE",
  question: "Which statement describes Second Normal Form?",
  points: 2,
  choices: [
    { choiceId: 12001, choiceText: "It removes transitive dependencies" },
    { choiceId: 12002, choiceText: "It removes partial dependencies on a composite key" },
    { choiceId: 12003, choiceText: "It requires every determinant to be a candidate key" },
    { choiceId: 12004, choiceText: "It eliminates repeating groups" },
  ],
  subQuestions: [],
}

const SHORT_ANSWER = {
  attemptQuestionId: 1300,
  questionType: "SHORT_ANSWER",
  question: "Name the normal form that removes partial dependencies on a composite key.",
  points: 3,
  subQuestions: [],
}

const DESCRIPTIVE = {
  attemptQuestionId: 1400,
  questionType: "DESCRIPTIVE",
  question:
    "Explain why a table with a composite primary key can sit in First Normal Form but not Second Normal Form.",
  points: 8,
  subQuestions: [],
}

const PROGRAMMING = {
  attemptQuestionId: 1500,
  questionType: "CRITICAL_THINKING",
  criticalThinkingType: "PROGRAMMING",
  title: "Prime check under a time limit",
  difficultyLevel: "average",
  points: 12,
  question:
    "A number is prime when it has exactly two distinct divisors: 1 and itself.\n\nImplement is_prime(n) so it returns True only for prime numbers. Your function is called once per test case and must handle inputs up to one million within the time limit.",
  instructions:
    "Constraints: 2 <= n <= 1,000,003 · time limit 1s · return a boolean. Trial division up to the square root is enough to pass.",
  starterCode: "def is_prime(n):\n    # your code here\n    pass\n",
  testCases: [
    { index: 0, label: "Rejects n < 2", sample: true, input: "n = 1", status: "NOT_RUN" },
    { index: 1, label: "Detects 7, 13, 97", sample: true, input: "n = 97", status: "NOT_RUN" },
    { index: 2, label: "Rejects even numbers", sample: false, input: null, status: "NOT_RUN" },
    { index: 3, label: "Handles n = 1000003", sample: false, input: null, status: "NOT_RUN" },
  ],
  subQuestions: [
    { subQuestionId: 15001, questionText: "Which inputs must be rejected before any division runs?" },
    { subQuestionId: 15002, questionText: "Why is checking divisors up to the square root sufficient?" },
  ],
}

const DIAGRAM = {
  attemptQuestionId: 1600,
  questionType: "CRITICAL_THINKING",
  criticalThinkingType: "DIAGRAM",
  title: "Students and courses",
  difficultyLevel: "average",
  diagramType: "ERD",
  points: 10,
  question:
    "A student enrols in many courses, and a course holds many students.\n\nModel this relationship without a many-to-many edge directly between the two entities.",
  instructions:
    "Use crow's foot notation, mark every primary and foreign key, and resolve the M:N with a junction entity.",
  rubric: [
    { name: "Entities and attributes", maxPoints: 3, description: "STUDENT and COURSE exist with sensible attributes." },
    { name: "Junction entity", maxPoints: 4, description: "The M:N is resolved through an ENROLLMENT entity." },
    { name: "Keys marked", maxPoints: 2, description: "Primary and foreign keys are identified." },
    { name: "Cardinality", maxPoints: 1, description: "Crow's foot cardinality is correct on both edges." },
  ],
  subQuestions: [
    { subQuestionId: 16001, questionText: "Which attributes belong on the junction entity rather than on STUDENT?" },
  ],
}

/** The showcased items, keyed for `?item=<id>` on the preview URL. */
export const SHOWCASE = [
  { id: "mcq", label: "Multiple Choice", attemptQuestionId: 1200 },
  { id: "short-answer", label: "Short Answer", attemptQuestionId: 1300 },
  { id: "descriptive", label: "Descriptive", attemptQuestionId: 1400 },
  { id: "programming", label: "Programming", attemptQuestionId: 1500 },
  { id: "diagram", label: "Diagram", attemptQuestionId: 1600 },
]

export function resolveShowcaseId(idOrKey) {
  const match = SHOWCASE.find((item) => item.id === idOrKey)
  if (match) return match.attemptQuestionId
  const numeric = Number(idOrKey)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const QUESTIONS = [
  ...Array.from({ length: 11 }, (_, i) => fillerQuestion(101 + i, i)),
  MCQ,
  SHORT_ANSWER,
  DESCRIPTIVE,
  PROGRAMMING,
  DIAGRAM,
  ...Array.from({ length: 8 }, (_, i) => fillerQuestion(201 + i, i + 11)),
]

const DESCRIPTIVE_ANSWER =
  "A composite key means the primary key spans two columns. If a non-key column depends on only one of them, that is a partial dependency — the table is in 1NF, because every value is atomic, but not in 2NF, because a non-key attribute is not fully functionally dependent on the whole key."

const SOLUTION_CODE =
  "def is_prime(n):\n" +
  "    if n < 2:\n" +
  "        return False\n" +
  "    for i in range(2, int(n ** 0.5) + 1):\n" +
  "        if n % i == 0:\n" +
  "            return False\n" +
  "    return True\n"

/* A part-built ERD: the two entities placed and the junction between them still
   missing its cardinality, which is what a learner's canvas looks like halfway
   through the item. draw.io reads this straight from `initialXml`. */
function erdCell(id, label, x, y, width = 160, height = 90) {
  return (
    `<mxCell id="${id}" value="${label}" ` +
    'style="shape=table;startSize=30;fillColor=#ffffff;strokeColor=#2b70c9;strokeWidth=2;fontStyle=1;rounded=1;arcSize=12" ' +
    `vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`
  )
}

const DIAGRAM_XML =
  '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" page="0" background="#ffffff"><root>' +
  '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
  erdCell("student", "STUDENT&#10;student_id PK&#10;name", 60, 80) +
  erdCell("enrollment", "ENROLLMENT&#10;student_id FK&#10;course_id FK", 300, 240) +
  erdCell("course", "COURSE&#10;course_id PK&#10;title", 540, 80) +
  '<mxCell id="e1" style="edgeStyle=entityRelationEdgeStyle;strokeColor=#5b6a75;strokeWidth=2;endArrow=ERmany" ' +
  'edge="1" parent="1" source="student" target="enrollment"><mxGeometry relative="1" as="geometry"/></mxCell>' +
  '<mxCell id="e2" style="edgeStyle=entityRelationEdgeStyle;strokeColor=#5b6a75;strokeWidth=2;endArrow=ERmany" ' +
  'edge="1" parent="1" source="course" target="enrollment"><mxGeometry relative="1" as="geometry"/></mxCell>' +
  "</root></mxGraphModel>"

/* Answers already given, so the screenshots show work in progress rather than
   five empty surfaces. Keyed by attemptQuestionId, as the server returns them.

   Sub-answers ride in `learnerAnswer` as a JSON object, which is the shape the
   attempt page rehydrates them from — not an invention of this fixture. */
const SAVED_ANSWERS = {
  1200: { attemptQuestionId: 1200, selectedChoiceId: 12002 },
  1300: { attemptQuestionId: 1300, learnerAnswer: "Second Normal Form" },
  1400: { attemptQuestionId: 1400, learnerAnswer: DESCRIPTIVE_ANSWER },
  1500: {
    attemptQuestionId: 1500,
    submittedCode: SOLUTION_CODE,
    programmingLanguage: "Python",
    learnerAnswer: JSON.stringify({
      15001: "Anything below 2 — 0, 1 and every negative — is rejected before the loop runs.",
      15002: "Divisors come in pairs around the square root, so a factor above it implies one below it.",
    }),
  },
  1600: {
    attemptQuestionId: 1600,
    diagramSubmissionData: DIAGRAM_XML,
    learnerAnswer: JSON.stringify({
      16001: "Enrolment date and grade — they describe the pairing, not the student.",
    }),
  },
  ...Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [
      101 + i,
      { attemptQuestionId: 101 + i, selectedChoiceId: (101 + i) * 10 + 1 },
    ])
  ),
}

/**
 * Built per call so the exam clock always starts from the same time remaining.
 *
 * `currentAttemptQuestionId` is how the harness opens straight onto one
 * question type: the attempt page already resumes at whatever item the server
 * says was last viewed, so a screenshot of the programming environment needs no
 * clicking — just a different id.
 */
export function buildAttemptFixture(currentAttemptQuestionId = null) {
  return {
    assessmentAttemptId: 90210,
    assessmentTitle: "topcit mock exam",
    assessmentType: "MOCK_EXAM",
    attemptNumber: 2,
    certificationId: 1,
    expiresAt: new Date(Date.now() + 72 * 60 * 1000).toISOString(),
    resumed: false,
    questions: QUESTIONS,
    savedAnswers: SAVED_ANSWERS,
    flaggedAttemptQuestionIds: [109],
    skippedAttemptQuestionIds: [110],
    currentAttemptQuestionId,
  }
}
