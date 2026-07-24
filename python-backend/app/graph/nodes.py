import tempfile
import os
import traceback
from pathlib import Path
import docx2txt
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage
from pypdf import PdfReader
from dotenv import load_dotenv
from app.schemas.curriculum_schema import CertificationCurriculum
from app.schemas.lesson_audit import LessonAuditResult
from .state import CertificationState
from app.services.ai.vector_db import save_chunks, get_vector_store
from app.agents.auditor_lesson import curriculum_agent, auditor_agent, lesson_generation_agent, auditor_lesson_agent
from langgraph.types import Send


load_dotenv(dotenv_path=Path(__file__).with_name(".env"))


def load_document(path: str, content_type: str) -> list[Document]:
    if content_type == "application/pdf":
        return [
            Document(page_content=page.extract_text() or "", metadata={"page": index})
            for index, page in enumerate(PdfReader(path).pages)
        ]
    return [Document(page_content=docx2txt.process(path) or "", metadata={})]


def split_documents(documents: list[Document], chunk_size: int = 300, chunk_overlap: int = 50) -> list[Document]:
    chunks: list[Document] = []
    step = chunk_size - chunk_overlap
    for document in documents:
        text = document.page_content
        for start in range(0, len(text), step):
            chunk = text[start:start + chunk_size]
            if chunk:
                chunks.append(Document(page_content=chunk, metadata=document.metadata.copy()))
            if start + chunk_size >= len(text):
                break
    return chunks


# FIX: Changed from 'async def' to 'def'. LangGraph will handle threading automatically.
def document_ingestion_node(state: CertificationState):
    print("=" * 80, "\nDOCUMENT INGESTION STARTED\n", "=" * 80)
    files = state["uploaded_files"]
    all_chunks = []
    all_extracted_text = []

    for file in files:
        print(f"Processing: {file['filename']}")
        file_bytes = file["content"]
        suffix = ".pdf" if file["type"] == "application/pdf" else ".docx"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name

        try:
            documents = load_document(tmp_path, file["type"])
            for page in documents:
                page.page_content = " ".join(page.page_content.split())
                all_extracted_text.append(page.page_content)

            chunks = split_documents(documents)
            for chunk in chunks:
                chunk.metadata.update({
                    "certification_name": state["certification_name"],
                    "source_file": file["filename"]
                })
            all_chunks.extend(chunks)
        except Exception as e:
            print("\nERROR DURING DOCUMENT INGESTION")
            traceback.print_exc()
            raise RuntimeError(f"Failed processing {file['filename']}") from e
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    print(f"\nSaving {len(all_chunks)} chunks to Chroma...")
    try:
        # We can now call this directly because LangGraph is running this node in a thread
        save_chunks(all_chunks)
        print("Vector database saved successfully.")
    except Exception as e:
        print("Error saving vector database")
        traceback.print_exc()
        raise

    print("DOCUMENT INGESTION COMPLETED\n")
    return {
        "extracted_text": "\n".join(all_extracted_text),
        "vector_store_id": "chroma_db",
        "status": "DOCUMENT_PROCESSING_COMPLETED",
    }


def validate_documents_node(state: CertificationState):
    print("=" * 80, "\nDOCUMENT VALIDATION STARTED\n", "=" * 80)

    sample_texts = []

    # 1. Extract a small sample from each file
    for file in state["uploaded_files"]:
        file_bytes = file["content"]
        suffix = ".pdf" if file["type"] == "application/pdf" else ".docx"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name

        try:
            # Load just the first page/section
            documents = load_document(tmp_path, file["type"])
            if documents:
                # Grab the first 1000 characters to give the LLM context
                sample = documents[0].page_content[:300]
                sample_texts.append(f"Filename: {file['filename']}\nContent Sample: {sample}")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    combined_samples = "\n\n---\n\n".join(sample_texts)

    result = auditor_agent.invoke({
        "messages":[
            HumanMessage(content=f"Certification Name: {state['certification_name']}\nDescription: {state['certification_description']}\n\nDocument Samples:\n{combined_samples}")
        ]
    })
    print("Analyzing document relevance...")

    if result.get("is_related") is True:
        print("Validation Passed! Documents are relevant.")
        return {"status": "VALIDATION_PASSED"}
    else:
        print(f"Validation Failed: {result.get('reason')}")
        return {
            "status": "VALIDATION_FAILED",
            "error_message": result.get("reason", "Documents are not related to the certification.")
        }


