"""FastAPI 主入口"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# 启动时初始化数据库
from app.models.database import init_db
init_db()

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from app.api import notes, record, review, qa, ocr_demo, settings
from app.api.record import reset_stuck_sessions
app.include_router(record.router, prefix="/api/record", tags=["录课采集"])
app.include_router(notes.router, prefix="/api/notes", tags=["笔记管理"])
app.include_router(review.router, prefix="/api/review", tags=["复习计划"])
app.include_router(qa.router, prefix="/api/qa", tags=["智能问答"])
app.include_router(ocr_demo.router, prefix="/api", tags=["OCR 演示"])
app.include_router(settings.router, prefix="/api", tags=["系统设置"])

# 启动时重置卡住的 processing 会话
reset_stuck_sessions()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
