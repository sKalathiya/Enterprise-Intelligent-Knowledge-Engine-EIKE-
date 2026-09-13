import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        if not os.getenv("GEMINI_API_KEY"):
            raise ValueError("GEMINI_API_KEY is not set")
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model_name = "models/gemini-embedding-001"
        if not self.model_name:
            raise ValueError("No model found with embedContent support")

    async def embed_content(self, chunks: list[str]) -> list[float]:
        if chunks is None or len(chunks) == 0:
            return []
        try:
            response = await genai.embed_content_async(
                model=self.model_name,
                content=chunks,
                task_type="retrieval_document",
                output_dimensionality=768,
            )

            return response["embedding"] if response["embedding"] else None
        except Exception as e:
            print(f"Error embedding chunks: {e}")
            raise e
    
    async def embed_query(self, query: str) -> list[float]:
        if not query:
            return []
        try:
            response = await genai.embed_content_async(
                model=self.model_name,
                content=query,
                task_type="retrieval_query",
                output_dimensionality=768,
            )
            return response["embedding"] if response["embedding"] else None
        except Exception as e:
            print(f"Error embedding query: {e}")
            raise e