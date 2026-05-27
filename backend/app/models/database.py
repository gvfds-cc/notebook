"""
数据库模型
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, JSON, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    raw_markdown: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    knowledge_points: Mapped[list["KnowledgePoint"]] = relationship(back_populates="note", cascade="all, delete-orphan")
    review_plans: Mapped[list["ReviewPlan"]] = relationship(back_populates="note", cascade="all, delete-orphan")


class RecordingSession(Base):
    __tablename__ = "recording_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    audio_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    screenshots: Mapped[list] = mapped_column(JSON, default=list)
    asr_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ocr_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fused_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("notes.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    note_id: Mapped[str] = mapped_column(String(36), ForeignKey("notes.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="manual")
    weight: Mapped[float] = mapped_column(Float, default=0.5)

    note: Mapped["Note"] = relationship(back_populates="knowledge_points")
    review_plans: Mapped[list["ReviewPlan"]] = relationship(back_populates="knowledge_point", cascade="all, delete-orphan")


class ReviewPlan(Base):
    __tablename__ = "review_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    knowledge_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_points.id"), nullable=False)
    note_id: Mapped[str] = mapped_column(String(36), ForeignKey("notes.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    scheduled_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    interval_label: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    knowledge_point: Mapped["KnowledgePoint"] = relationship(back_populates="review_plans")
    note: Mapped["Note"] = relationship(back_populates="review_plans")


class UserConfig(Base):
    __tablename__ = "user_config"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        from app.core.config import settings
        _engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {})
    return _engine


def get_session():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())
    return _SessionLocal()


def init_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # 迁移：确保 processing_started_at 列存在（兼容旧数据库）
    try:
        with engine.connect() as conn:
            conn.execute(
                __import__('sqlalchemy').text(
                    "ALTER TABLE recording_sessions ADD COLUMN processing_started_at DATETIME"
                )
            )
            conn.commit()
    except Exception:
        pass  # 列已存在，忽略