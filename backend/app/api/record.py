"""
录课采集 API — 控制录音、截图、触发 ASR/OCR
"""
import uuid
import os
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from app.models.database import RecordingSession, Note, KnowledgePoint, ReviewPlan, get_session
from app.models.schemas import RecordingSessionCreate, RecordingSessionResponse
from app.services.ai_client import AIClient
import threading

router = APIRouter()
ai_client = AIClient()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "../../uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 艾宾浩斯复习间隔（分钟）
REVIEW_INTERVALS = [5, 30, 720, 1440, 2880, 5760, 10080, 21600]

# 处理超时阈值（分钟）
PROCESSING_TIMEOUT_MINUTES = 3

# 异步任务存储（线程安全）
_task_lock = threading.Lock()
_background_tasks: Dict[str, asyncio.Task] = {}


def reset_stuck_sessions():
    """重置卡住的 processing 状态会话（超过3分钟仍为 processing 的视为卡住）"""
    session = get_session()
    try:
        timeout_threshold = datetime.now() - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)
        stuck = session.query(RecordingSession).filter(
            RecordingSession.status == "processing",
            (RecordingSession.processing_started_at < timeout_threshold) | (RecordingSession.processing_started_at == None),
        ).all()
        for s in stuck:
            print(f"[Reset] 重置卡住的会话 {s.id} ({s.title})，处理开始于 {s.processing_started_at}")
            s.status = "pending"
            s.processing_started_at = None
        if stuck:
            session.commit()
            print(f"[Reset] 已重置 {len(stuck)} 个卡住的会话")
        return len(stuck)
    except Exception as e:
        session.rollback()
        print(f"[Reset] 重置失败: {e}")
        return 0
    finally:
        session.close()


async def _process_session_task(session_id: str):
    """
    后台处理任务：在独立的事件循环中执行
    这样可以确保 HTTP 请求立即返回，而处理继续在后台进行
    """
    from app.main import app as fastapi_app
    
    # 创建独立的事件循环来执行异步任务
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # 获取事件循环中运行的处理函数
        await _execute_processing(session_id)
    except Exception as e:
        print(f"[Background Task Error] 会话 {session_id} 处理失败: {e}")
    finally:
        # 清理任务记录
        with _task_lock:
            if session_id in _background_tasks:
                del _background_tasks[session_id]
        loop.close()
        
        # 尝试关闭事件循环
        try:
            pending = asyncio.all_tasks(loop)
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        except:
            pass


def _session_to_response(session: RecordingSession) -> RecordingSessionResponse:
    return RecordingSessionResponse(
        id=session.id,
        title=session.title,
        audio_path=session.audio_path,
        screenshots=session.screenshots or [],
        asr_result=session.asr_result,
        ocr_result=session.ocr_result,
        fused_data=session.fused_data,
        note_id=session.note_id,
        status=session.status,
        progress=session.progress,
        progress_message=session.progress_message,
        created_at=session.created_at,
        processed_at=session.processed_at,
        processing_started_at=session.processing_started_at,
    )


@router.post("/start", response_model=RecordingSessionResponse)
async def start_recording(data: RecordingSessionCreate = None):
    """开始录课"""
    session = get_session()
    try:
        record_session = RecordingSession(
            title=data.title if data and data.title else f"录课_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            status="recording",
        )
        session.add(record_session)
        session.commit()
        session.refresh(record_session)
        return _session_to_response(record_session)
    finally:
        session.close()


