# Note Generator Service
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class StructuredNote:
    title: str
    content: str
    summary: str


ENHANCEMENT_PROMPT = """你现在需要根据用户提供的内容，在整篇 Markdown 笔记最开头自动生成一张放射式思维导图，严格遵守以下规则：

1. 思维导图必须使用标准 mermaid mindmap 语法，仅输出可网页渲染的纯净代码，不解释、不额外文字、不报错格式。

2. 结构固定 三级结构：总主题 → 二级大模块 → 三级核心知识点。

3. 思维导图内容必须高度概括整篇笔记全文，提取重点框架，不冗余、不遗漏核心考点。

4. 样式为中心放射树状思维导图，适配网页端 Mermaid 渲染器，可直接在浏览器页面渲染显示。

5. 思维导图代码结束后，正常输出完整结构化 Markdown 笔记正文。

6. 禁止使用 graph 图表、禁止 ASCII 树、禁止普通标题列表，只允许 mindmap 放射脑图。

用户输入内容：
{user_content}"""


class NoteGenerator:
    def __init__(self, llm=None):
        self.llm = llm

    async def generate(self, content: str) -> StructuredNote:
        return StructuredNote(
            title="生成的笔记",
            content=content,
            summary="这是生成的笔记摘要"
        )

    def enhance_via_openai(self, api_key: str, base_url: str, model: str, title: str, content: str) -> dict:
        """直接调用 OpenAI 兼容 API 对笔记进行 AI 增强（含思维导图）"""
        import openai
        client = openai.OpenAI(api_key=api_key, base_url=base_url, timeout=120)

        prompt = ENHANCEMENT_PROMPT.format(user_content=content)

        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.7,
        )

        md_content = response.choices[0].message.content

        return {
            "title": title,
            "content": md_content,
        }