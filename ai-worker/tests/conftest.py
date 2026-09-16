import os

# Importing main / ingest constructs Gemini and LlamaParse clients. Dummy values are enough
# for constructors; these tests never call the providers.
os.environ.setdefault("API_KEY", "test-internal-api-key")
os.environ.setdefault("GEMINI_CONTENT_EMBEDDING_API_KEY", "test")
os.environ.setdefault("GEMINI_QUERY_EMBEDDING_API_KEY", "test")
os.environ.setdefault("GEMINI_EMBEDDING_MODEL", "test-embedding-model")
os.environ.setdefault("GEMINI_CONTENT_GENERATE_API_KEY", "test")
os.environ.setdefault("GEMINI_GENERATIVE_MODEL", "test-generative-model")
os.environ.setdefault("LLAMA_PARSE_API_KEY", "test")
os.environ.setdefault("AI_WORKER_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
