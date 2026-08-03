import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, Plus, Trash2, Trophy } from "@/components/icons"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  QUESTION_TYPES,
  QuestionTypeButton,
  cloneQuestionData,
  createLocalId,
  validateQuestionData,
} from "@/components/questions/question-editors.jsx"
import { getAllCertifications } from "@/services/certificationService.js"

/**
 * Authoring surface for one arena's problem set.
 *
 * Deliberately not a second question builder: the editors, the per-type data
 * shapes, and the validation are the ones the certification Question Bank uses,
 * imported from `question-editors`. An arena problem IS a question — a
 * CodeStrike problem is the PROGRAMMING editor with its test cases, a Blueprint
 * problem is the DIAGRAM editor with its reference canvas — so forking them
 * would leave two definitions of "a valid programming question" to drift apart.
 *
 * What this adds on top is what an arena needs and a lesson question does not:
 * a reward line per problem (points, XP) sitting in a strip above each editor
 * rather than inside it, so the editor stays the shared component.
 *
 * The two shapes an arena's set can take:
 *
 * - A **roadmap** (CodeStrike, Blueprint Arena). The run is the path of
 *   numbered circle buttons in `problem-grid`, and a node is a stage the
 *   learner clears by answering every question in it — `arena.questionsPerNode`
 *   of them. So this groups the editors under their node rather than listing
 *   them flat: authoring node 3 means authoring the ten questions behind
 *   circle 3, and a node short of its quota is a stage that cannot be cleared.
 *
 * - A **mock exam** (World Cup). No path, no nodes: a bracket round is an exam
 *   sat against seven other people, so its problems are one flat list drawn
 *   from a single certification. That certification is chosen once for the
 *   whole set — a run whose questions each named a different certification
 *   would not be a track at all.
 *
 * Problems live in local state. There is no arena-problems endpoint yet, and
 * `saveAuthoredQuestion` cannot stand in for one — it writes a question against
 * a lesson and certification, which an arena problem has neither of. Save
 * validates and reports; the shape authored here is what the endpoint has to
 * accept.
 */

/** Defaults per problem. Points score the run, XP feeds the learner's level. */
const DEFAULT_REWARD = { points: "10", xp: "25" }

function createNode() {
  return { id: createLocalId(), problems: [] }
}

