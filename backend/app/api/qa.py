"""智能问答 API — 基于 RAG"""
from fastapi import APIRouter, HTTPException
from app.models.database import Note, get_session
from app.models.schemas import QARequest, QAResponse

router = APIRouter()


@router.post("/ask", response_model=QAResponse)
async def ask_question(req: QARequest):
    """向知识库提问"""
    session = get_session()
    try:
        # 搜索相关笔记
        notes = session.query(Note).filter(
            Note.content.contains(req.question) | Note.title.contains(req.question)
        ).limit(5).all()

        if not notes:
            return QAResponse(
                question=req.question,
                answer="在知识库中未找到相关内容，请尝试其他问题或先创建笔记。",
                sources=[],
            )

        # 简单拼接相关笔记内容作为上下文
        context_parts = [f"## {n.title}\n{n.content[:500]}" for n in notes]
        context = "\n\n".join(context_parts)

        # TODO: 调用 RAG 服务获取更精准的答案
        # answer = await rag_service.ask(req.question, context)

        answer = f"根据知识库中的笔记，您的问题可能与以下内容相关：\n\n{context[:500]}..."

        return QAResponse(
            question=req.question,
            answer=answer,
            sources=[n.id for n in notes],
        )
    finally:
        session.close()
