/**
 * Turns the learner portal's curriculum tree and the certification's exams into
 * the single shape both the curriculum page and the topic (study) page render.
 *
 * The backend keeps these apart: `certifications` carries
 * majorCategory → middleCategory → lessons, and `exams` carries every
 * assessment with a `targetScope` pointing back at one of those levels. Joining
 * them in one place means the curriculum card, the topic rail, and the lesson
 * footer all count the same quizzes rather than each re-deriving the join.
 *
 * Nothing here invents data. Where the backend has no field for something the
 * design shows — categories have a title and nothing else — the summary line is
 * derived from what the category actually contains.
 */

import { BookOpen, Cpu, Database, Network, Shield, Target } from "@/components/icons"
import { getCertificationModules } from "@/services/learnerService.js"

/** Tones rotate per unit so a unit keeps one colour across both pages. */
const TONES = ["macaw", "bee", "beetle", "cardinal", "feather"]
const ICONS = [Cpu, Database, Network, Shield, BookOpen, Target]

export function toneForIndex(index) {
  return TONES[index % TONES.length]
}

export function iconForIndex(index) {
  return ICONS[index % ICONS.length]
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function idOf(value) {
  return value == null ? "" : String(value)
}

/**
 * `targetScope` was added after the first exams were authored, so older rows
 * have it null. Fall back to whichever foreign key is actually set — that is
 * what the scope column was derived from in the first place.
 */
export function examScope(exam) {
  const declared = String(exam?.targetScope ?? "").toUpperCase()
  if (declared) return declared

  if (exam?.lessonId != null) return "LESSON"
  if (exam?.middleCategoryId != null) return "MIDDLE_CATEGORY"
  if (exam?.majorCategoryId != null) return "MAJOR_CATEGORY"
  return "CERTIFICATION"
}

const LESSON_SCOPES = new Set(["LESSON", "LESSON_QUIZ", "QUIZ"])
const MIDDLE_SCOPES = new Set(["MIDDLE", "MIDDLE_CATEGORY", "MIDDLE_EXAM", "MODULE_EXAM"])
const MAJOR_SCOPES = new Set(["MAJOR", "MAJOR_CATEGORY", "MAJOR_EXAM"])

export function isPublishedExam(exam) {
  // Null status is DRAFT on the backend (`Exam.effectiveStatus`), so an exam
  // only reaches a learner once it has been explicitly published.
  return String(exam?.status ?? "").toUpperCase() === "PUBLISHED"
}

/** Joins exam_type_id → its text, since ExamDto only carries the id. */
export function examTypeText(exam, examTypesById) {
  return String(
    exam?.examTypeText ??
      exam?.examType?.examTypeText ??
      examTypesById?.get(idOf(exam?.examTypeId)) ??
      "",
  ).toUpperCase()
}

export function isDiagnosticExam(exam, examTypesById) {
  return (
    examTypeText(exam, examTypesById) === "DIAGNOSTIC" ||
    String(exam?.title ?? "").toLowerCase().includes("diagnostic")
  )
}

export function isMockExam(exam, examTypesById) {
  const type = examTypeText(exam, examTypesById)
  return type === "MOCK_EXAM" || String(exam?.title ?? "").toLowerCase().includes("mock exam")
}

/**
 * @param certification      one enrolled certification, with its category tree
 * @param lessonById          Map<lessonId, lesson-with-completed> from the portal
 * @param exams               every exam for this certification
 * @param examTypesById       Map<examTypeId, examTypeText>
 * @param lessonPriorityById  Map<lessonId, priorityTag> from the BKT-backed
 *                            analytics response (`lessonPriorities`), or
 *                            undefined before that request resolves
 */
export function buildCurriculum({
  certification,
  lessonById,
  exams = [],
  examTypesById,
  lessonPriorityById,
}) {
  /* Published, and part of the certification's own curriculum.
     The AI tutor saves its practice quizzes and flashcard decks as published
     exams against the lesson (GeneratedAssessmentService), flagged
     `isGenerated` and scoped "GENERATED" precisely so they never appear as
     curriculum work. They are one learner's practice, generated on demand --
     listing them here would grow the curriculum every time the tutor was
     asked for a deck. */
  const published = exams
    .filter(isPublishedExam)
    .filter((exam) => !exam.isGenerated && examScope(exam) !== "GENERATED")

  const diagnostic = published.find((exam) => isDiagnosticExam(exam, examTypesById)) ?? null
  const mockExam =
    published.find((exam) => isMockExam(exam, examTypesById)) ??
    published.find(
      (exam) =>
        examScope(exam) === "CERTIFICATION" && exam !== diagnostic && !isDiagnosticExam(exam, examTypesById),
    ) ??
    null

  const quizByLesson = new Map()
  const assessmentByMiddle = new Map()
  const assessmentByMajor = new Map()

  /* Everything that does not win a slot below. The buckets are deliberately
     one-per-place -- a unit shows one unit exam, a lesson one quiz -- so a
     second exam on the same target, or a certification-level exam that is not
     the chosen mock, used to be dropped and rendered nowhere at all. The
     curriculum then showed four assessments while the certification had nine,
     and nothing on the page accounted for the difference.

     They are collected rather than force-fitted into the slots: the layout
     reads as one quiz per lesson for a reason, and widening it would make an
     authoring mistake look like intended structure. These surface in their own
     section instead, where they can be sat and can be seen to exist. */
  const extraExams = []

  published.forEach((exam) => {
    if (exam === diagnostic || exam === mockExam) return

    const scope = examScope(exam)

    if (LESSON_SCOPES.has(scope) && exam.lessonId != null) {
      // First published quiz wins. A lesson with two is an authoring mistake,
      // and silently showing both would make the lesson look twice as long.
      if (!quizByLesson.has(idOf(exam.lessonId))) {
        quizByLesson.set(idOf(exam.lessonId), exam)
      } else {
        extraExams.push(exam)
      }
    } else if (MIDDLE_SCOPES.has(scope) && exam.middleCategoryId != null) {
      if (!assessmentByMiddle.has(idOf(exam.middleCategoryId))) {
        assessmentByMiddle.set(idOf(exam.middleCategoryId), exam)
      } else {
        extraExams.push(exam)
      }
    } else if (MAJOR_SCOPES.has(scope) && exam.majorCategoryId != null) {
      if (!assessmentByMajor.has(idOf(exam.majorCategoryId))) {
        assessmentByMajor.set(idOf(exam.majorCategoryId), exam)
      } else {
        extraExams.push(exam)
      }
    } else {
      // Certification-level exams beyond the mock, and anything whose target
      // no longer resolves to a category in this curriculum.
      extraExams.push(exam)
    }
  })

  const majors = getCertificationModules(certification).map((major, majorIndex) => {
    const middles = asArray(major.middleCategory).map((middle) => {
      const lessons = asArray(middle.lessons).map((lesson) => {
        const id = idOf(lesson.lessonId)
        const known = lessonById?.get(id)

        return {
          ...lesson,
          id,
          name: lesson.name ?? lesson.title ?? "Untitled lesson",
          completed: Boolean(known?.completed ?? lesson.completed),
          quiz: quizByLesson.get(id) ?? null,
          priorityTag: lessonPriorityById?.get(id) ?? null,
        }
      })

      const quizzes = lessons.filter((lesson) => lesson.quiz).length
      const assessment = assessmentByMiddle.get(idOf(middle.middleCategoryId)) ?? null

      return {
        id: idOf(middle.middleCategoryId),
        name: middle.title ?? middle.name ?? "Untitled topic",
        // Categories carry a title and nothing else, so the sub-line states
        // what the topic contains rather than inventing a description.
        summary: [
          `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}`,
          quizzes > 0 ? `${quizzes} quiz${quizzes === 1 ? "" : "zes"}` : null,
          assessment ? "1 assessment" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        lessons,
        quizzes,
        assessment,
        done: lessons.filter((lesson) => lesson.completed).length,
      }
    })

    const lessonCount = middles.reduce((total, middle) => total + middle.lessons.length, 0)
    const doneCount = middles.reduce((total, middle) => total + middle.done, 0)

    return {
      id: idOf(major.majorCategoryId),
      index: majorIndex + 1,
      name: major.title ?? major.name ?? `Unit ${majorIndex + 1}`,
      tone: toneForIndex(majorIndex),
      icon: iconForIndex(majorIndex),
      wordmark: `unit ${String(majorIndex + 1).padStart(2, "0")}`,
      middles,
      assessment: assessmentByMajor.get(idOf(major.majorCategoryId)) ?? null,
      lessonCount,
      doneCount,
      quizCount: middles.reduce((total, middle) => total + middle.quizzes, 0),
      assessmentCount: middles.filter((middle) => middle.assessment).length,
      progress: lessonCount ? Math.round((doneCount / lessonCount) * 100) : 0,
    }
  })

  const lessonTotal = majors.reduce((total, major) => total + major.lessonCount, 0)
  const lessonDone = majors.reduce((total, major) => total + major.doneCount, 0)

  return {
    majors,
    diagnostic,
    mockExam,
    extraExams,
    lessonTotal,
    lessonDone,
    progress: lessonTotal ? Math.round((lessonDone / lessonTotal) * 100) : 0,
  }
}

/** Finds one middle category anywhere in a built curriculum. */
export function findMiddle(curriculum, middleId) {
  for (const major of curriculum.majors) {
    const middle = major.middles.find((item) => item.id === idOf(middleId))
    if (middle) return { major, middle }
  }
  return { major: null, middle: null }
}

/**
 * Whether this learner has sat the certification's diagnostic.
 *
 * Checked against their own exam results rather than a flag on the enrollment:
 * the enrollment has no such column, and the result rows are what the rest of
 * the portal already reads.
 */
export function hasSatDiagnostic({ diagnostic, examResults = [], certificationId }) {
  if (!diagnostic) {
    // No diagnostic authored for this certification means there is nothing to
    // gate on. Locking the whole curriculum behind an exam that does not exist
    // would make the certification unusable.
    return true
  }

  return examResults.some((result) => {
    if (idOf(result.examId) !== idOf(diagnostic.examId)) {
      // Older results carry the certification but not the exam id.
      const sameCertification = idOf(result.certificationId) === idOf(certificationId)
      const looksDiagnostic = String(result.assessmentType ?? result.assessmentTitle ?? "")
        .toLowerCase()
        .includes("diagnostic")
      if (!sameCertification || !looksDiagnostic) return false
    }

    return Boolean(
      result.submittedAt ?? result.dateTaken ?? result.finishedAt ?? result.score != null,
    )
  })
}
