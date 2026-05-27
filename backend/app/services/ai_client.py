"""
后端调用 AI 服务的统一入口
"""
from ai_services.asr.service import ASRService, ASRSegment
from ai_services.ocr.service import OCRService, OCRResult, OcrPageResult
from ai_services.fusion.service import FusionService, KnowledgeUnit
from ai_services.note_generator.service import NoteGenerator, StructuredNote
from ai_services.review_planner.service import ReviewPlanner, ReviewTask, KnowledgePoint
from ai_services.rag.service import RAGService, QAResult
from ai_services.config import config


def _create_llm():
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=config.llm_model,
            api_key=config.llm_api_key,
            base_url=config.llm_base_url,
            temperature=config.llm_temperature,
        )
    except ImportError:
        return None


def _create_embedding():
    try:
        from langchain_openai import OpenAIEmbeddings
        if config.embedding_api_key and config.embedding_base_url:
            return OpenAIEmbeddings(
                model=config.embedding_model,
                api_key=config.embedding_api_key,
                base_url=config.embedding_base_url,
            )
        elif config.llm_api_key:
            return OpenAIEmbeddings(
                model=config.embedding_model,
                api_key=config.llm_api_key,
                base_url=config.llm_base_url,
            )
    except ImportError:
        pass
    return None


class AIClient:
    def __init__(self):
        self._llm = None
        self._embedding = None

        self.asr = ASRService(
            app_key=config.asr_app_key,
            access_key_id=config.asr_access_key_id,
            access_key_secret=config.asr_access_key_secret,
        )
        self.ocr = OCRService()
        self.fusion = FusionService()
        self.note_generator = NoteGenerator(llm=None)
        self.review_planner = ReviewPlanner()
        self.rag = RAGService(llm=None, embedding=None)

    @property
    def llm(self):
        if self._llm is None:
            self._llm = _create_llm()
        return self._llm

    @property
    def embedding(self):
        if self._embedding is None:
            self._embedding = _create_embedding()
        return self._embedding

    def _ensure_llm_injected(self):
        if self.note_generator.llm is None and self.llm is not None:
            self.note_generator.llm = self.llm
        if self.rag.llm is None and self.llm is not None:
            self.rag.llm = self.llm
        if self.rag.embedding is None and self.embedding is not None:
            self.rag.embedding = self.embedding

    async def transcribe_audio(self, audio_path: str) -> list[ASRSegment]:
        return await self.asr.transcribe_file(audio_path)

    async def recognize_screenshot(self, image_path: str) -> OcrPageResult:
        return await self.ocr.recognize_image(image_path)

    async def fuse_data(
        self, asr_segments: list[ASRSegment], ocr_results: list[OCRResult],
        timestamps: list[int],
    ) -> list[KnowledgeUnit]:
        return await self.fusion.fuse(asr_segments, ocr_results, timestamps)

    async def generate_note(self, units: list[KnowledgeUnit], title: str) -> StructuredNote:
        self._ensure_llm_injected()
        return await self.note_generator.generate(units, title)

    async def generate_review_plan(self, points: list[KnowledgePoint]) -> list[ReviewTask]:
        import datetime
        return await self.review_planner.generate_plan(points, datetime.datetime.now())

    async def ask_question(self, question: str) -> QAResult:
        self._ensure_llm_injected()
        return await self.rag.answer(question)

    async def index_note_for_rag(self, note_id: str, content: str) -> None:
        self._ensure_llm_injected()
        await self.rag.index_notes([content], [note_id])


ai_client = AIClient()