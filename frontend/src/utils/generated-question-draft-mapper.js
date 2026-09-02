function createMcqData(draft) {
    const choices = (draft.choices ?? []).map((choice, index) => ({
        choiceText: choice?.choiceText ?? "",
        image: null,
        imageKey: choice?.imageKey ?? null,
        explanation: choice?.explanation ?? "",
        isCorrect: Boolean(choice?.isCorrect),
    }));

    const correctChoiceIndex =
        draft.correctChoiceIndex ??
        choices.findIndex((choice) => choice.isCorrect) ??
        null;

    return {
        questionType: "MCQ",
        question: draft.question ?? "",
        image: null,
        imageKey: draft.imageKey ?? null,
        choices,
        correctChoiceIndex: correctChoiceIndex >= 0 ? correctChoiceIndex : null,
        difficulty: draft.difficulty ?? "average",
        lessonId: String(draft.suggestedLessonId ?? ""),
        suggestedLessonTitle: draft.suggestedLessonTitle ?? "",
        authoringNotes: draft.authoringNotes ?? "",
    };
}

/**
 * The item's parts, in the shape the editors use.
 *
 * The generator names the expected answer `expectedAnswer` -- a term for a
 * fill-in-the-blank blank, a rubric for a written part -- while the editors
 * call it `correctAnswer`. Mapped here rather than renamed at either end,
 * because both names are right where they are: the generator does not know
 * which of the two it produced, and the editor grades against one field.
 *
 * Every mapper below used to hardcode this to [], so a generated fill-in-the-
 * blank reached the reviewer as a passage with no blanks, and a modelling task
 * with no parts -- with nothing to say anything had been lost.
 */
function mapSubQuestions(draft) {
    return (draft.subQuestions ?? []).map((sub) => ({
        question: sub?.question ?? "",
        correctAnswer: sub?.expectedAnswer ?? sub?.correctAnswer ?? "",
        points: sub?.points ?? null,
    }));
}

function createShortAnswerData(draft) {
    return {
        questionType: "SHORT_ANSWER",
        question: draft.question ?? "",
        image: null,
        imageKey: draft.imageKey ?? null,
        correctAnswer: draft.correctAnswer ?? "",
        checkingMethod: draft.checkingMethod ?? "EXACT_MATCH",
        // The blanks, when this is a fill-in-the-blank. Empty otherwise, which
        // is every ordinary short answer.
        subQuestions: mapSubQuestions(draft),
        difficulty: draft.difficulty ?? "average",
        lessonId: String(draft.suggestedLessonId ?? ""),
        suggestedLessonTitle: draft.suggestedLessonTitle ?? "",
        authoringNotes: draft.authoringNotes ?? "",
    };
}

function createDescriptiveData(draft) {
    return {
        questionType: "DESCRIPTIVE",
        question: draft.question ?? "",
        image: null,
        imageKey: draft.imageKey ?? null,
        rubricBasedAnswer: draft.rubricBasedAnswer ?? "",
        checkingMethod: draft.checkingMethod ?? "AI_SEMANTIC",
        difficulty: draft.difficulty ?? "average",
        lessonId: String(draft.suggestedLessonId ?? ""),
        suggestedLessonTitle: draft.suggestedLessonTitle ?? "",
        authoringNotes: draft.authoringNotes ?? "",
    };
}

function createProgrammingData(draft) {
    return {
        questionType: "CRITICAL_THINKING",
        criticalThinkingType: "PROGRAMMING",
        question: draft.question ?? "",
        image: null,
        imageKey: draft.imageKey ?? null,
        starterCode: draft.starterCode ?? "",
        testCases: (draft.testCases ?? []).map((testCase) => ({
            inputData: testCase?.inputData ?? "",
            expectedOutput: testCase?.expectedOutput ?? "",
        })),
        subQuestions: mapSubQuestions(draft),
        difficulty: draft.difficulty ?? "average",
        lessonId: String(draft.suggestedLessonId ?? ""),
        suggestedLessonTitle: draft.suggestedLessonTitle ?? "",
        authoringNotes: draft.authoringNotes ?? "",
    };
}

function createDiagramData(draft) {
    return {
        questionType: "CRITICAL_THINKING",
        criticalThinkingType: "DIAGRAM",
        question: draft.question ?? "",
        image: null,
        imageKey: draft.imageKey ?? null,
        diagramType: draft.diagramType ?? "ERD",
        instructions: draft.instructions ?? "",
        referenceDiagramXml: "",
        referenceDiagramNodes: [],
        referenceDiagramEdges: [],
        subQuestions: mapSubQuestions(draft),
        difficulty: draft.difficulty ?? "average",
        lessonId: String(draft.suggestedLessonId ?? ""),
        suggestedLessonTitle: draft.suggestedLessonTitle ?? "",
        authoringNotes: draft.authoringNotes ?? "",
    };
}

export function mapGeneratedQuestionDraftToQuestionType(draft) {
    switch (draft?.questionType) {
        case "MCQ":
            return {
                typeId: "MCQ",
                questionTypeName: "Multiple Choice",
                data: createMcqData(draft),
            };
        case "SHORT_ANSWER":
            return {
                typeId: "SHORT_ANSWER",
                questionTypeName: "Short Answer",
                data: createShortAnswerData(draft),
            };
        case "DESCRIPTIVE":
            return {
                typeId: "DESCRIPTIVE",
                questionTypeName: "Descriptive",
                data: createDescriptiveData(draft),
            };
        case "PROGRAMMING":
            return {
                typeId: "PROGRAMMING",
                questionTypeName: "Programming",
                data: createProgrammingData(draft),
            };
        case "DIAGRAM":
            return {
                typeId: "DIAGRAM",
                questionTypeName: "Diagram",
                data: createDiagramData(draft),
            };
        default:
            return null;
    }
}

export function mapGeneratedQuestionDraftsToQuestionTypes(drafts) {
    return (drafts ?? [])
        .map(mapGeneratedQuestionDraftToQuestionType)
        .filter(Boolean);
}
