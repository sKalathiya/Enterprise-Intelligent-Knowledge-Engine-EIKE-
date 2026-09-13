from sqlalchemy import Column, Integer, ForeignKey, Nullable, Text, DateTime, String  
from datetime import datetime
from .database import Base
import uuid
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"   
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))        # UUID for the chunk
    user_id = Column(String(36), nullable=False, index=True)
    document_id = Column(String(36), nullable=False, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=True) # 768 dimensions for text-embedding-3-small
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
