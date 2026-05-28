import { useState, useEffect, useRef, useCallback } from 'react'
import { recordAPI, RecordingSession } from '../api'
import './Record.css'

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// 轮询间隔（毫秒）
const POLL_INTERVAL = 3000

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

export default function Record() {
  const [sessions, setSessions] = useState<RecordingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')

  // 批量选择状态
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  // 音频导入状态
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importTranscript, setImportTranscript] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // 处理进度追踪
  const [progressMap, setProgressMap] = useState<Record<string, { progress: number; message: string }>>({})

  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const processingRequestsRef = useRef<Set<string>>(new Set())

  // 页面加载时初始化
  useEffect(() => {
    recordAPI.resetStuck().catch(() => {})

    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError('加载超时，请检查后端服务是否正常运行')
    }, 8000)

    loadSessions()

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  // 启动轮询机制
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        // 获取所有正在处理的 session ID
        const currentProcessingIds = Array.from(processingIds)
        if (currentProcessingIds.length === 0) {
          // 没有处理中的任务，停止轮询
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
          return
        }

        // 轮询每个处理中的 session 状态
        const updateResults = await Promise.all(
          currentProcessingIds.map(async (id) => {
            try {
              const res = await recordAPI.getTaskStatus(id)
              return { id, ...res.data }
            } catch {
              return null
            }
          })
        )

        // 更新进度
        updateResults.forEach(result => {
          if (result && result.status === 'processing') {
            setProgressMap(prev => ({
              ...prev,
              [result.id]: {
                progress: result.progress || 0,
                message: result.progress_message || '处理中...'
              }
            }))
          }
        })

        // 更新 sessions 状态
        setSessions(prev => {
          const sessionMap = new Map(prev.map(s => [s.id, s]))
          let hasChanges = false
          
          updateResults.forEach(result => {
            if (result) {
              const existing = sessionMap.get(result.id)
              if (existing && (
                existing.status !== result.status ||
                existing.processed_at !== result.processed_at ||
                existing.note_id !== result.note_id ||
                existing.fused_data !== result.fused_data
              )) {
                sessionMap.set(result.id, {
                  ...existing,
                  status: result.status,
                  processed_at: result.processed_at,
                  note_id: result.note_id,
                  fused_data: result.fused_data,
                })
                hasChanges = true
              }
            }
          })
          
          return hasChanges ? Array.from(sessionMap.values()) : prev
        })

        // 检查是否有任务完成或失败
        const completedOrFailed = updateResults.filter(r => r && (r.status === 'completed' || r.status === 'failed'))
        if (completedOrFailed.length > 0) {
          // 有任务完成或失败，移除出处理中列表
          completedOrFailed.forEach(r => {
            if (r) {
              setProcessingIds(prev => {
                const next = new Set(prev)
                next.delete(r.id)
                return next
              })
              // 清理进度
              setProgressMap(prev => {
                const next = { ...prev }
                delete next[r.id]
                return next
              })
            }
          })
          // 刷新列表以获取最新数据
          loadSessions()
        }

        // 如果没有更多处理中的任务，停止轮询
        const stillProcessing = updateResults.filter(r => r && r.status === 'processing')
        if (stillProcessing.length === 0 && pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      } catch (e) {
        console.error('轮询失败:', e)
      }
    }, POLL_INTERVAL)
  }, [processingIds])

  async function loadSessions() {
    try {
      setLoading(true)
      const res = await recordAPI.list()
      setSessions(res.data)
      
      // 如果有处理中的任务，启动轮询
      const hasProcessing = res.data.some(s => s.status === 'processing')
      if (hasProcessing && !pollingIntervalRef.current) {
        startPolling()
      }
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    } catch (e: any) {
      setError('加载失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        setError('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器')
        return
      }

      finalTranscriptRef.current = ''
      setTranscript('')
      setInterimTranscript('')

      const recognition = new SpeechRecognition()
      recognition.lang = 'zh-CN'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition

      recognition.onresult = (event: any) => {
        let interim = ''
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }
        if (final) {
          finalTranscriptRef.current += final
          setTranscript(finalTranscriptRef.current)
        }
        setInterimTranscript(interim)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error)
        if (event.error === 'not-allowed') {
          setError('请允许麦克风权限')
        }
      }

      recognition.onend = () => {
        if (isRecording) {
          try { recognition.start() } catch (e) {}
        }
      }

      recognition.start()

      const res = await recordAPI.start(title || '录课_' + new Date().toLocaleString('zh-CN'))
      setCurrentSessionId(res.data.id)
      setIsRecording(true)
      loadSessions()
    } catch (e: any) {
      setError('启动失败: ' + (e.message || '请检查麦克风权限'))
    }
  }

  async function stopRecording() {
    if (!currentSessionId) return

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }

      const text = finalTranscriptRef.current.trim()
      if (text) {
        await recordAPI.saveTranscript(currentSessionId, text)
      }

      await recordAPI.stop(currentSessionId)
      setIsRecording(false)
      setCurrentSessionId(null)
      setInterimTranscript('')
      loadSessions()
    } catch (e: any) {
      setError('停止失败: ' + (e.message || '未知错误'))
    }
  }

  async function processSession(id: string) {
    if (processingRequestsRef.current.has(id)) return
    processingRequestsRef.current.add(id)

    // 立即更新本地状态为处理中，不阻塞 UI
    setSessions(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'processing' as const, processing_started_at: new Date().toISOString() } : s
    ))
    setProcessingIds(prev => new Set(prev).add(id))
    
    try {
      await recordAPI.process(id)
      // 启动轮询监控处理状态
      startPolling()
      // 不等待处理完成，UI 已更新
    } catch (e: any) {
      console.error('处理请求失败:', e)
      // 不立即回滚，让轮询继续尝试获取状态
      startPolling()
    } finally {
      processingRequestsRef.current.delete(id)
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('确定要删除这个录制吗？')) return
    try {
      await recordAPI.delete(id)
      loadSessions()
    } catch (e: any) {
      setError('删除失败: ' + (e.message || '未知错误'))
    }
  }

  async function handleImportAudio() {
    if (!importFile) return
    setIsImporting(true)
    setError('')
    try {
      await recordAPI.importAudio(importFile, importTitle || undefined, importTranscript || undefined)
      setImportFile(null)
      setImportTitle('')
      setImportTranscript('')
      setShowImport(false)
      loadSessions()
    } catch (e: any) {
      setError('导入失败: ' + (e.message || '未知错误'))
    } finally {
      setIsImporting(false)
    }
  }

  // 批量删除
  async function handleBatchDelete() {
    if (selectedSessions.size === 0) return
    
    setIsBatchDeleting(true)
    try {
      const deletePromises = Array.from(selectedSessions).map(id => recordAPI.delete(id))
      await Promise.all(deletePromises)
      setSelectedSessions(new Set())
      setShowDeleteConfirm(false)
      loadSessions()
    } catch (e: any) {
      setError('批量删除失败: ' + (e.message || '未知错误'))
    } finally {
      setIsBatchDeleting(false)
    }
  }

  function toggleSessionSelection(id: string) {
    const newSelected = new Set(selectedSessions)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedSessions(newSelected)
  }

  function toggleSelectAll() {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)))
    }
  }

  function cancelSelection() {
    setSelectedSessions(new Set())
  }

  function getStatusText(status: string) {
    const map: Record<string, string> = {
      pending: '等待中',
      recording: '录制中',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
    }
    return map[status] || status
  }

  function isSessionStuck(session: RecordingSession): boolean {
    if (session.status !== 'processing') return false
    if (!session.processing_started_at) return true
    const startedTime = new Date(session.processing_started_at).getTime()
    const now = Date.now()
    const diffMs = now - startedTime
    return diffMs > 3 * 60 * 1000
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
        <h1 className="page-title">录课采集</h1>
        <p className="page-subtitle">录制课程并自动生成笔记与复习计划</p>
      </div>

      {error && (
        <div className="message message-error">
          {error}
          <button className="message-close" onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="card delay-1">
        <div className="card-header">
          <h2 className="card-title">{isRecording ? '正在录制...' : '开始录制'}</h2>
          <span className={`status ${isRecording ? 'recording' : 'pending'}`}>
            {isRecording ? '录制中' : '待机'}
          </span>
        </div>

        <div className="form-group">
          <label>录制标题</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="给录制起个名字..."
            disabled={isRecording}
          />
        </div>

        {isRecording && (
          <div className="transcript-box">
            <div className="transcript-label">
              语音识别中
              <span className="recording-indicator">🎤</span>
            </div>
            {transcript && (
              <div className="transcript-text">{transcript}</div>
            )}
            {interimTranscript && (
              <div className="transcript-interim">{interimTranscript}</div>
            )}
            {!transcript && !interimTranscript && (
              <div className="transcript-empty">请开始说话...</div>
            )}
          </div>
        )}

        <div className="button-group">
          {!isRecording ? (
            <button className="btn btn-success" onClick={startRecording}>
              开始录制
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stopRecording}>
              停止录制
            </button>
          )}
        </div>
      </div>

      <div className="card delay-2">
        <div className="card-header">
          <h2 className="card-title">导入音频</h2>
          <button
            className={`btn btn-sm ${showImport ? 'btn-secondary' : 'btn-accent'}`}
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? '收起' : '展开'}
          </button>
        </div>
        {showImport && (
          <div>
            <div className="form-group">
              <label>音频文件（支持 MP3、WAV、M4A、WebM 等格式）</label>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
              {importFile && (
                <div className="file-info" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(1)} MB)
                </div>
              )}
            </div>
            <div className="form-group">
              <label>标题（可选）</label>
              <input
                type="text"
                value={importTitle}
                onChange={e => setImportTitle(e.target.value)}
                placeholder="给导入的音频起个名字..."
              />
            </div>
            <div className="form-group">
              <label>文字稿（可选，提供后可直接生成笔记）</label>
              <textarea
                value={importTranscript}
                onChange={e => setImportTranscript(e.target.value)}
                placeholder="粘贴音频对应的文字内容（如已有逐字稿），留空则仅保存音频文件..."
                style={{ minHeight: '100px' }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleImportAudio}
              disabled={!importFile || isImporting}
            >
              {isImporting ? '导入中...' : '导入并创建记录'}
            </button>
          </div>
        )}
      </div>

      <div className="card delay-3">
        <div className="card-header">
          <h2 className="card-title">录制历史</h2>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {sessions.length > 0 && (
              <label className="checkbox-wrapper" style={{ marginRight: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={selectedSessions.size === sessions.length && sessions.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="checkbox-custom"></span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>全选</span>
              </label>
            )}
            <button className="btn btn-sm btn-secondary" onClick={loadSessions}>
              刷新
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎬</div>
            <h3 className="empty-title">暂无录制记录</h3>
            <p className="empty-desc">开始录制您的第一个课程吧</p>
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((session, index) => (
              <div 
                key={session.id} 
                className={`session-item delay-${Math.min(index + 1, 5)} ${session.status} ${selectedSessions.has(session.id) ? 'selected' : ''}`}
                onClick={() => toggleSessionSelection(session.id)}
              >
                <label className="checkbox-wrapper" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.id)}
                    onChange={() => toggleSessionSelection(session.id)}
                  />
                  <span className="checkbox-custom"></span>
                </label>
                <div className="session-content">
                  <h3 className="session-title">{session.title}</h3>
                  <p className="session-meta">
                    {new Date(session.created_at).toLocaleString('zh-CN')}
                  </p>
                  <div className="session-status-row">
                    <span className={`status ${session.status}`}>
                      {getStatusText(session.status)}
                    </span>
                    {session.status === 'processing' && isSessionStuck(session) && (
                      <span className="stuck-warning">⚠️ 已超时，可重试</span>
                    )}
                    {session.processed_at && (
                      <span className="processed-time">
                        完成于 {new Date(session.processed_at).toLocaleString('zh-CN')}
                      </span>
                    )}
                    {session.asr_result && (
                      <span className="asr-length">
                        已识别 {session.asr_result.length} 字
                      </span>
                    )}
                  </div>
                  {session.status === 'failed' && session.fused_data && (
                    <div className="session-error-detail">
                      {session.fused_data}
                    </div>
                  )}
                </div>
                <div className="session-actions" onClick={e => e.stopPropagation()}>
                  {session.status === 'pending' && !processingIds.has(session.id) && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => processSession(session.id)}
                    >
                      处理
                    </button>
                  )}
                  {session.status === 'processing' && !isSessionStuck(session) && progressMap[session.id] && (
                    <div style={{ minWidth: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {progressMap[session.id]?.message || '处理中...'}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                          {progressMap[session.id]?.progress || 0}%
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'var(--bg-muted)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${progressMap[session.id]?.progress || 0}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, var(--primary), var(--accent))',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  )}
                  {session.status === 'processing' && !isSessionStuck(session) && !progressMap[session.id] && (
                    <button className="btn btn-secondary btn-sm" disabled>
                      <span className="processing-spinner"></span>
                      处理中
                    </button>
                  )}
                  {session.status === 'processing' && isSessionStuck(session) && (
                    <button 
                      className="btn btn-accent btn-sm"
                      onClick={() => processSession(session.id)}
                    >
                      重试
                    </button>
                  )}
                  {session.status !== 'pending' && session.status !== 'processing' && (
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => processSession(session.id)}
                    >
                      重新处理
                    </button>
                  )}
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteSession(session.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedSessions.size > 0 && (
        <BatchActionsBar
          selectedCount={selectedSessions.size}
          onDelete={() => setShowDeleteConfirm(true)}
          onCancel={cancelSelection}
        />
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="确认批量删除"
          message={`确定要删除选中的 ${selectedSessions.size} 个录制吗？此操作不可撤销。`}
          onConfirm={handleBatchDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText={isBatchDeleting ? '删除中...' : '确认删除'}
          danger
        />
      )}

      {/* 后台处理提示 - 非阻塞式 */}
      {processingIds.size > 0 && (
        <div className="processing-toast">
          <div className="toast-icon">⚡</div>
          <div className="toast-content">
            <div className="toast-title">后台处理中</div>
            {(() => {
              const firstProcessing = Array.from(processingIds)
                .map(id => progressMap[id])
                .find(p => p)
              if (firstProcessing) {
                return (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {firstProcessing.message}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                        {firstProcessing.progress}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '4px',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${firstProcessing.progress}%`,
                        height: '100%',
                        background: 'var(--primary)',
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )
              }
              return (
                <div className="toast-desc">
                  录音正在后台 AI 处理中，您可以继续浏览其他页面
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
