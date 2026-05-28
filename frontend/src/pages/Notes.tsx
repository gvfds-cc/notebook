import { useState, useEffect } from 'react'
import { notesAPI, Note } from '../api'
import MarkdownContent from '../components/MarkdownContent'

// 确认对话框组件
function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '确认',
  cancelText = '取消',
  danger = false
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  danger?: boolean
}) {
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// 批量操作栏组件
function BatchActionsBar({
  selectedCount,
  onDelete,
  onCancel
}: {
  selectedCount: number
  onDelete: () => void
  onCancel: () => void
}) {
  return (
    <div className="batch-actions-bar">
      <div className="selected-count">
        已选择 <span>{selectedCount}</span> 项
      </div>
      <button className="btn btn-danger" onClick={onDelete}>
        🗑️ 批量删除
      </button>
      <button className="btn btn-secondary" onClick={onCancel}>
        取消选择
      </button>
    </div>
  )
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', content: '', tags: '' })
  const [viewNote, setViewNote] = useState<Note | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '', tags: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastSubmitted, setLastSubmitted] = useState<{ title: string; content: string } | null>(null)
  const [aiEnhanced, setAiEnhanced] = useState(false)
  
  // 批量选择状态
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes() {
    try {
      setLoading(true)
      const res = await notesAPI.list()
      setNotes(res.data)
    } catch (e: any) {
      setError('加载笔记失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // 防重复提交：检查是否正在提交或内容未变化
    if (isSubmitting) return
    
    const submitData = {
      title: form.title,
      content: form.content,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [],
    }
    
    // 检查是否与上次提交的内容完全相同
    if (!editingId && lastSubmitted && 
        lastSubmitted.title === submitData.title && 
        lastSubmitted.content === submitData.content) {
      setError('请勿重复创建相同的笔记')
      return
    }
    
    try {
      setIsSubmitting(true)
      setError('')

      if (editingId) {
        await notesAPI.update(editingId, submitData)
      } else {
        const res = await notesAPI.create({ ...submitData, ai_enhanced: aiEnhanced })
        if (aiEnhanced) {
          const data = res.data as any
          if (data.ai_enhanced_applied) {
            alert('✅ 笔记创建成功！AI 增强已完成（含思维导图）')
          } else if (data.ai_enhanced_message) {
            alert(`⚠️ 笔记已创建，但 AI 增强未生效：${data.ai_enhanced_message}`)
          }
        }
        // 记录提交内容，用于后续检测重复
        setLastSubmitted({ title: submitData.title, content: submitData.content })
      }

      setForm({ title: '', content: '', tags: '' })
      setAiEnhanced(false)
      setShowForm(false)
      setEditingId(null)
      loadNotes()
    } catch (e: any) {
      // 如果是后端返回的重复创建错误，显示友好提示
      if (e.response?.status === 409) {
        setError('笔记已存在，请勿重复创建')
      } else {
        setError('保存失败: ' + (e.message || '未知错误'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这条笔记吗？')) return
    try {
      await notesAPI.delete(id)
      loadNotes()
    } catch (e: any) {
      setError('删除失败: ' + (e.message || '未知错误'))
    }
  }

  // 批量删除
  async function handleBatchDelete() {
    if (selectedNotes.size === 0) return
    
    setIsBatchDeleting(true)
    try {
      const deletePromises = Array.from(selectedNotes).map(id => notesAPI.delete(id))
      await Promise.all(deletePromises)
      setSelectedNotes(new Set())
      setShowDeleteConfirm(false)
      loadNotes()
    } catch (e: any) {
      setError('批量删除失败: ' + (e.message || '未知错误'))
    } finally {
      setIsBatchDeleting(false)
    }
  }

  function toggleNoteSelection(id: string) {
    const newSelected = new Set(selectedNotes)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedNotes(newSelected)
  }

  function toggleSelectAll() {
    if (selectedNotes.size === notes.length) {
      setSelectedNotes(new Set())
    } else {
      setSelectedNotes(new Set(notes.map(n => n.id)))
    }
  }

  function cancelSelection() {
    setSelectedNotes(new Set())
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setForm({
      title: note.title,
      content: note.content,
      tags: note.tags?.join(', ') || '',
    })
    setShowForm(true)
  }

  function startInlineEdit(note: Note) {
    setEditForm({
      title: note.title,
      content: note.content,
      tags: note.tags?.join(', ') || '',
    })
    setIsEditing(true)
  }

  async function handleInlineSave() {
    if (!viewNote) return
    try {
      const data = {
        title: editForm.title,
        content: editForm.content,
        tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()) : [],
      }
      const res = await notesAPI.update(viewNote.id, data)
      setViewNote(res.data)
      setIsEditing(false)
      loadNotes()
    } catch (e: any) {
      setError('保存失败: ' + (e.message || '未知错误'))
    }
  }

  function cancelInlineEdit() {
    setIsEditing(false)
  }

  function getNoteMarkdown(note: Pick<Note, 'content' | 'raw_markdown'>) {
    return note.raw_markdown || note.content || ''
  }

  function MarkdownEditorPreview({ value, label = '预览' }: { value: string; label?: string }) {
    return (
      <div className="markdown-preview-panel">
        <div className="markdown-preview-label">{label}</div>
        <MarkdownContent>{value}</MarkdownContent>
      </div>
    )
  }

  function stripMarkdown(md: string): string {
    return md
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/>\s+/g, '')
      .replace(/[-*+]\s+/g, '')
      .replace(/\d+\.\s+/g, '')
      .replace(/\|/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/-{3,}/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim()
  }

  async function handleExport(id: string, format: string) {
    try {
      const res = await notesAPI.export(id, format)
      const blob = new Blob([res.data.content || ''], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `笔记_${id}.${format === 'markdown' ? 'md' : format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('导出失败: ' + (e.message || '未知错误'))
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">我的笔记</h1>
        <p className="page-subtitle">管理您的学习笔记，支持 Markdown 导出</p>
      </div>

      {error && <div className="message message-error">{error}</div>}

      {showForm && (
        <div className="card delay-1">
          <div className="card-header">
            <h2 className="card-title">{editingId ? '编辑笔记' : '新建笔记'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>标题</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="输入笔记标题..."
                required
              />
            </div>
            <div className="form-group">
              <label>内容（Markdown 语法）</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="写下你的笔记内容，支持 # 标题、**加粗**、列表等 Markdown 语法..."
                style={{ minHeight: '200px', fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace", fontSize: '0.9rem', lineHeight: '1.7' }}
              />
              {form.content.trim() && <MarkdownEditorPreview value={form.content} />}
            </div>
            <div className="form-group">
              <label>标签（用逗号分隔）</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="如: 数学, 重点, 公式"
              />
            </div>
            {!editingId && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label className="checkbox-wrapper" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={aiEnhanced}
                    onChange={e => setAiEnhanced(e.target.checked)}
                  />
                  <span className="checkbox-custom"></span>
                </label>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  AI 增强 — 自动生成思维导图和结构化笔记
                </span>
              </div>
            )}
            {isSubmitting && aiEnhanced && !editingId && (
              <div className="progress-container" style={{ marginBottom: '1rem' }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '100%', animation: 'pulse 1.5s infinite' }}></div>
                </div>
                <p className="progress-text">AI 正在生成思维导图和结构化笔记，请耐心等待...</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (aiEnhanced && !editingId ? '⏳ AI 增强中...' : '保存中...') : '保存笔记'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); setAiEnhanced(false) }}>取消</button>
            </div>
          </form>
        </div>
      )}

      {viewNote && (
        <div className="card delay-1">
          <div className="card-header">
            <h2 className="card-title">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    border: 'none',
                    borderBottom: '2px solid var(--primary)',
                    background: 'transparent',
                    width: '100%',
                    padding: '0.25rem 0',
                    fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                  }}
                />
              ) : (
                viewNote.title
              )}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
              {isEditing ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={handleInlineSave}>保存</button>
                  <button className="btn btn-secondary btn-sm" onClick={cancelInlineEdit}>取消</button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => startInlineEdit(viewNote)}>编辑</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleExport(viewNote.id, 'markdown')}>导出</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { handleDelete(viewNote.id); setViewNote(null) }}>删除</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setViewNote(null); setIsEditing(false) }}>关闭</button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <div>
              <div className="form-group">
                <label>标签（用逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="如: 数学, 重点, 公式"
                />
              </div>
              <div className="form-group">
                <label>内容（Markdown 语法）</label>
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                  placeholder="写下你的笔记内容..."
                  style={{ minHeight: '300px', fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace", fontSize: '0.9rem', lineHeight: '1.7' }}
                />
                {editForm.content.trim() && <MarkdownEditorPreview value={editForm.content} />}
              </div>
            </div>
          ) : (
            <div>
              {viewNote.tags && viewNote.tags.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  {viewNote.tags.map((tag: string) => <span key={tag} className="tag tag-accent">{tag}</span>)}
                </div>
              )}
              <MarkdownContent>{getNoteMarkdown(viewNote)}</MarkdownContent>
            </div>
          )}
        </div>
      )}

      {!viewNote && (
        <>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">笔记列表</h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {notes.length > 0 && (
                  <label className="checkbox-wrapper" style={{ marginRight: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedNotes.size === notes.length && notes.length > 0}
                      onChange={toggleSelectAll}
                    />
                    <span className="checkbox-custom"></span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>全选</span>
                  </label>
                )}
                <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ title: '', content: '', tags: '' }); setAiEnhanced(false) }}>
                  + 新建笔记
                </button>
              </div>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3 className="empty-title">暂无笔记</h3>
                <p className="empty-desc">点击上方按钮创建您的第一篇笔记</p>
              </div>
            </div>
          ) : (
            <div className="note-list">
              {notes.map((note, index) => (
                <div
                  key={note.id}
                  className={`note-item delay-${Math.min(index + 1, 5)} ${selectedNotes.has(note.id) ? 'selected' : ''}`}
                  onClick={() => viewNote === null && toggleNoteSelection(note.id)}
                >
                  <label className="checkbox-wrapper" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedNotes.has(note.id)}
                      onChange={() => toggleNoteSelection(note.id)}
                    />
                    <span className="checkbox-custom"></span>
                  </label>
                  <div className="note-item-content">
                    <h3 className="note-item-title">{note.title}</h3>
                    <p className="note-item-meta">
                      {new Date(note.updated_at).toLocaleString('zh-CN')}
                    </p>
                    <p className="note-item-preview">{stripMarkdown(note.content)}</p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="note-item-tags">
                        {note.tags.map((tag: string) => <span key={tag} className="tag">{tag}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="note-item-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setViewNote(note); setIsEditing(false) }}>查看</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => startEdit(note)}>编辑</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleExport(note.id, 'markdown')}>导出</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(note.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 批量操作栏 */}
      {selectedNotes.size > 0 && (
        <BatchActionsBar
          selectedCount={selectedNotes.size}
          onDelete={() => setShowDeleteConfirm(true)}
          onCancel={cancelSelection}
        />
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="确认批量删除"
          message={`确定要删除选中的 ${selectedNotes.size} 条笔记吗？此操作不可撤销。`}
          onConfirm={handleBatchDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText={isBatchDeleting ? '删除中...' : '确认删除'}
          danger
        />
      )}
    </div>
  )
}