export default function ArenaProblemBuilder({ arena }) {
  // One shape in state for both arenas: a mock-exam arena is a single unnamed
  // node, so grouping never needs a second code path here or in the endpoint.
  const [nodes, setNodes] = useState(() => [createNode()])
  const [errors, setErrors] = useState({})
  const [nodeErrors, setNodeErrors] = useState({})
  const [certificationId, setCertificationId] = useState("")
  const [certificationError, setCertificationError] = useState("")

  const questionsPerNode = Number(arena.questionsPerNode) || 0
  const isRoadmap = questionsPerNode > 0

  /** For a roadmap this is the number of circle buttons on the path; for a
   *  mock exam there is no such field and the set is open-ended. */
  const targetNodes = isRoadmap
    ? Number(arena.fields.find((field) => field.key === "problems")?.value ?? 0)
    : 0

  const allowedTypes = useMemo(
    () => QUESTION_TYPES.filter((type) => arena.questionTypes.includes(type.id)),
    [arena.questionTypes],
  )

  // Only a tracked arena needs this, so only a tracked arena pays for the call.
  const { data: certifications = [] } = useQuery({
    queryKey: ["admin-certifications", "arena-problems"],
    queryFn: () => getAllCertifications(),
    enabled: Boolean(arena.tracked),
    staleTime: 5 * 60 * 1000,
  })

  const allProblems = nodes.flatMap((node) => node.problems)

  function updateNode(nodeId, update) {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? update(node) : node)),
    )
  }

  function addNode() {
    setNodes((current) => [...current, createNode()])
  }

  function removeNode(nodeId) {
    setNodes((current) => {
      const remaining = current.filter((node) => node.id !== nodeId)
      // A roadmap with no nodes has nothing to author into, so the last one
      // empties rather than disappearing.
      return remaining.length > 0 ? remaining : [createNode()]
    })
  }

  function addProblem(nodeId, questionType) {
    updateNode(nodeId, (node) => ({
      ...node,
      problems: [
        ...node.problems,
        {
          id: createLocalId(),
          typeId: questionType.id,
          typeName: questionType.title,
          ...DEFAULT_REWARD,
          data: cloneQuestionData(questionType.data),
        },
      ],
    }))
  }

  function removeProblem(nodeId, problemId) {
    updateNode(nodeId, (node) => ({
      ...node,
      problems: node.problems.filter((problem) => problem.id !== problemId),
    }))
    setErrors((current) => {
      const next = { ...current }
      delete next[problemId]
      return next
    })
  }

  function updateProblemField(nodeId, problemId, field, value) {
    updateNode(nodeId, (node) => ({
      ...node,
      problems: node.problems.map((problem) =>
        problem.id === problemId ? { ...problem, [field]: value } : problem,
      ),
    }))
  }

  /** The editors call `onDataChange` with an updater, not a value — they edit
   *  deep paths and need the current data to merge into. */
  function updateProblemData(nodeId, problemId, update) {
    updateNode(nodeId, (node) => ({
      ...node,
      problems: node.problems.map((problem) =>
        problem.id === problemId
          ? {
              ...problem,
              data: typeof update === "function" ? update(problem.data) : update,
            }
          : problem,
      ),
    }))
  }

  /** The bank's own validator, plus the rules that are the arena's: a reward
   *  has to be a positive number, a roadmap node has to be full, and a tracked
   *  arena's set has to name the certification it is drawn from. */
  function saveProblems() {
    const nextErrors = {}

    for (const problem of allProblems) {
      const problemErrors = validateQuestionData(problem.typeId, problem.data)

      if (!(Number(problem.points) > 0)) {
        problemErrors.points = "Points must be greater than zero."
      }
      if (!(Number(problem.xp) >= 0)) {
        problemErrors.xp = "XP cannot be negative."
      }

      if (Object.keys(problemErrors).length > 0) {
        nextErrors[problem.id] = problemErrors
      }
    }

    setErrors(nextErrors)

    const missingCertification = arena.tracked && !certificationId
    setCertificationError(
      missingCertification ? "Choose the certification these problems come from." : "",
    )

    // A node short of its quota is a circle the learner can open and not
    // finish, so it blocks the save the same way a broken question does.
    const nextNodeErrors = {}
    if (isRoadmap) {
      nodes.forEach((node, index) => {
        if (node.problems.length !== questionsPerNode) {
          nextNodeErrors[node.id] =
            `Node ${index + 1} has ${node.problems.length} of ${questionsPerNode} questions.`
        }
      })
    }
    setNodeErrors(nextNodeErrors)

    if (missingCertification) {
      toast.error("Choose a certification", {
        description: `${arena.name} problems are drawn from one certification track.`,
      })
      return
    }

    const shortNodeCount = Object.keys(nextNodeErrors).length
    if (shortNodeCount > 0) {
      toast.error("Fill every node", {
        description: `${shortNodeCount} node${shortNodeCount === 1 ? "" : "s"} do not hold ${questionsPerNode} questions.`,
      })
      return
    }

    const invalidCount = Object.keys(nextErrors).length
    if (invalidCount > 0) {
      toast.error("Fix the highlighted questions", {
        description: `${invalidCount} of ${allProblems.length} questions are incomplete.`,
      })
      return
    }

    toast.success(`${arena.name} problems validated`, {
      description: isRoadmap
        ? `${nodes.length} node${nodes.length === 1 ? "" : "s"} × ${questionsPerNode} questions ready. Saving needs the arena-problems endpoint.`
        : `${allProblems.length} question${allProblems.length === 1 ? "" : "s"} ready. Saving needs the arena-problems endpoint.`,
    })
  }

  const totalPoints = allProblems.reduce(
    (total, problem) => total + (Number(problem.points) || 0),
    0,
  )
  const totalXp = allProblems.reduce(
    (total, problem) => total + (Number(problem.xp) || 0),
    0,
  )

  /** The reward strip and the editor, shared by both shapes. */
  function renderProblem(node, problem, index) {
    const questionType = QUESTION_TYPES.find((type) => type.id === problem.typeId)
    if (!questionType) return null

    const Editor = questionType.component
    const problemErrors = errors[problem.id] ?? {}

    return (
      <div key={problem.id} className="space-y-2">
        {/* Reward sits above the editor, not inside it: the editor is shared
            with the question bank, where a question carries none. */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="w-24">
            <Label htmlFor={`${problem.id}-points`} className="text-xs font-bold">
              Points
            </Label>
            <Input
              id={`${problem.id}-points`}
              value={problem.points}
              inputMode="numeric"
              className="mt-1 h-9"
              aria-invalid={Boolean(problemErrors.points)}
              onChange={(event) =>
                updateProblemField(node.id, problem.id, "points", event.target.value)
              }
            />
          </div>

          <div className="w-24">
            <Label htmlFor={`${problem.id}-xp`} className="text-xs font-bold">
              XP
            </Label>
            <Input
              id={`${problem.id}-xp`}
              value={problem.xp}
              inputMode="numeric"
              className="mt-1 h-9"
              aria-invalid={Boolean(problemErrors.xp)}
              onChange={(event) =>
                updateProblemField(node.id, problem.id, "xp", event.target.value)
              }
            />
          </div>

          <span className="ml-auto text-xs font-semibold text-muted-foreground">
            Question {index + 1} · {problem.typeName}
          </span>
        </div>

        {problemErrors.points || problemErrors.xp ? (
          <p className="px-1 text-xs text-destructive">
            {problemErrors.points ?? problemErrors.xp}
          </p>
        ) : null}

        <Editor
          questionKey={problem.id}
          questionNumber={index + 1}
          data={problem.data}
          errors={problemErrors}
          onRemove={() => removeProblem(node.id, problem.id)}
          onDataChange={(update) => updateProblemData(node.id, problem.id, update)}
        />
      </div>
    )
  }

  function renderTypeButtons(node, full) {
    if (full) {
      return (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
          This node holds its {questionsPerNode} questions.
        </p>
      )
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {allowedTypes.map((questionType) => (
          <QuestionTypeButton
            key={questionType.id}
            questionType={questionType}
            onAdd={(type) => addProblem(node.id, type)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* One certification for the whole set — a bracket is a track, and every
          player in it is answering from the same syllabus. */}
      {arena.tracked ? (
        <div className="rounded-xl border-2 border-border bg-card p-4">
          <Label htmlFor={`${arena.id}-certification`} className="text-sm font-bold">
            Certification
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            A {arena.name} round is a mock exam on one certification. Choose it before
            authoring the set.
          </p>
          <Select value={certificationId} onValueChange={setCertificationId}>
            <SelectTrigger
              id={`${arena.id}-certification`}
              className="mt-2 max-w-sm"
              aria-invalid={Boolean(certificationError)}
            >
              <SelectValue placeholder="Select a certification" />
            </SelectTrigger>
            <SelectContent>
              {certifications.map((certification) => {
                const id = String(certification.certificationId ?? certification.id)
                return (
                  <SelectItem key={id} value={id}>
                    {certification.title}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {certificationError ? (
            <p className="mt-1.5 text-xs text-destructive">{certificationError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {isRoadmap ? (
            <Badge variant="outline" className="tabular-nums">
              {nodes.length}
              {targetNodes ? ` / ${targetNodes}` : ""} nodes
            </Badge>
          ) : null}

          <Badge variant="outline" className="tabular-nums">
            {allProblems.length} question{allProblems.length === 1 ? "" : "s"}
          </Badge>

          {allProblems.length > 0 ? (
            <>
              <Badge variant="outline" className="tabular-nums">
                {totalPoints} points
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                {totalXp} XP
              </Badge>
            </>
          ) : null}

          {isRoadmap && targetNodes && nodes.length < targetNodes ? (
            <span className="text-xs text-muted-foreground">
              {targetNodes - nodes.length} more node
              {targetNodes - nodes.length === 1 ? "" : "s"} to fill the path
            </span>
          ) : null}
        </div>

        <Button size="sm" onClick={saveProblems} disabled={allProblems.length === 0}>
          <Check className="mr-2 size-4" />
          Save problems
        </Button>
      </div>

      {isRoadmap ? (
        <>
          {/* A node per circle button on the learner's path, authored as its own
              block. Ten flat editors gave no clue which stage a question sat in. */}
          {nodes.map((node, nodeIndex) => {
            const full = node.problems.length >= questionsPerNode
            const nodeError = nodeErrors[node.id]

            return (
              <section
                key={node.id}
                className="rounded-2xl border-2 border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {/* Numbered circle, as it reads on the path. */}
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-border bg-muted font-rb-display text-base font-extrabold">
                    {nodeIndex + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold">Node {nodeIndex + 1}</h3>
                    <p className="text-xs text-muted-foreground">
                      Cleared by answering all {questionsPerNode} questions.
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`tabular-nums ${full ? "" : "text-muted-foreground"}`}
                  >
                    {node.problems.length} / {questionsPerNode}
                  </Badge>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove node ${nodeIndex + 1}`}
                    onClick={() => removeNode(node.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {nodeError ? (
                  <p className="mt-2 text-xs text-destructive">{nodeError}</p>
                ) : null}

                <div className="mt-4 space-y-5">
                  {node.problems.map((problem, index) =>
                    renderProblem(node, problem, index),
                  )}
                  {renderTypeButtons(node, full)}
                </div>
              </section>
            )
          })}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addNode}
            disabled={Boolean(targetNodes) && nodes.length >= targetNodes}
          >
            <Plus className="mr-2 size-4" />
            Add node
          </Button>
        </>
      ) : (
        <>
          {allProblems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <Trophy className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">No questions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add one below. {arena.name} uses the same editors as a
                certification&rsquo;s question bank.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {nodes[0].problems.map((problem, index) =>
                renderProblem(nodes[0], problem, index),
              )}
            </div>
          )}

          {renderTypeButtons(nodes[0], false)}
        </>
      )}
    </div>
  )
}
