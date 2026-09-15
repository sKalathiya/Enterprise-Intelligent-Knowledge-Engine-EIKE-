from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        ingest_key = os.getenv("GEMINI_CONTENT_EMBEDDING_API_KEY")
        query_key = os.getenv("GEMINI_QUERY_EMBEDDING_API_KEY") or ingest_key
        if not ingest_key or not query_key:
            raise ValueError("GEMINI_CONTENT_EMBEDDING_API_KEY or GEMINI_QUERY_EMBEDDING_API_KEY is not set")
        self.ingest_client = genai.Client(api_key=ingest_key)
        self.query_client = genai.Client(api_key=query_key)
        self.model_name = os.getenv("GEMINI_EMBEDDING_MODEL")
        if not self.model_name:
            raise ValueError("GEMINI_EMBEDDING_MODEL is not set")

    async def embed_content(self, chunks: list[str]) -> list[float]:
        if chunks is None or len(chunks) == 0:
            return []
        try:
            response = await self.ingest_client.aio.models.embed_content(
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
            response = await self.query_client.aio.models.embed_content(
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
