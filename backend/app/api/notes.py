"""笔记管理 API"""
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.models.database import Note, RecordingSession, UserConfig, get_session
from app.models.schemas import NoteCreate, NoteUpdate
from ai_services.note_generator.service import NoteGenerator

logger = logging.getLogger(__name__)
router = APIRouter()


def _note_to_dict(note: Note) -> dict:
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "tags": note.tags or [],
        "raw_markdown": note.raw_markdown,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


def _get_config(session, key: str) -> str | None:
    config = session.query(UserConfig).filter(UserConfig.key == key).first()
    return config.value if config else None


@router.get("/")
async def list_notes():
    """获取笔记列表"""
    session = get_session()
    try:
        notes = session.query(Note).order_by(Note.updated_at.desc()).all()
        return [_note_to_dict(n) for n in notes]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取笔记列表失败: {str(e)}")
    finally:
        session.close()


@router.get("/{note_id}")
async def get_note(note_id: str):
    """获取单条笔记详情"""
    session = get_session()
    try:
        note = session.query(Note).filter(Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="笔记不存在")
        return _note_to_dict(note)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取笔记失败: {str(e)}")
    finally:
        session.close()


@router.post("/")
async def create_note(data: NoteCreate):
    """创建笔记"""
    session = get_session()
    try:
        # 检查是否已存在完全相同的笔记（相同标题和内容）
        existing = session.query(Note).filter(
            Note.title == data.title,
            Note.content == data.content
        ).first()

        if existing:
            raise HTTPException(status_code=409, detail="笔记已存在，请勿重复创建")

        content = data.content

        # AI 增强
        if data.ai_enhanced and data.content.strip():
            try:
                api_key = _get_config(session, "llm_api_key")
                base_url = _get_config(session, "llm_base_url") or "https://api.deepseek.com/v1"
                model = _get_config(session, "llm_model") or "deepseek-chat"

                if api_key:
                    generator = NoteGenerator()
                    result = generator.enhance_via_openai(
                        api_key=api_key,
                        base_url=base_url,
                        model=model,
                        title=data.title,
                        content=data.content,
                    )
                    content = result["content"]
                    logger.info(f"笔记 AI 增强完成: {data.title}")
                else:
                    logger.warning("AI 增强跳过：未配置 API Key")
            except Exception as e:
                logger.error(f"AI 增强失败: {e}")
                # 增强失败时保留原始内容

        note = Note(
            title=data.title,
            content=content,
            tags=data.tags,
            raw_markdown=data.raw_markdown or content,
        )
        session.add(note)
        session.commit()
        session.refresh(note)
        return _note_to_dict(note)
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"创建笔记失败: {str(e)}")
    finally:
        session.close()


@router.put("/{note_id}")
async def update_note(note_id: str, data: NoteUpdate):
    """编辑笔记"""
    session = get_session()
    try:
        note = session.query(Note).filter(Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="笔记不存在")
        if data.title is not None:
            note.title = data.title
        if data.content is not None:
            note.content = data.content
            note.raw_markdown = data.content
        if data.tags is not None:
            note.tags = data.tags
        note.updated_at = datetime.now()
        session.commit()
        session.refresh(note)
        return _note_to_dict(note)
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"更新笔记失败: {str(e)}")
    finally:
        session.close()


@router.delete("/{note_id}")
async def delete_note(note_id: str):
    """删除笔记"""
    session = get_session()
    try:
        note = session.query(Note).filter(Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="笔记不存在")

        # 先解除关联的录课会话引用
        sessions = session.query(RecordingSession).filter(RecordingSession.note_id == note_id).all()
        for s in sessions:
            s.note_id = None
        session.flush()

        session.delete(note)
        session.commit()
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"删除笔记失败: {str(e)}")
    finally:
        session.close()


@router.get("/{note_id}/export")
async def export_note(note_id: str, format: str = "markdown"):
    """导出笔记（Markdown）"""
    session = get_session()
    try:
        note = session.query(Note).filter(Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="笔记不存在")
        content = note.raw_markdown or note.content
        return {"content": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出笔记失败: {str(e)}")
    finally:
        session.close()