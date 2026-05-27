"""
OCR 图像识别模块 — 基于 RapidOCR (OnnxRuntime)
本地运行，完全免费，无需联网
首次使用会自动下载模型（约 200MB），后续秒开
"""
import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


def _run_ocr_sync(ocr: Any, image_input: str | bytes) -> list:
    """同步运行（给 asyncio.to_thread 用）
    RapidOCR 返回格式：(result, elapse)
    result: [[[bbox], text, confidence], ...] 或 None
    image_input: 文件路径或图片 bytes
    """
    result, _ = ocr(image_input)
    return result if result else []


@dataclass
class OCRResult:
    """单条 OCR 识别结果"""
    text: str
    confidence: float
    box: tuple[int, int, int, int] | None = None  # (x1, y1, x2, y2)
    timestamp_ms: int = 0


@dataclass
class OcrPageResult:
    """单张图片的完整 OCR 结果"""
    results: list[OCRResult] = field(default_factory=list)
    full_text: str = ""


class OCRService:
    """
    基于 RapidOCR (OnnxRuntime) 的图像文字识别

    用法：
        ocr = OCRService()
        page = await ocr.recognize_image("screenshot.png")
        print(page.full_text)

    特点：
    - 本地免费，无需联网
    - 基于 OnnxRuntime，不依赖 PaddlePaddle
    - 印刷体中文 ≥98%
    - 首次 ~5s（加载模型），后续 ~1s/张
    """

    def __init__(self):
        self._ocr = None
        self._init_error = None

    def _get_ocr(self):
        if self._init_error:
            raise Exception(f"OCR 初始化失败: {self._init_error}")

        if self._ocr is None:
            try:
                from rapidocr_onnxruntime import RapidOCR
                self._ocr = RapidOCR()
            except Exception as e:
                self._init_error = str(e)
                raise Exception(f"OCR 初始化失败: {e}")
        return self._ocr

    async def recognize_image(self, image_path: str, timestamp_ms: int = 0, is_bytes: bool = False) -> OcrPageResult:
        """识别单张图片中的文字"""
        if not is_bytes:
            path = Path(image_path)
            if not path.exists():
                logger.error(f"图片不存在: {image_path}")
                return OcrPageResult()

        ocr = self._get_ocr()
        raw = await asyncio.to_thread(_run_ocr_sync, ocr, image_path if is_bytes else str(path))

        if not raw:
            return OcrPageResult()

        results: list[OCRResult] = []
        for item in raw:
            # item = [[bbox], text, confidence]
            bbox_coords, text, confidence = item
            box = None
            if bbox_coords and len(bbox_coords) >= 4:
                xs = [p[0] for p in bbox_coords]
                ys = [p[1] for p in bbox_coords]
                box = (int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys)))

            results.append(OCRResult(text=text, confidence=confidence, box=box, timestamp_ms=timestamp_ms))

        results.sort(key=lambda r: (r.box[1], r.box[0]) if r.box else (0, 0))
        full_text = "\n".join(r.text for r in results)
        return OcrPageResult(results=results, full_text=full_text)

    async def recognize_images_batch(self, images: list[tuple[str, int]]) -> list[OcrPageResult]:
        """批量识别（并发）"""
        tasks = [self.recognize_image(path, ts) for path, ts in images]
        return await asyncio.gather(*tasks)