@router.post("/stop/{session_id}", response_model=RecordingSessionResponse)
async def stop_recording(session_id: str):
    """停止录课"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")
        record_session.status = "pending"
        session.commit()
        session.refresh(record_session)
        return _session_to_response(record_session)
    finally:
        session.close()


@router.post("/{session_id}/upload")
async def upload_audio(session_id: str, file: UploadFile = File(...)):
    """上传录制的音频文件"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")

        ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        filename = f"{session_id}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)

        record_session.audio_path = filename
        session.commit()
        return {"message": "上传成功", "audio_path": filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
    finally:
        session.close()


class TranscriptInput(BaseModel):
    text: str


@router.post("/{session_id}/transcript")
async def save_transcript(session_id: str, data: TranscriptInput):
    """保存浏览器语音识别结果"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")
        record_session.asr_result = data.text
        session.commit()
        return {"message": "保存成功", "length": len(data.text)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")
    finally:
        session.close()


class ImportAudioInput(BaseModel):
    title: Optional[str] = None
    transcript: Optional[str] = None


@router.post("/import-audio", response_model=RecordingSessionResponse)
async def import_audio(file: UploadFile = File(...), transcript: str = Form(""), title: str = Form("")):
    """导入外部音频文件进行识别处理"""
    session = get_session()
    try:
        ext = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
        record_session = RecordingSession(
            title=title or f"导入音频_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            status="pending",
        )
        session.add(record_session)
        session.flush()

        filename = f"{record_session.id}{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)

        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)

        record_session.audio_path = filename

        if transcript:
            record_session.asr_result = transcript

        session.commit()
        session.refresh(record_session)
        return _session_to_response(record_session)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    finally:
        session.close()


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """删除录课会话"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")

        # 删除关联的音频文件
        if record_session.audio_path:
            audio_file = os.path.join(UPLOAD_DIR, record_session.audio_path)
            if os.path.exists(audio_file):
                os.remove(audio_file)

        # 直接删除（数据库已配置级联删除）
        session.delete(record_session)
        session.commit()
        return {"message": "删除成功"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
    finally:
        session.close()


@router.get("/{session_id}", response_model=RecordingSessionResponse)
async def get_session_info(session_id: str):
    """获取录课会话详情"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")
        return _session_to_response(record_session)
    finally:
        session.close()


@router.get("/", response_model=list[RecordingSessionResponse])
async def list_sessions():
    """获取所有录课会话"""
    reset_stuck_sessions()
    session = get_session()
    try:
        sessions = session.query(RecordingSession).order_by(RecordingSession.created_at.desc()).all()
        return [_session_to_response(s) for s in sessions]
    finally:
        session.close()


@router.post("/reset-stuck")
async def reset_stuck():
    """手动重置所有卡住的 processing 会话"""
    count = reset_stuck_sessions()
    return {"message": f"已重置 {count} 个卡住的会话"}


def _update_progress(session, record_session, progress: int, message: str):
    """更新进度到数据库"""
    try:
        record_session.progress = progress
        record_session.progress_message = message
        session.commit()
        print(f"[Progress] {progress}% - {message}")
    except Exception as e:
        print(f"[Progress Error] {e}")


async def _execute_processing(session_id: str):
    """
    执行录课处理的核心逻辑（在后台任务中运行）
    """
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            print(f"[Processing] 会话 {session_id} 不存在")
            return

        _update_progress(session, record_session, 1, "正在准备...")

        api_key = _get_config(session, "llm_api_key")
        base_url = _get_config(session, "llm_base_url") or "https://api.deepseek.com/v1"
        model = _get_config(session, "llm_model") or "deepseek-chat"

        if not api_key:
            print(f"[Processing] 会话 {session_id} 缺少 API Key")
            record_session.status = "failed"
            record_session.progress = 0
            record_session.progress_message = "缺少 API Key"
            record_session.processing_started_at = None
            record_session.fused_data = "处理失败：未配置 API Key，请在「系统设置」中配置 LLM API Key"
            session.commit()
            return

        asr_text = record_session.asr_result or ""
        ocr_text = record_session.ocr_result or ""

        # 如果有音频文件但没有文字稿，尝试 ASR 转录
        if not asr_text.strip() and record_session.audio_path:
            audio_file = os.path.join(UPLOAD_DIR, record_session.audio_path)
            if os.path.exists(audio_file):
                try:
                    _update_progress(session, record_session, 10, "正在识别音频内容...")
                    from ai_services.asr.service import ASRService

                    def asr_progress(pct: int, msg: str):
                        mapped = 5 + int(pct * 0.35)
                        _update_progress(session, record_session, mapped, msg)

                    asr = ASRService(model_size="small")
                    asr_text = await asr.recognize(audio_file, progress_cb=asr_progress)
                    record_session.asr_result = asr_text
                    session.commit()
                    print(f"[Processing] Whisper 识别完成，{len(asr_text)} 字符")
                except Exception as asr_err:
                    print(f"[Processing] Whisper 识别失败: {asr_err}")
                    _update_progress(session, record_session, 40, "转写完成（部分可能缺失）")
            else:
                print(f"[Processing] 音频文件不存在: {audio_file}")

        full_text = (asr_text + "\n" + ocr_text).strip()

        if not full_text:
            reason = "处理失败：没有可处理的文字内容"
            if record_session.audio_path and not asr_text.strip():
                reason += "。导入了音频但未提供文字稿，且本地语音识别未能提取到文字内容"
            else:
                reason += "。请先录制音频或输入文字内容"
            print(f"[Processing] 会话 {session_id} 没有内容可处理")
            record_session.status = "failed"
            record_session.progress = 0
            record_session.progress_message = "没有可处理的内容"
            record_session.processing_started_at = None
            record_session.fused_data = reason
            session.commit()
            return

        print(f"[Processing] 开始处理会话 {session_id}，内容长度: {len(full_text)} 字")

        _update_progress(session, record_session, 45, "正在 AI 生成笔记...")

        try:
            import openai
            client = openai.OpenAI(api_key=api_key, base_url=base_url, timeout=120)

            prompt = f"""你现在需要根据用户提供的录音转文字内容，在整篇 Markdown 笔记最开头自动生成一张放射式思维导图，严格遵守以下规则：

1. 思维导图必须使用标准 mermaid mindmap 语法，仅输出可网页渲染的纯净代码，不解释、不额外文字、不报错格式。

2. 结构固定 三级结构：总主题 → 二级大模块 → 三级核心知识点。

3. 思维导图内容必须高度概括整篇笔记全文，提取重点框架，不冗余、不遗漏核心考点。

4. 样式为中心放射树状思维导图，适配网页端 Mermaid 渲染器，可直接在浏览器页面渲染显示。

5. 思维导图代码结束后，正常输出完整结构化 Markdown 笔记正文。

6. 禁止使用 graph 图表、禁止 ASCII 树、禁止普通标题列表，只允许 mindmap 放射脑图。

用户输入内容：
{full_text}"""

            _update_progress(session, record_session, 50, "正在等待 AI 响应...")
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=4000,
                temperature=0.7,
            )
            md_content = response.choices[0].message.content
            _update_progress(session, record_session, 80, "AI 生成完成，正在保存...")
        except Exception as ai_err:
            err_msg = str(ai_err)
            print(f"[AI Error] 会话 {session_id}: {err_msg}")
            lines = [l.strip() for l in full_text.split("\n") if l.strip()]
            points = "\n".join([f"{i+1}. {line}" for i, line in enumerate(lines)])
            md_content = f"""# {record_session.title or '录课笔记'}

## 核心内容

{points}

## AI增强说明

> AI 增强暂不可用（{err_msg}），已保留原始转录内容。
"""

        record_session.fused_data = md_content

        note = Note(
            title=record_session.title or "录课生成",
            content=md_content,
            tags=["录课"],
            raw_markdown=md_content,
        )
        session.add(note)
        session.flush()

        record_session.note_id = note.id
        record_session.status = "completed"
        record_session.progress = 100
        record_session.progress_message = "处理完成"
        record_session.processing_started_at = None
        record_session.processed_at = datetime.now()
        session.commit()

        _update_progress(session, record_session, 95, "正在生成复习计划...")
        _generate_review_plan(session, note.id, md_content)
        _update_progress(session, record_session, 100, "处理完成")

        print(f"[Processing] 会话 {session_id} 处理完成，笔记 ID: {note.id}")

    except Exception as e:
        err_msg = str(e)
        print(f"[Processing Error] 会话 {session_id}: {err_msg}")
        try:
            if 'record_session' in locals() and record_session:
                record_session.status = "failed"
                record_session.progress = 0
                record_session.progress_message = f"处理失败: {err_msg[:100]}"
                record_session.processing_started_at = None
                record_session.fused_data = f"处理失败：{err_msg}"
                session.commit()
        except:
            pass
    finally:
        session.close()


@router.post("/process/{session_id}")
async def process_session(session_id: str):
    """
    启动后台处理任务并立即返回
    处理会在独立的事件循环中异步执行
    """
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")

        # 检查是否已经在处理中
        if record_session.status == "processing":
            with _task_lock:
                if session_id in _background_tasks:
                    task = _background_tasks[session_id]
                    if not task.done():
                        return {
                            "message": "处理已在后台进行中",
                            "status": "processing",
                            "session_id": session_id
                        }
                    # 任务已完成但状态未更新，视为新处理
                    
        record_session.status = "processing"
        record_session.processing_started_at = datetime.now()
        # 清空旧的处理结果，准备重新处理
        record_session.processed_at = None
        record_session.note_id = None
        session.commit()
        session.refresh(record_session)

        # 在独立线程中启动后台任务
        import concurrent.futures
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        
        def run_async_processing():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(_execute_processing(session_id))
                finally:
                    loop.close()
            except Exception as e:
                print(f"[Thread Error] 会话 {session_id}: {e}")

        executor.submit(run_async_processing)
        executor.shutdown(wait=False)

        return {
            "message": "处理已启动，将在后台完成",
            "status": "processing",
            "session_id": session_id,
            "started_at": record_session.processing_started_at.isoformat() if record_session.processing_started_at else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动处理失败: {str(e)}")
    finally:
        session.close()


@router.get("/task-status/{session_id}")
async def get_task_status(session_id: str):
    """查询后台任务状态"""
    session = get_session()
    try:
        record_session = session.query(RecordingSession).filter(RecordingSession.id == session_id).first()
        if not record_session:
            raise HTTPException(status_code=404, detail="录课会话不存在")

        is_processing = False
        with _task_lock:
            if session_id in _background_tasks:
                is_processing = not _background_tasks[session_id].done()

        return {
            "session_id": session_id,
            "status": record_session.status,
            "is_processing": is_processing,
            "progress": record_session.progress,
            "progress_message": record_session.progress_message,
            "processing_started_at": record_session.processing_started_at.isoformat() if record_session.processing_started_at else None,
            "processed_at": record_session.processed_at.isoformat() if record_session.processed_at else None,
            "note_id": record_session.note_id,
            "fused_data": record_session.fused_data,
        }
    finally:
        session.close()


def _get_config(session, key: str) -> str | None:
    from app.models.database import UserConfig
    config = session.query(UserConfig).filter(UserConfig.key == key).first()
    return config.value if config else None


def _generate_review_plan(session, note_id: str, content: str):
    """根据笔记内容生成艾宾浩斯复习计划"""
    try:
        # 提取知识点（简单按句子分割）
        lines = [l.strip() for l in content.split('\n') if len(l.strip()) > 10]
        for i, line in enumerate(lines[:8]):  # 最多8个知识点
            kp = KnowledgePoint(
                note_id=note_id,
                content=line[:200],
                source="record",
            )
            session.add(kp)
            session.flush()

            # 为每个知识点创建艾宾浩斯复习计划
            base_time = datetime.now()
            for j, interval in enumerate(REVIEW_INTERVALS):
                plan = ReviewPlan(
                    knowledge_id=kp.id,
                    note_id=note_id,
                    title=f"复习 {line[:30]}...",
                    scheduled_time=base_time + timedelta(minutes=interval),
                    interval_label=_get_interval_label(j),
                    status="pending",
                )
                session.add(plan)

        session.commit()
    except Exception:
        session.rollback()


def _get_interval_label(index: int) -> str:
    labels = ["立即", "5分钟", "30分钟", "12小时", "1天", "2天", "4天", "7天", "15天"]
    return labels[index] if index < len(labels) else f"{index}天"
