from typing import Optional

from langchain_core.tools import tool
from app.utils.helpers import create_id


@tool(
    "create_multiple_choice_question",
    description="Creates a Multiple Choice Question (MCQ) with four answer choices, the correct answer index, and an explanation."
)
def create_multiple_choice_question(
    question: str,
    choices: list[str],
    correct_choice_index: int,
    explanation: str = "",
    difficulty: str = "average",
    image_key: str = ""
):
    return {
        "questionType": "MCQ",
        "question": question,
        "imageKey": image_key,
        "choices": [
            {
                "id": create_id(),
                "choiceText": choice,
                "imageKey": "",
                "explanation": explanation if i == correct_choice_index else "",
                "isCorrect": i == correct_choice_index
            }
            for i, choice in enumerate(choices)
        ],
        "correctChoiceIndex": correct_choice_index,
        "difficulty": difficulty
    }


@tool(
    "create_short_answer_question",
    description=(
        "Creates a Short Answer question with the expected answer. For a "
        "fill-in-the-blank, put the passage and its candidate list in "
        "`question`, leave `correct_answer` empty, and give one entry in "
        "`sub_questions` per blank: {question: '(A)', expectedAnswer: 'Term', "
        "points: 5}."
    )
)
def create_short_answer_question(
    question: str,
    correct_answer: str = "",
    sub_questions: Optional[list[dict]] = None,
    difficulty: str = "average",
    image_key: str = ""
):
    return {
        "questionType": "SHORT_ANSWER",
        "question": question,
        "imageKey": image_key,
        "correctAnswer": correct_answer,
        "checkingMethod": "EXACT_MATCH",
        # The blanks of a fill-in-the-blank. Empty for an ordinary short
        # answer, which has one expected answer and no parts.
        "subQuestions": sub_questions or [],
        "difficulty": difficulty
    }


@tool(
    "create_descriptive_question",
    description="Creates a Descriptive question with a model answer or grading rubric."
)
def create_descriptive_question(
    question: str,
    rubric_answer: str,
    difficulty: str = "average",
    image_key: str = ""
):
    return {
        "questionType": "DESCRIPTIVE",
        "question": question,
        "imageKey": image_key,
        "rubricBasedAnswer": rubric_answer,
        "checkingMethod": "AI_SEMANTIC",
        "difficulty": difficulty
    }


@tool(
    "create_programming_question",
    description="Creates a Programming question with starter code, test cases, and optional sub-questions."
)
def create_programming_question(
    question: str,
    starter_code: str,
    test_cases: list[dict],
    sub_questions: Optional[list[dict]] = None,
    difficulty: str = "average",
    image_key: str = ""
):
    return {
        "questionType": "CRITICAL_THINKING",
        "criticalThinkingType": "PROGRAMMING",
        "question": question,
        "imageKey": image_key,
        "starterCode": starter_code,
        "testCases": test_cases,
        "subQuestions": sub_questions or [],
        "difficulty": difficulty
    }


@tool(
    "create_diagram_question",
    description="Creates a Diagram question including reference diagram metadata."
)
def create_diagram_question(
    question: str,
    diagram_type: str,
    instructions: str,
    reference_diagram_xml: str,
    reference_nodes: list,
    reference_edges: list,
    sub_questions: Optional[list] = None,
    difficulty: str = "average",
    image_key: str = ""
):
    return {
        "questionType": "CRITICAL_THINKING",
        "criticalThinkingType": "DIAGRAM",
        "question": question,
        "imageKey": image_key,
        "diagramType": diagram_type,
        "instructions": instructions,
        "referenceDiagramXml": reference_diagram_xml,
        "referenceDiagramNodes": reference_nodes,
        "referenceDiagramEdges": reference_edges,
        "subQuestions": sub_questions or [],
        "difficulty": difficulty
    }


@tool(
    "create_sub_question",
    description="Creates a follow-up sub-question used inside Programming or Diagram questions."
)
def create_sub_question(
    question: str,
    correct_answer: str
):
    return {
        "question": question,
        "correctAnswer": correct_answer
    }


@tool(
    "create_programming_test_case",
    description="Creates a programming test case consisting of input and expected output."
)
def create_programming_test_case(
    input_data: str,
    expected_output: str
):
    return {
        "inputData": input_data,
        "expectedOutput": expected_output
    }


@tool(
    "create_multiple_choice_option",
    description="Creates a single answer choice for a Multiple Choice Question."
)
def create_multiple_choice_option(
    choice_text: str,
    is_correct: bool = False,
    explanation: str = ""
):
    return {
        "id": create_id(),
        "choiceText": choice_text,
        "imageKey": "",
        "explanation": explanation,
        "isCorrect": is_correct
    }


question_builder_tools = [
    create_multiple_choice_question,
    create_short_answer_question,
    create_descriptive_question,
    create_programming_question,
    create_diagram_question,
    create_sub_question,
    create_programming_test_case,
    create_multiple_choice_option,
]