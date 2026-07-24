from uuid import uuid4
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langgraph.checkpoint.postgres import PostgresSaver


load_dotenv()

connection_string = (
    os.getenv("DATABASE_URL")
)

checkpointer = PostgresSaver.from_conn_string(
    connection_string
)

def create_id():
    return str(uuid4())

def get_llm():
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.3-70b-versatile",
        temperature=0,
        max_tokens=6000
    )

def get_config(learner_id: int,lesson_id: int):
    return {
    "configurable": {
        "thread_id": f"{learner_id}-{lesson_id}"
    }
}
llm = get_llm()
