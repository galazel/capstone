from uuid import uuid4
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

def create_id():
    return str(uuid4())

def get_llm():
    return ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.3-70b-versatile",
        temperature=0,
        max_tokens=6000
    )

llm = get_llm()
