"""
ASR 语音识别模块 — 基于 faster-whisper（本地免费离线）
首次使用自动下载模型，small 模型约 488MB
"""
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

if not os.environ.get("HF_ENDPOINT"):
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "small"


@dataclass
class ASRSegment:
    start: float
    end: float
    text: str


class ASRService:
    """
    基于 faster-whisper 的本地语音识别

    用法:
        asr = ASRService(model_size="small")
        text = await asr.recognize("audio.mp3")
    特点:
    - 本地免费，无需联网
    - 首次运行自动下载模型
    - 支持中英文混合识别
    """

    def __init__(self, app_key=None, access_key_id=None, access_key_secret=None,
                 model_size: str = _DEFAULT_MODEL):
        self._model = None
        self._model_size = model_size

    def _get_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel
            logger.info(f"正在加载 Whisper 模型 ({self._model_size})，镜像: {os.environ.get('HF_ENDPOINT', '默认')}，首次运行需下载...")
            self._model = WhisperModel(
                self._model_size,
                device="cpu",
                compute_type="int8",
            )
            logger.info(f"Whisper 模型加载完成")
        return self._model

    async def recognize(self, audio_path: str,
                        progress_cb: Optional[Callable[[int, str], None]] = None) -> str:
        segments = await self.transcribe_file(audio_path, progress_cb)
        return " ".join(s.text for s in segments) if segments else ""

    async def transcribe_file(self, audio_path: str,
                              progress_cb: Optional[Callable[[int, str], None]] = None) -> list[ASRSegment]:
        path = Path(audio_path)
        if not path.exists():
            logger.error(f"音频文件不存在: {audio_path}")
            return []

        if path.stat().st_size == 0:
            logger.error(f"音频文件为空: {audio_path}")
            return []

        try:
            import asyncio
            segments, info = await asyncio.to_thread(
                self._transcribe_sync_wrapped, str(path), progress_cb
            )
            logger.info(
                f"ASR 完成: 语言={info.language}, "
                f"时长={info.duration:.1f}s, "
                f"段数={len(segments)}"
            )
            return segments
        except Exception as e:
            logger.error(f"ASR 识别失败: {e}")
            return []

    def _transcribe_sync_wrapped(self, audio_path: str,
                                 progress_cb: Optional[Callable[[int, str], None]] = None
                                 ) -> tuple[list[ASRSegment], object]:
        model = self._get_model()
        raw_segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=None,
        )
        total_duration = info.duration
        result = []
        last_progress = 0

        for s in raw_segments:
            result.append(ASRSegment(start=s.start, end=s.end, text=s.text.strip()))
            if progress_cb and total_duration > 0:
                pct = min(int(s.end / total_duration * 100), 99)
                if pct > last_progress:
                    last_progress = pct
                    progress_cb(pct, f"转写中... {s.text.strip()[:30]}...")

        if progress_cb:
            progress_cb(100, "转写完成")
        return result, info
