import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

/**
 * Renders the artifact a reviewer is being asked to judge.
 *
 * Generated content comes in a handful of shapes — a curriculum tree, a lesson,
 * a list of questions — so this dispatches on shape rather than on stage name.
 * A stage-name switch would silently fall through to raw JSON the first time a
 * stage was renamed in Python; shape detection degrades to the JSON view only
 * when the content genuinely is something new.
 */
export function ArtifactViewer({ payload }) {
  if (payload == null) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing to display.</p>
  }

  const questions = extractQuestions(payload)
  if (questions) return <QuestionList questions={questions} />

  if (isLesson(payload)) return <LessonView lesson={payload} />
  if (payload.lesson) {
    return (
      <div className="space-y-4">
        <LessonView lesson={payload.lesson} />
        {extractQuestions(payload.quiz) ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Lesson quiz</h4>
            <QuestionList questions={extractQuestions(payload.quiz)} />
          </div>
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
  return (
    <ScrollArea className="h-full">
      <ol className="space-y-3 pr-3">
        {questions.map((question, index) => (
          <li key={index} className="rounded-md border p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              {question.question_type ? <Badge variant="outline">{question.question_type}</Badge> : null}
              {question.difficulty ? <Badge variant="secondary">{question.difficulty}</Badge> : null}
              {question.bloom_level ? (
                <span className="text-xs text-muted-foreground">{question.bloom_level}</span>
              ) : null}
            </div>
            <p className="text-sm">{question.question}</p>
            {Array.isArray(question.choices) && question.choices.length ? (
              <ul className="mt-2 space-y-1">
                {question.choices.map((choice, i) => (
                  <li
                    key={i}
                    className={
                      i === question.correct_choice_index
                        ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {String.fromCharCode(65 + i)}. {typeof choice === "string" ? choice : choice?.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {question.explanation ? (
              <p className="mt-2 text-xs text-muted-foreground">{question.explanation}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </ScrollArea>
  )
}

function LessonView({ lesson }) {
  return (
    <ScrollArea className="h-full">
      <article className="space-y-3 pr-3">
        <header>
          <h3 className="text-base font-semibold">{lesson.title}</h3>
          {lesson.estimated_minutes ? (
            <p className="text-xs text-muted-foreground">
              about {lesson.estimated_minutes} minutes
            </p>
          ) : null}
        </header>
        {lesson.introduction ? <p className="text-sm">{lesson.introduction}</p> : null}
        {Array.isArray(lesson.learning_objectives) && lesson.learning_objectives.length ? (
          <section>
            <h4 className="text-sm font-semibold">Learning objectives</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {lesson.learning_objectives.map((objective, i) => (
                <li key={i}>{objective}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {Array.isArray(lesson.sections)
          ? lesson.sections.map((section, i) => (
              <section key={i}>
                {section.heading ? <h4 className="text-sm font-semibold">{section.heading}</h4> : null}
                {section.body ? <p className="text-sm">{section.body}</p> : null}
                {!section.heading && !section.body ? <RawView value={section} /> : null}
              </section>
            ))
          : null}
        {Array.isArray(lesson.key_terms) && lesson.key_terms.length ? (
          <section>
            <h4 className="text-sm font-semibold">Key terms</h4>
            <dl className="mt-1 space-y-1 text-sm">
              {lesson.key_terms.map((term, i) => (
                <div key={i}>
                  <dt className="inline font-medium">{term.term}: </dt>
                  <dd className="inline text-muted-foreground">{term.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {lesson.summary ? (
          <section>
            <h4 className="text-sm font-semibold">Summary</h4>
            <p className="text-sm">{lesson.summary}</p>
          </section>
        ) : null}
      </article>
    </ScrollArea>
  )
}

function CurriculumView({ curriculum }) {
  return (
    <ScrollArea className="h-full">
      <ul className="space-y-3 pr-3 text-sm">
        {(curriculum.major_categories ?? []).map((major, i) => (
          <li key={i}>
            <p className="font-semibold">{major.name}</p>
            <ul className="mt-1 space-y-1 pl-4">
              {(major.middle_categories ?? []).map((middle, j) => (
                <li key={j}>
                  <p className="font-medium">{middle.name}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
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
    </ScrollArea>
  )
}

function RawView({ value }) {
  return (
    <ScrollArea className="h-full">
      <pre className="whitespace-pre-wrap break-words pr-3 text-[11px] leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    </ScrollArea>
  )
}
