import { useState, useEffect, useRef } from 'react'
import { qaAPI } from '../api'
import MarkdownContent from '../components/MarkdownContent'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function QA() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [context, setContext] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const res = await qaAPI.ask(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.answer,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (e: any) {
      setError('问答失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  function clearChat() {
    setMessages([])
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">智能问答</h1>
        <p className="page-subtitle">基于笔记内容，AI 为您答疑解惑</p>
      </div>

      {error && <div className="message message-error">{error}</div>}

      <div className="card delay-1">
        <div className="card-header">
          <h2 className="card-title">对话</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(!showSettings)}>
              {showSettings ? '隐藏设置' : '设置'}
            </button>
            {messages.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={clearChat}>
                清空对话
              </button>
            )}
          </div>
        </div>

        {showSettings && (
          <div className="form-group">
            <label>上下文（可选）- 输入相关笔记内容以获得更准确的回答</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="粘贴笔记内容或让其自动从笔记中获取上下文..."
              style={{ minHeight: '80px' }}
            />
          </div>
        )}

        <div className="chat-container" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <h3 className="empty-title">开始对话</h3>
              <p className="empty-desc">输入您的问题，AI 将基于笔记内容为您解答</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div className="chat-sender">{msg.role === 'user' ? '您' : 'AI 助手'}</div>
                <div className="chat-content">
                  {msg.role === 'assistant' ? (
                    <MarkdownContent>{msg.content}</MarkdownContent>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="chat-message assistant">
              <div className="chat-sender">AI 助手</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="loading-spinner" style={{ width: '20px', height: '20px', margin: 0 }}></div>
                <span style={{ color: 'var(--text-muted)' }}>思考中...</span>
              </div>
            </div>
          )}
        </div>

        <form className="chat-input" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (input.trim() && !loading) {
                  handleSubmit(e as any)
                }
              }
            }}
            placeholder="输入您的问题... (Enter 发送，Shift+Enter 换行)"
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            发送
          </button>
        </form>
      </div>

      <div className="card delay-2">
        <div className="card-header">
          <h2 className="card-title">使用提示</h2>
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>1. 直接提问</strong> - 询问任何与学习相关的问题
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>2. 设置上下文</strong> - 点击"设置"可手动输入相关笔记内容
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>3. 结合笔记</strong> - 在笔记页面创建的内容将自动用于回答
          </p>
        </div>
      </div>
    </div>
  )
}
