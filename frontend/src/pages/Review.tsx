import { useState, useEffect, useRef } from 'react'
import { reviewAPI, notesAPI, ReviewTask, Note } from '../api'
import MarkdownContent from '../components/MarkdownContent'
import './Review.css'

// 计算复习优先级
function getPriority(task: ReviewTask): 'urgent' | 'normal' | 'low' {
  const now = new Date().getTime()
  const scheduled = new Date(task.scheduled_time).getTime()
  
  // 如果 scheduled_time 无效，返回 'low'
  if (isNaN(scheduled)) return 'low'
  
  const diffHours = (scheduled - now) / (1000 * 60 * 60)
  
  if (diffHours < 0 || diffHours < 24) return 'urgent'
  if (diffHours < 72) return 'normal'
  return 'low'
}

// 获取优先级标签
function getPriorityLabel(priority: string): { text: string; color: string } {
  switch (priority) {
    case 'urgent': return { text: '紧急', color: '#e8b4a0' }
    case 'normal': return { text: '普通', color: '#ddb480' }
    case 'low': return { text: '轻松', color: '#a8c99a' }
    default: return { text: '普通', color: '#ddb480' }
  }
}

// 格式化时间差
function formatTimeRemaining(scheduledTime: string): string {
  const now = new Date().getTime()
  const scheduled = new Date(scheduledTime).getTime()
  const diffMs = scheduled - now
  
  if (diffMs < 0) {
    const overdue = Math.abs(diffMs)
    const hours = Math.floor(overdue / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `已逾期 ${days} 天`
    if (hours > 0) return `已逾期 ${hours} 小时`
    return '已逾期'
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days} 天后`
  if (hours > 0) return `${hours} 小时后`
  const minutes = Math.floor(diffMs / (1000 * 60))
  return `${minutes} 分钟后`
}

// 知识卡片组件
function KnowledgeCard({ 
  task, 
  onView,
  onComplete,
  onSkip
}: { 
  task: ReviewTask
  onView: (noteId: string) => void
  onComplete: (id: string) => void
  onSkip: (id: string) => void
}) {
  const priority = getPriority(task)
  const priorityInfo = getPriorityLabel(priority)
  
  return (
    <div className={`knowledge-card priority-${priority}`}>
      <div className="card-priority-badge" style={{ background: priorityInfo.color }}>
        {priorityInfo.text}
      </div>
      
      <div className="card-content-area" onClick={() => task.note_id && onView(task.note_id)}>
        <h3 className="card-title">{task.title}</h3>
        <p className="card-time-remaining">{formatTimeRemaining(task.scheduled_time)}</p>
        {task.interval_label && (
          <p className="card-interval">复习周期: {task.interval_label}</p>
        )}
      </div>
      
      <div className="card-actions">
          {task.note_id && (
            <button className="btn btn-secondary btn-sm" onClick={() => onView(task.note_id)}>
              查看笔记
            </button>
          )}
          <button className="btn btn-success btn-sm" onClick={() => onComplete(task.id)}>
            完成
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onSkip(task.id)}>
            跳过
          </button>
        </div>
    </div>
  )
}

// 紧急复习区域 - 并排排列
function UrgentSection({ tasks, onView, onComplete, onSkip }: {
  tasks: ReviewTask[]
  onView: (noteId: string) => void
  onComplete: (id: string) => void
  onSkip: (id: string) => void
}) {
  if (tasks.length === 0) {
    return (
      <div className="card-grid-section">
        <div className="card-scroll-container empty">
          <div className="card-grid">
            <div className="empty-hint">暂无紧急复习任务，所有笔记均在计划时间内</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="urgent-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-icon">🔥</span>
          紧急复习
        </h2>
        <span className="section-count">{tasks.length} 项</span>
      </div>
      <div className="urgent-grid">
        {tasks.map((task) => (
          <KnowledgeCard 
            key={task.id}
            task={task}
            onView={onView}
            onComplete={onComplete}
            onSkip={onSkip}
          />
        ))}
      </div>
    </div>
  )
}

// 可滚动卡片区域组件
function ScrollableCardGrid({ tasks, onView, onComplete, onSkip, emptyMessage }: {
  tasks: ReviewTask[]
  onView: (noteId: string) => void
  onComplete: (id: string) => void
  onSkip: (id: string) => void
  emptyMessage?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const scrollStart = useRef({ x: 0, y: 0 })
  const lastPos = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })
  const lastTime = useRef(0)
  const animationRef = useRef<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // 计算滚动位置状态
  const updateScrollState = () => {
    if (!containerRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
  }
  
  // 左右导航按钮
  const scrollBy = (direction: 'left' | 'right') => {
    if (!containerRef.current || isTransitioning) return
    
    const containerWidth = containerRef.current.clientWidth
    const cardWidth = 320 // 卡片宽度 + 间距
    const cardsToScroll = Math.max(1, Math.floor(containerWidth / cardWidth))
    const scrollAmount = direction === 'left' 
      ? -cardWidth * cardsToScroll 
      : cardWidth * cardsToScroll
    
    setIsTransitioning(true)
    containerRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    })
    
    setTimeout(() => {
      setIsTransitioning(false)
      updateScrollState()
    }, 500)
  }
  
  // 拖拽滚动
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    startPos.current = { x: e.clientX, y: e.clientY }
    scrollStart.current = {
      x: containerRef.current?.scrollLeft || 0,
      y: containerRef.current?.scrollTop || 0
    }
    lastPos.current = { x: e.clientX, y: e.clientY }
    lastTime.current = Date.now()
    velocity.current = { x: 0, y: 0 }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing'
      containerRef.current.style.userSelect = 'none'
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return
    
    const now = Date.now()
    const dt = now - lastTime.current
    
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    
    if (dt > 0) {
      velocity.current = { x: dx / dt, y: dy / dt }
    }
    
    lastPos.current = { x: e.clientX, y: e.clientY }
    lastTime.current = now
    
    const totalDx = e.clientX - startPos.current.x
    containerRef.current.scrollLeft = scrollStart.current.x - totalDx
  }
  
  const handleMouseUp = () => {
    if (!isDragging.current || !containerRef.current) return
    
    isDragging.current = false
    containerRef.current.style.cursor = 'grab'
    containerRef.current.style.userSelect = ''
    
    // 惯性滚动
    const applyMomentum = () => {
      if (!containerRef.current) return
      
      const friction = 0.95
      const minVel = 0.1
      
      velocity.current.x *= friction
      
      if (Math.abs(velocity.current.x) > minVel) {
        containerRef.current.scrollLeft -= velocity.current.x * 16
        animationRef.current = requestAnimationFrame(applyMomentum)
      } else {
        velocity.current = { x: 0, y: 0 }
        animationRef.current = null
      }
    }
    
    if (Math.abs(velocity.current.x) > 0.1) {
      applyMomentum()
    }
  }
  
  const handleMouseLeave = () => {
    if (isDragging.current) {
      handleMouseUp()
    }
  }
  
  // 监听滚动事件更新按钮状态
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('scroll', updateScrollState)
      updateScrollState()
      return () => container.removeEventListener('scroll', updateScrollState)
    }
  }, [tasks])
  
  if (tasks.length === 0) {
    return (
      <div className="card-grid-section">
        <div className="card-scroll-container empty">
          <div className="card-grid">
            <div className="empty-hint">{emptyMessage || '暂无复习任务'}</div>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="card-grid-section">
      {/* 左右导航按钮 */}
      {tasks.length > 2 && (
        <>
          <button 
            className={`scroll-nav-btn scroll-nav-left ${!canScrollLeft ? 'disabled' : ''}`}
            onClick={() => scrollBy('left')}
            disabled={!canScrollLeft || isTransitioning}
          >
            ‹
          </button>
          <button 
            className={`scroll-nav-btn scroll-nav-right ${!canScrollRight ? 'disabled' : ''}`}
            onClick={() => scrollBy('right')}
            disabled={!canScrollRight || isTransitioning}
          >
            ›
          </button>
        </>
      )}
      
      <div 
        ref={containerRef}
        className="card-scroll-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div className="card-grid">
          {tasks.map((task, index) => (
            <div key={task.id} className="grid-card-wrapper" style={{ '--index': index } as React.CSSProperties}>
              <KnowledgeCard 
                task={task}
                onView={onView}
                onComplete={onComplete}
                onSkip={onSkip}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-hint">
        <span>↔ 拖动或使用按钮滚动</span>
      </div>
    </div>
  )
}

export default function Review() {
  const [tasks, setTasks] = useState<ReviewTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewNote, setViewNote] = useState<Note | null>(null)
  const [viewNoteLoading, setViewNoteLoading] = useState(false)

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    try {
      setLoading(true)
      const res = await reviewAPI.list()
      setTasks(res.data)
    } catch (e: any) {
      setError('加载失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  async function markComplete(id: string) {
    try {
      await reviewAPI.markDone(id)
      loadTasks()
    } catch (e: any) {
      setError('操作失败: ' + (e.message || '未知错误'))
    }
  }

  async function markSkipped(id: string) {
    try {
      await reviewAPI.markSkipped(id)
      loadTasks()
    } catch (e: any) {
      setError('操作失败: ' + (e.message || '未知错误'))
    }
  }

  async function handleSeedSample() {
    try {
      setLoading(true)
      await reviewAPI.seedSample()
      await loadTasks()
    } catch (e: any) {
      setError('生成示例数据失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  async function handleViewNote(noteId: string) {
    try {
      setViewNoteLoading(true)
      const res = await notesAPI.get(noteId)
      setViewNote(res.data)
    } catch (e: any) {
      setError('加载笔记失败: ' + (e.message || '未知错误'))
    } finally {
      setViewNoteLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  // 分类任务 - 只统计 pending 状态的任务，排除已完成和已跳过的
  const allPendingTasks = tasks.filter(t => t.status === 'pending')

  // 确保每个笔记只出现一次的分类逻辑
  // 优先级：紧急 > 普通 > 即将到来
  const usedNoteIds = new Set<string>()
  const urgentTasks: typeof allPendingTasks = []
  const normalTasksRaw: typeof allPendingTasks = []
  const upcomingTasks: typeof allPendingTasks = []

  // 按优先级分组，每个笔记只出现在最高优先级的类别中
  allPendingTasks.forEach(task => {
    if (usedNoteIds.has(task.note_id)) return // 已处理过的笔记跳过

    const priority = getPriority(task)
    usedNoteIds.add(task.note_id)

    if (priority === 'urgent') {
      urgentTasks.push(task)
    } else if (priority === 'normal') {
      normalTasksRaw.push(task)
    } else {
      upcomingTasks.push(task)
    }
  })

  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'skipped')
  
  const displayUrgentTasks = urgentTasks
  const remainingNormalTasks = normalTasksRaw

  return (
    <div className="review-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">复习计划</h1>
            <p className="page-subtitle">基于艾宾浩斯遗忘曲线，智能安排复习时间</p>
          </div>
          {allPendingTasks.length === 0 && (
            <button className="btn btn-primary" onClick={handleSeedSample}>
              生成示例数据
            </button>
          )}
        </div>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {/* 笔记查看弹窗 */}
      {viewNote && (
        <div className="note-modal-overlay" onClick={() => setViewNote(null)}>
          <div className="note-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{viewNote.title}</h2>
              <button className="modal-close" onClick={() => setViewNote(null)}>×</button>
            </div>
            {viewNote.tags && viewNote.tags.length > 0 && (
              <div className="modal-tags">
                {viewNote.tags.map(tag => <span key={tag} className="tag tag-accent">{tag}</span>)}
              </div>
            )}
            <div className="modal-content">
              {viewNoteLoading ? (
                <div className="loading">
                  <div className="loading-spinner"></div>
                  <p>加载中...</p>
                </div>
              ) : (
                <MarkdownContent>{viewNote.raw_markdown || viewNote.content || ''}</MarkdownContent>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-success" onClick={() => {
                const relatedTask = tasks.find(t => t.note_id === viewNote.id)
                if (relatedTask) markComplete(relatedTask.id)
                setViewNote(null)
              }}>
                标记完成
              </button>
              <button className="btn btn-secondary" onClick={() => setViewNote(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 紧急复习区域 - 并排排列 */}
      <UrgentSection 
        tasks={displayUrgentTasks}
        onView={handleViewNote}
        onComplete={markComplete}
        onSkip={markSkipped}
      />

      {/* 普通优先级复习卡片 */}
      <div className="card-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📚</span>
            普通复习
          </h2>
          <span className="section-count">{remainingNormalTasks.length} 项</span>
        </div>
        <ScrollableCardGrid 
          tasks={remainingNormalTasks}
          onView={handleViewNote}
          onComplete={markComplete}
          onSkip={markSkipped}
          emptyMessage="距离计划复习时间 24-72 小时的笔记将显示在此处"
        />
      </div>

      {/* 即将到来复习卡片 */}
      <div className="card-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📅</span>
            即将到来
          </h2>
          <span className="section-count">{upcomingTasks.length} 项</span>
        </div>
        <ScrollableCardGrid 
          tasks={upcomingTasks}
          onView={handleViewNote}
          onComplete={markComplete}
          onSkip={markSkipped}
          emptyMessage="距离计划复习时间超过 72 小时的笔记将显示在此处"
        />
      </div>

      {/* 空状态 - 完全没有任何数据时显示 */}
      {allPendingTasks.length === 0 && completedTasks.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3 className="empty-title">太棒了！</h3>
            <p className="empty-desc">当前没有需要复习的内容</p>
            {completedTasks.length === 0 && (
              <button className="btn btn-primary" onClick={handleSeedSample} style={{ marginTop: '1rem' }}>
                生成示例复习数据
              </button>
            )}
          </div>
        </div>
      )}

      {/* 已完成历史 */}
      {completedTasks.length > 0 && (
        <div className="card-section completed-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">✓</span>
              已完成
            </h2>
            <span className="section-count">{completedTasks.length} 项</span>
          </div>
          <div className="completed-grid">
            {completedTasks.map((task, index) => (
              <div 
                key={task.id} 
                className="completed-card"
                style={{ '--index': index } as React.CSSProperties}
              >
                <span className="completed-title">{task.title}</span>
                <span className="completed-time">
                  {task.completed_at ? new Date(task.completed_at).toLocaleDateString('zh-CN') : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
