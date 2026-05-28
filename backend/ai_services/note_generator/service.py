# Note Generator Service
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class StructuredNote:
    title: str
    content: str
    summary: str


ENHANCEMENT_PROMPT = """你是一个专业的笔记整理助手。请根据用户提供的内容，严格按照下面的【输出格式模板】生成完整的 Markdown 笔记。

## 格式要求

1. 笔记包含三个部分，**缺一不可**：
   - 【思维导图】开头用 mermaid mindmap 语法生成放射式思维导图
   - 【结构化正文】中间输出结构化的 Markdown 笔记正文
   - 【知识总结】末尾输出知识总结

2. 各部分之间用 `---` 分隔符隔开。

3. 思维导图必须使用标准 mermaid mindmap 语法，仅输出可网页渲染的纯净代码，不解释、不额外文字。
   - 结构固定为三级：总主题 → 二级大模块 → 三级核心知识点
   - 内容高度概括全文，提取重点框架
   - 禁止使用 graph 图表、禁止 ASCII 树、禁止普通标题列表

4. 结构化正文必须包含：
   - 用 `##` 和 `###` 层级标题组织内容
   - 每个知识点包含：概念定义、关键要点
   - 使用 `-` 无序列表列出要点
   - 使用 `**` 加粗标记关键术语

5. 知识总结必须包含：
   - 全文核心知识点回顾
   - 知识点之间的联系
   - 学习建议或深入方向

## 输出格式模板（请严格按此格式输出）

```mermaid
mindmap
  root((主题))
    模块一
      知识点A
      知识点B
    模块二
      知识点C
      知识点D
```

---

## 模块一标题

### 知识点A

**关键术语**：定义说明

- 要点一
- 要点二

### 知识点B

**关键术语**：定义说明

- 要点一
- 要点二

---

## 模块二标题

### 知识点C

**关键术语**：定义说明

- 要点一
- 要点二

---

## 知识总结

### 核心回顾

- 知识点一总结
- 知识点二总结

### 联系与建议

- 知识点之间的联系
- 进一步学习方向

---

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