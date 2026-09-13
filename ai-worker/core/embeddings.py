from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        if not os.getenv("GEMINI_API_KEY"):
            raise ValueError("GEMINI_API_KEY is not set")
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.model_name = "gemini-embedding-001"

    async def embed_content(self, chunks: list[str]) -> list[float]:
        if chunks is None or len(chunks) == 0:
            return []
        try:
            response = await self.client.aio.models.embed_content(
                model=self.model_name,
                contents=chunks,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=768,
                )
                
            )

            return [e.values for e in response.embeddings]
        except Exception as e:
            print(f"Error embedding chunks: {e}")
            raise e
    
    async def embed_query(self, query: str) -> list[float]:
        if not query:
            return []
        try:
            response = await self.client.aio.models.embed_content(
                model=self.model_name,
                contents=query,
                config=types.EmbedContentConfig(
                        task_type="RETRIEVAL_QUERY",
                        output_dimensionality=768,
                )
                
            )
            return response.embeddings[0].values
        except Exception as e:
            print(f"Error embedding query: {e}")
            raise e