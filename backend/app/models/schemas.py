"""
Pydantic schemas for API request/response validation
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NoteBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(default="")
    tags: list[str] = Field(default_factory=list)
    raw_markdown: Optional[str] = None


class NoteCreate(NoteBase):
    ai_enhanced: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class NoteResponse(NoteBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecordingSessionBase(BaseModel):
    title: Optional[str] = Field(None, max_length=500)


class RecordingSessionCreate(RecordingSessionBase):
    pass


class RecordingSessionResponse(RecordingSessionBase):
    id: str
    audio_path: Optional[str] = None
    screenshots: list = Field(default_factory=list)
    asr_result: Optional[str] = None
    ocr_result: Optional[str] = None
    fused_data: Optional[str] = None
    note_id: Optional[str] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class KnowledgePointBase(BaseModel):
    content: str
    source: str = "manual"
    weight: float = Field(default=0.5, ge=0.0, le=1.0)


class KnowledgePointCreate(KnowledgePointBase):
    note_id: str


class KnowledgePointResponse(KnowledgePointBase):
    id: str
    note_id: str

    class Config:
        from_attributes = True


class ReviewTaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    scheduled_time: datetime
    interval_label: Optional[str] = None


class ReviewTaskCreate(ReviewTaskBase):
    knowledge_id: str
    note_id: str


class ReviewTaskUpdate(BaseModel):
    status: Optional[str] = None


class ReviewTaskResponse(ReviewTaskBase):
    id: str
    knowledge_id: str
    note_id: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QARequest(BaseModel):
    question: str = Field(..., min_length=1)


class QAResponse(BaseModel):
    question: str
    answer: str
    sources: list[str] = Field(default_factory=list)


class ProcessSessionRequest(BaseModel):
    session_id: str
    title: Optional[str] = Field(None, max_length=500)


class ProcessSessionResponse(BaseModel):
    session_id: str
    note_id: str
    status: str
    message: str


class UserConfigResponse(BaseModel):
    id: str
    key: str
    value: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True