# --- This is the Router Function ---
def route_after_validation(state: CertificationState) -> str:
    if state.get("status") == "VALIDATION_PASSED":
        return "continue"
    return "stop"


# FIX: Changed from 'async def' to 'def'.
def curriculum_planning_agent_node(state: CertificationState):

    print("=" * 80)
    print("CURRICULUM PLANNING STARTED")
    print("=" * 80)

    try:

        retriever = get_vector_store().as_retriever(
            search_type="similarity",
            search_kwargs={
                "k": 5,
                "filter": {
                    "certification_name": state["certification_name"]
                }
            }
        )

        query = f"""
        Find certification domains, exam objectives,
        knowledge areas, skills, and learning requirements
        for {state['certification_name']}
        """

        retrieved_docs = retriever.invoke(query)
        print(
            f"Retrieved {len(retrieved_docs)} chunks"
        )

        context = "\n\n".join(
            doc.page_content
            for doc in retrieved_docs
        )

        response = curriculum_agent.invoke(
            {
                "messages": [
                    HumanMessage(
                        content=f"""

            Create a complete certification curriculum.     
            Certification:          
            {state['certification_name']}      
            Description:   
            {state['certification_description']}     
            Reference Materials:  
            {context}  
            Generate the curriculum now.    
            """
                                )
                            ]
                        }
                    )

        curriculum: CertificationCurriculum = (
            response["structured_response"]
        )
        print(
            "CURRICULUM GENERATED SUCCESSFULLY"
        )
        return {
            "curriculum":
                curriculum.curriculum.model_dump(
                    by_alias=True
                ),

            "status":
                "CURRICULUM_CREATED"
        }


    except Exception as e:
        print(
            "CURRICULUM PLANNING FAILED"
        )
        traceback.print_exc()

        raise RuntimeError(
            "Curriculum generation failed."
        ) from e

def create_parallel_lessons(state : CertificationState):
    sends = []
    curriculum = state["curriculum"]

    for major in curriculum["major_categories"]:
        for middle in major["middle_categories"]:
            for lesson in middle["lessons"]:
                sends.append(
                    Send(
                        "lesson_creation_agent_node",
                        {
                            "certification_name": state["certification_name"],
                            "major": major,
                            "middle": middle,
                            "lesson": lesson
                        }
                    )
                )

    return sends

def lesson_creation_agent_node(state : CertificationState):
    response = lesson_generation_agent.invoke(
        {
            "messages": [
                HumanMessage(
                    content=f"""
                    Generate a complete lesson.
                    
                    Certification:
                    {state["certification_name"]}
                    
                    Major Category:
                    {state["major"]["name"]}
                    
                    Middle Category:
                    {state["middle"]["name"]}
                    
                    Lesson:
                    {state["lesson"]["name"]}
                    
                    Learning Objective:
                    {state["lesson"]["learning_objective"]}
                    
                    Lesson Instructions:
                    {state["lesson"]["lessonGenerationInstructions"]}
                    """
                )
            ]
        }
    )
    lesson = response["structured_response"]
    return {
        "lessons": [lesson]
    }

def validate_lessons_node(state: CertificationState):

    print("=" * 80)
    print("LESSON VALIDATION STARTED")
    print("=" * 80)

    response = auditor_lesson_agent.invoke(
        {
            "messages": [
                HumanMessage(
                    content=f"""
                    Review the generated lessons.
                    
                    Certification:
                    {state["certification_name"]}
                    
                    Curriculum:
                    {state["curriculum"]}
                    
                    Generated Lessons:
                    {state["lessons"]}
                    
                    Determine whether every generated lesson follows the curriculum,
                    learning objectives, and lessonGenerationInstructions.
                    """
                )
            ]
        }
    )

    audit: LessonAuditResult = response["structured_response"]

    print("Analyzing generated lessons...")

    if audit.passed:

        print("Lesson validation passed.")

        return {
            "status": "LESSONS_VALIDATED"
        }

    print("Lesson validation failed.")
    print(audit.summary)

    return {
        "status": "LESSON_VALIDATION_FAILED",
        "error_message": audit.summary,
        "audit_result": audit.model_dump()
    }

def route_after_lesson_validation(state: CertificationState):
    if state["status"] == "LESSONS_VALIDATED":
        return "passed"
    return "retry"