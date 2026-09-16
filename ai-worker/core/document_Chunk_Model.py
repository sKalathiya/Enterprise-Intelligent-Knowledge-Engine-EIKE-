from sqlalchemy import Column, Integer, ForeignKey, Nullable, Text, DateTime, String  
from datetime import datetime
from .database import Base
import uuid
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"   
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))        # UUID for the chunk
    document_id = Column(String(36), nullable=False, index=True)  # documents.id in Nest; no FK across ORMs
    content = Column(Text, nullable=False)
    # Must stay 768 to match Gemini output_dimensionality and the HNSW index in init_vector_db.
    embedding = Column(Vector(768), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
