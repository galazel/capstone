










let structureIdCounter = 0

function createStructureId(prefix) {
  structureIdCounter += 1

  return `${prefix}-${Date.now()}-${structureIdCounter}`
}

function getLessonComponentStructure(lesson) {
  if (!lesson?.lessonComponentStructure) {
    return "[]"
  }

  if (typeof lesson.lessonComponentStructure === "string") {
    return lesson.lessonComponentStructure
  }

  return JSON.stringify(lesson.lessonComponentStructure)
}

export function mapCertificationToModuleStructure(certification) {
  const majorCategories =
      certification?.majorCategory ??
      certification?.majorCategories ??
      []

  if (!Array.isArray(majorCategories)) {
    return []
  }

  return majorCategories.map((majorCategory) => {
    const middleCategories =
        majorCategory.middleCategory ??
        majorCategory.middleCategories ??
        []

    return {
      id: createStructureId("major"),
      majorCategoryId:
          majorCategory.majorCategoryId ?? majorCategory.id ?? null,
      title: majorCategory.title ?? "",
      isOpen: true,
      exams: Array.isArray(majorCategory.exams) ? majorCategory.exams : [],

      middleCategories: (Array.isArray(middleCategories)
          ? middleCategories
          : []
      ).map((middleCategory) => {
        const lessons = middleCategory.lessons ?? []

        return {
          id: createStructureId("middle"),
          middleCategoryId:
              middleCategory.middleCategoryId ??
              middleCategory.id ??
              null,
          title: middleCategory.title ?? "",
          isOpen: true,
          exams: Array.isArray(middleCategory.exams) ? middleCategory.exams : [],

          lessons: (Array.isArray(lessons) ? lessons : []).map(
              (lesson) => ({
                id: createStructureId("lesson"),
                lessonId: lesson.lessonId ?? lesson.id ?? null,
                name: lesson.name ?? lesson.title ?? "",
                lessonComponentStructure:
                    getLessonComponentStructure(lesson),
                exams: Array.isArray(lesson.exams) ? lesson.exams : [],
              })
          ),
        }
      }),
    }
  })
}
