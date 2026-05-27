"""FastAPI 配置"""
import os


class Settings:
    PROJECT_NAME = "多模态智能笔记助手"
    VERSION = "0.1.0"
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_notes.db")
    MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
    MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))


settings = Settings()
