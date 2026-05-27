# 多模态智能笔记助手

基于 AI 的全能笔记管理系统，支持语音转笔记、图片/PPT/PDF 文字识别、AI 增强笔记生成、智能问答以及艾宾浩斯复习计划管理。

---

## 应用场景

### 学生听课
- 上课时用**录课采集**功能录制音频，课后一键转为结构化笔记
- AI 自动生成放射式思维导图（Mermaid mindmap），辅助理解知识框架
- 系统基于**艾宾浩斯遗忘曲线**制定复习计划，科学安排复习时间

### 会议记录
- 录制会议音频，自动识别语音内容
- OCR 识别投屏 PPT 截图中的文字，与语音融合生成完整会议纪要

### 资料整理
- 上传 PPT/PDF/图片，自动提取文字内容
- 对杂乱的笔记使用 **AI 增强**，自动整理结构和生成思维导图
- 基于笔记内容的 **RAG 智能问答**，快速定位知识点

### 考前复习
- 系统自动生成复习计划，按紧急/普通/即将到来分级
- 支持进度追踪，完成复习后标记完成

---

## 功能特性

| 功能模块 | 说明 |
|---------|------|
| 笔记管理 | 创建/编辑/搜索/批量删除笔记，支持 Markdown + 标签分类 |
| AI 增强 | 新建笔记时一键增强，自动生成思维导图 + 结构化正文 |
| 录课采集 | 音视频录制 + 自动语音识别(ASR) + 视频帧 OCR → AI 生成笔记 |
| OCR 识别 | 图片/PPT/PDF 文字提取（基于 RapidOCR 本地运行，免费离线） |
| 智能问答 | 基于笔记内容的 RAG 多轮对话问答 |
| 复习计划 | 基于艾宾浩斯遗忘曲线，三级优先级 + 进度追踪 |
| 系统设置 | 可视化配置 LLM / Embedding / ASR 参数 |

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│               Frontend (React 18 + TS)           │
│  Vite 5173 → 代理 → Backend 8002                 │
└────────────────────┬────────────────────────────┘
                     │ HTTP API
┌────────────────────▼────────────────────────────┐
│               Backend (FastAPI + Python 3.13)    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ API 路由  │ │ 数据库   │ │  AI 服务层        │ │
│  │ notes.py │ │ SQLite   │ │  ├─ LLM (DeepSeek)│ │
│  │ record.py│ │ SQLAlchmy│ │  ├─ OCR (RapidOCR)│ │
│  │ review.py│ │          │ │  ├─ ASR (阿里云)  │ │
│  │ qa.py    │ │          │ │  ├─ RAG (向量检索) │ │
│  │ ocr.py   │ │          │ │  └─ 复习规划      │ │
│  │ settings │ │          │ │                   │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite 5
- **路由**: React Router v6
- **HTTP**: Axios
- **Markdown**: react-markdown + remark-gfm
- **思维导图**: Mermaid.js (mindmap)
- **样式**: CSS Variables + Neumorphism 森系风格

### 后端
- **框架**: FastAPI + Uvicorn
- **数据库**: SQLite (SQLAlchemy ORM)
- **AI 服务**:
  - LLM: OpenAI 兼容接口（默认 DeepSeek V4-Flash）
  - Embedding: BAAI/bge-large-zh-v1.5（本地运行）
  - OCR: RapidOCR OnnxRuntime（本地免费离线）
  - ASR: 阿里云语音识别（可选）
- **向量检索**: RAG (本地 Embedding + 余弦相似度)

---

## 快速开始

### 环境要求

| 依赖 | 最低版本 |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

### 1. 克隆并配置

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```ini
# 必填 — LLM 配置（DeepSeek 推荐）
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-your-api-key-here
LLM_BASE_URL=https://api.deepseek.com/v1

# Embedding 模型（本地运行，无需 API Key）
EMBEDDING_MODEL=BAAI/bge-large-zh-v1.5

# ASR（可选，不配则录课采集的语音识别功能不可用）
ASR_APP_KEY=
ASR_ACCESS_KEY_ID=
ASR_ACCESS_KEY_SECRET=
```

### 2. 安装依赖

**后端**
```bash
cd backend
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**前端**
```bash
cd frontend
npm install
```

### 3. 启动服务

#### 方式一：一键启动（推荐）
```bash
双击运行项目根目录下的「一键启动.bat」
```

#### 方式二：分别启动

终端 1 — 启动后端（端口 8002）：
```bash
cd backend
python run.py
```

终端 2 — 启动前端（端口 5173）：
```bash
cd frontend
npm run dev
```

### 4. 访问应用

打开浏览器访问 **http://localhost:5173**

---

## 生产部署

### 后端部署

使用 Gunicorn + Uvicorn workers：

```bash
cd backend
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8002
```

或使用 Docker（需自行编写 Dockerfile）：

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY backend/ .
RUN pip install -r requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
```

### 前端部署

```bash
cd frontend
npm run build
```

