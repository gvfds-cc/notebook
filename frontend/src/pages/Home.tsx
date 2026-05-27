import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { notesAPI, reviewAPI } from '../api'
import './Home.css'

const features = [
  {
    id: 'notes',
    title: '笔记管理',
    subtitle: '整理你的知识库',
    icon: '📝',
    description: '创建、编辑、搜索笔记，支持 Markdown 语法，让你的笔记清晰美观',
    route: '/notes',
    color: '#bdcfa2',
  },
  {
    id: 'record',
    title: '录课采集',
    subtitle: '音视频转笔记',
    icon: '🎙️',
    description: '录制课程或上传音视频，AI 自动识别语音并生成结构化笔记',
    route: '/record',
    color: '#ddb480',
  },
  {
    id: 'review',
    title: '复习计划',
    subtitle: '科学记忆曲线',
    icon: '🗂️',
    description: '基于艾宾浩斯遗忘曲线，智能安排复习时间和内容',
    route: '/review',
    color: '#c9b8d4',
    stackable: true,
  },
  {
    id: 'qa',
    title: '智能问答',
    subtitle: '知识库检索',
    icon: '💬',
    description: '基于笔记内容进行问答，AI 帮你快速找到需要的知识点',
    route: '/qa',
    color: '#a8c9d4',
  },
  {
    id: 'ocr',
    title: 'PPT 识别',
    subtitle: '幻灯片文字提取',
    icon: '📊',
    description: '上传 PPT 文件，自动提取幻灯片中的文字内容，支持 AI 增强生成笔记',
    route: '/ocr',
    color: '#d4c9a8',
  },
  {
    id: 'settings',
    title: '系统设置',
    subtitle: '个性化配置',
    icon: '⚙️',
    description: '配置 API 密钥、选择 AI 模型、调整识别参数',
    route: '/settings',
    color: '#d4a8a8',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<any[]>([])

  useEffect(() => {
    notesAPI.list().then(res => {
      setNotes(res.data.slice(0, 10))
    }).catch(() => {})

    // 首次打开，如果没有复习数据则自动生成示例
    const seeded = sessionStorage.getItem('seed_demo_done')
    if (!seeded) {
      reviewAPI.list().then(res => {
        if (res.data.length === 0) {
          reviewAPI.seedSample().catch(() => {})
        }
        sessionStorage.setItem('seed_demo_done', '1')
      }).catch(() => {})
    }
  }, [])

  // 复制笔记列表用于无缝滚动 - 上排向右
  const duplicatedNotesRight = [...notes, ...notes]
  // 下排向左，所以逆序复制
  const duplicatedNotesLeft = [...[...notes].reverse(), ...[...notes].reverse()]

  return (
    <div className="home">
      <header className="home-header">
        <h1 className="home-title">多模态智能笔记助手</h1>
        <p className="home-subtitle">让知识学习更高效，让复习更科学</p>
      </header>

      <section className="features-grid">
        {features.map((feature, index) => (
          <div
            key={feature.id}
            className={`feature-card ${feature.stackable ? 'feature-card-review' : ''}`}
            style={{
              '--accent-color': feature.color,
              '--delay': `${index * 0.08}s`,
            } as React.CSSProperties}
            onClick={() => navigate(feature.route)}
          >
            <div className="card-glow" />

            <div className="card-content">
              <div className="card-icon">{feature.icon}</div>
              <div className="card-text">
                <h2 className="card-title">{feature.title}</h2>
                <p className="card-subtitle">{feature.subtitle}</p>
                <p className="card-description">{feature.description}</p>
              </div>
            </div>

            <div className="card-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        ))}
      </section>

      {/* 笔记轮播 - 两行双向滚动 */}
      <section className="notes-carousel-section">
        <div className="carousel-container">
          {/* 上排 - 向右滚动 */}
          <div className="carousel-track carousel-track-right">
            {notes.length > 0 ? duplicatedNotesRight.map((note, index) => (
                <div
                  key={`right-${note.id}-${index}`}
                  className="carousel-card"
                  onClick={() => navigate('/notes')}
                >
                  <div className="carousel-card-icon">📝</div>
                  <div className="carousel-card-content">
                    <h4 className="carousel-card-title">{note.title}</h4>
                    <p className="carousel-card-meta">
                      {note.tags?.join(' · ') || '无标签'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="carousel-card-placeholder">暂无笔记</div>
              )}
            </div>
            {/* 下排 - 向左滚动 */}
            <div className="carousel-track carousel-track-left">
              {notes.length > 0 ? duplicatedNotesLeft.map((note, index) => (
                <div
                  key={`left-${note.id}-${index}`}
                  className="carousel-card"
                  onClick={() => navigate('/notes')}
                >
                  <div className="carousel-card-icon">📝</div>
                  <div className="carousel-card-content">
                    <h4 className="carousel-card-title">{note.title}</h4>
                    <p className="carousel-card-meta">
                      {note.tags?.join(' · ') || '无标签'}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="carousel-card-placeholder">暂无笔记</div>
              )}
            </div>
          </div>
        </section>

      <footer className="home-footer">
        <p>点击任意卡片进入对应功能</p>
      </footer>
    </div>
  )
}
