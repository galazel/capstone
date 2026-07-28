import { Badge } from "@/components/ui/badge"

/**
 * Renders the artifact a reviewer is being asked to judge.
 *
 * Generated content comes in a handful of shapes — a curriculum tree, a lesson,
 * a list of questions — so this dispatches on shape rather than on stage name.
 * A stage-name switch would silently fall through to raw JSON the first time a
 * stage was renamed in Python; shape detection degrades to the JSON view only
 * when the content genuinely is something new.
 *
 * Scrolling belongs to the container, not to this component. It used to own a
 * `h-full` ScrollArea per shape, which collapsed to zero height the moment it
 * was placed in a flowing transcript instead of a fixed-height pane.
 */
export function ArtifactViewer({ payload }) {
  if (payload == null) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing to display.</p>
  }

  const questions = extractQuestions(payload)
  if (questions) return <QuestionList questions={questions} />

  if (isLesson(payload)) return <LessonView lesson={payload} />
  if (payload.lesson) {
    const quiz = extractQuestions(payload.quiz)
    return (
      <div className="space-y-5">
        <LessonView lesson={payload.lesson} />
        {quiz ? (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Lesson quiz</h4>
            <QuestionList questions={quiz} />
          </section>
        ) : null}
      </div>
    )
  }

  if (payload.major_categories) return <CurriculumView curriculum={payload} />

  return <RawView value={payload} />
}

function extractQuestions(value) {
  if (Array.isArray(value) && value.length && value[0]?.question) return value
  if (Array.isArray(value?.questions) && value.questions.length) return value.questions
  return null
}

function isLesson(value) {
  return Boolean(value?.title && (value.sections || value.introduction))
}

function QuestionList({ questions }) {
  // Rows are tinted rather than given an opaque surface colour: this renders
  // inside the review dialog, where `bg-background` would assume the dialog
  // shell resolved to the same theme the row did.
  return (
    <ol className="space-y-3">
      {questions.map((question, index) => (
        <li key={index} className="rounded-lg border border-border bg-muted/25 p-3.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
            {question.question_type ? <Badge variant="outline">{question.question_type}</Badge> : null}
            {question.difficulty ? <Badge variant="secondary">{question.difficulty}</Badge> : null}
            {question.bloom_level ? (
              <span className="text-xs text-muted-foreground">{question.bloom_level}</span>
            ) : null}
          </div>

          <p className="text-sm leading-6 text-foreground">{question.question}</p>

          {Array.isArray(question.choices) && question.choices.length ? (
            <ul className="mt-2.5 space-y-1">
              {question.choices.map((choice, i) => (
                <li
                  key={i}
                  className={
                    i === question.correct_choice_index
                      ? "text-sm leading-6 font-medium text-emerald-600 dark:text-emerald-400"
                      : "text-sm leading-6 text-muted-foreground"
                  }
                >
                  <span className="font-mono text-xs">{String.fromCharCode(65 + i)}.</span>{" "}
                  {typeof choice === "string" ? choice : choice?.text}
                </li>
              ))}
            </ul>
          ) : null}

          {question.explanation ? (
            <p className="mt-2.5 border-t border-border/60 pt-2.5 text-xs leading-relaxed text-muted-foreground">
              {question.explanation}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}

function LessonView({ lesson }) {
  return (
    <article className="space-y-4">
      <header className="space-y-0.5">
        <h3 className="font-heading text-base font-semibold text-foreground">{lesson.title}</h3>
        {lesson.estimated_minutes ? (
          <p className="text-xs text-muted-foreground">about {lesson.estimated_minutes} minutes</p>
        ) : null}
      </header>

      {lesson.introduction ? (
        <p className="text-sm leading-6 text-foreground">{lesson.introduction}</p>
      ) : null}

      {Array.isArray(lesson.learning_objectives) && lesson.learning_objectives.length ? (
        <section className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">Learning objectives</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
            {lesson.learning_objectives.map((objective, i) => (
              <li key={i}>{objective}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {Array.isArray(lesson.sections)
        ? lesson.sections.map((section, i) => (
            <section key={i} className="space-y-1.5">
              {section.heading ? (
                <h4 className="text-sm font-semibold text-foreground">{section.heading}</h4>
              ) : null}
              {section.body ? (
                <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
              ) : null}
              {!section.heading && !section.body ? <RawView value={section} /> : null}
            </section>
          ))
        : null}

      {Array.isArray(lesson.key_terms) && lesson.key_terms.length ? (
        <section className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">Key terms</h4>
          <dl className="space-y-1 text-sm leading-6">
            {lesson.key_terms.map((term, i) => (
              <div key={i}>
                <dt className="inline font-medium text-foreground">{term.term}: </dt>
                <dd className="inline text-muted-foreground">{term.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {lesson.summary ? (
        <section className="space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">Summary</h4>
          <p className="text-sm leading-6 text-muted-foreground">{lesson.summary}</p>
        </section>
      ) : null}
    </article>
  )
}

function CurriculumView({ curriculum }) {
  return (
    <ul className="space-y-4 text-sm">
      {(curriculum.major_categories ?? []).map((major, i) => (
        <li key={i} className="space-y-1.5">
          <p className="font-semibold text-foreground">{major.name}</p>
          <ul className="space-y-2 border-l border-border pl-4">
            {(major.middle_categories ?? []).map((middle, j) => (
              <li key={j} className="space-y-1">
                <p className="font-medium text-foreground">{middle.name}</p>
                <ul className="list-disc space-y-0.5 pl-5 leading-6 text-muted-foreground">
                  {(middle.lessons ?? []).map((lesson, k) => (
                    <li key={k}>{lesson.name ?? lesson.title}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function RawView({ value }) {
  return (
    <pre className="font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
