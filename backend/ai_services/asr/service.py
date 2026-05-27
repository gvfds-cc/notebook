# ASR Service
from dataclasses import dataclass
from typing import List

@dataclass
class ASRSegment:
    start: float
    end: float
    text: str

class ASRService:
    def __init__(self, app_key=None, access_key_id=None, access_key_secret=None):
        pass

    async def recognize(self, audio_path: str) -> str:
        return "[ASR 未配置]"