将 `dist/` 目录部署到 Nginx / Vercel / Netlify。

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/frontend/dist;
    index index.html;

    location /api {
        proxy_pass http://127.0.0.1:8002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Docker Compose 一键部署

```yaml
version: '3'
services:
  backend:
    build: ./backend
    ports:
      - "8002:8002"
    env_file: .env
    volumes:
      - ./backend/smart_notes.db:/app/smart_notes.db
    restart: always

  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - backend
    restart: always
```

---

## 项目结构

```
smart-notes/
├── backend/
│   ├── app/
│   │   ├── api/                  # API 路由层
│   │   │   ├── notes.py          #   笔记 CRUD + AI 增强
│   │   │   ├── record.py         #   录课采集 + ASR
│   │   │   ├── review.py         #   复习计划
│   │   │   ├── qa.py             #   智能问答
│   │   │   ├── ocr_demo.py       #   OCR 识别演示
│   │   │   └── settings.py       #   系统设置
│   │   ├── core/config.py        #   核心配置
│   │   ├── models/
│   │   │   ├── database.py       #   数据库模型
│   │   │   └── schemas.py        #   Pydantic 请求/响应模型
│   │   ├── services/ai_client.py #   AI 服务统一入口
│   │   └── main.py               #   FastAPI 主入口
│   ├── ai_services/              #   AI 服务模块
│   │   ├── asr/service.py        #   语音识别（阿里云）
│   │   ├── ocr/service.py        #   文字识别（RapidOCR）
│   │   ├── fusion/service.py     #   多模态融合
│   │   ├── note_generator/       #   笔记生成（LLM）
│   │   ├── rag/service.py        #   RAG 问答
│   │   └── review_planner/       #   复习规划
│   ├── uploads/                  #   运行时上传文件
│   ├── requirements.txt
│   ├── run.py                    #   开发启动脚本
│   └── smart_notes.db            #   SQLite 数据库
├── frontend/
│   ├── src/
│   │   ├── pages/                #   页面（Home / Notes / Record / OCR / QA / Review / Settings）
│   │   ├── components/           #   公共组件
│   │   │   └── MarkdownContent.tsx
│   │   ├── api.ts                #   API 调用
│   │   ├── App.tsx               #   路由配置
│   │   ├── main.tsx              #   入口
│   │   └── index.css             #   全局样式
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── .env                          #   环境变量（已配置）
├── .env.example                  #   环境变量模板
└── 一键启动.bat                    #   一键启动脚本
```

---

## 配置指南

### LLM 配置

在系统设置页面或 `.env` 文件中配置：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `LLM_MODEL` | 模型名称 | `deepseek-chat` |
| `LLM_API_KEY` | API Key | — |
| `LLM_BASE_URL` | API 地址 | `https://api.deepseek.com/v1` |

兼容任何 OpenAI 格式的 API，如 DeepSeek、智谱、通义千问、OpenAI 等。

### Embedding 配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `EMBEDDING_MODEL` | 模型名称 | `BAAI/bge-large-zh-v1.5` |

默认使用本地模型（首次运行自动下载），也可配置为 OpenAI 兼容的 Embedding API。

### ASR 配置（可选）

需要阿里云语音识别服务：

| 参数 | 说明 |
|------|------|
| `ASR_APP_KEY` | 阿里云 AppKey |
| `ASR_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ASR_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |

---

## 使用指南

### 笔记管理
进入「笔记」页面，可进行：
- **新建笔记**：输入标题和内容（Markdown），勾选「AI 增强」自动生成思维导图
- **编辑笔记**：点击笔记卡片的编辑按钮
- **搜索笔记**：按标题或内容关键词搜索
- **批量删除**：多选后点击删除

### 录课采集
进入「录课采集」页面：
1. 点击「开始录制」按钮（麦克风图标）
2. 结束录制后点击「停止」
3. 点击「处理」→ 系统自动完成 ASR 识别 + 笔记生成
4. 处理完成后跳转到笔记页面查看

### OCR 识别
进入「PPT 识别」页面：
1. 拖拽或点击上传 PPT / PDF / 图片
2. 自动提取文字内容
3. 点击「转为笔记」一键创建结构化笔记

### 智能问答
进入「智能问答」页面：
- 输入问题，AI 基于已有笔记内容回答
- 支持多轮连续对话
- 回答以 Markdown 格式呈现

### 复习计划
进入「复习计划」页面：
- 查看按优先级分组（紧急/普通/即将到来）的复习任务
- 点击任务展开详情
- 完成复习后点击「标记完成」更新进度

### 系统设置
进入「系统设置」页面：
- 可视化配置 LLM / Embedding / ASR 参数
- 配置后自动保存，无需重启

---

## 数据库

默认使用 SQLite，文件位于 `backend/smart_notes.db`。

### 主要表结构

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `notes` | 笔记 | id, title, content, tags, created_at, updated_at |
| `recording_sessions` | 录音会话 | id, audio_path, status, created_at |
| `knowledge_points` | 知识点 | id, note_id, content, importance |
| `review_plans` | 复习计划 | id, knowledge_point_id, review_date, status |

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/notes/` | 创建笔记（支持 `ai_enhanced`） |
| GET | `/api/notes/` | 获取笔记列表 |
| PUT | `/api/notes/{id}` | 更新笔记 |
| DELETE | `/api/notes/` | 批量删除笔记 |
| GET | `/api/notes/search?q=` | 搜索笔记 |
| POST | `/api/record/upload` | 上传录音文件 |
| POST | `/api/record/sessions/{id}/process` | 处理录音 |
| GET | `/api/review/` | 获取复习计划 |
| POST | `/api/review/{id}/complete` | 标记复习完成 |
| POST | `/api/qa/ask` | 智能问答 |
| POST | `/api/ocr/demo` | OCR 识别 |
| POST | `/api/ocr/to-note` | OCR 结果转笔记 |
| GET | `/api/settings` | 获取系统设置 |
| POST | `/api/settings` | 保存系统设置 |

---

## 常见问题

### AI 增强不生效？
检查「系统设置」中是否已配置 **LLM API Key**。只有勾选「AI 增强」且内容不为空时才会触发。

### OCR 识别慢？
首次运行 RapidOCR 需要下载模型（约 200MB），后续使用秒级响应。

### 录课采集的 ASR 不工作？
ASR 需要阿里云语音识别服务，未配置时处理会跳过语音识别步骤。

### 端口被占用？
修改 `backend/run.py` 和 `frontend/vite.config.ts` 中的端口号，保持前后端端口对应。

---

## License

MIT