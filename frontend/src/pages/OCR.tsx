import { useState, useRef } from 'react'
import { ocrAPI } from '../api'

export default function OCR() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [aiEnhanced, setAiEnhanced] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(f: File) {
    setFile(f)
    setResult('')
    setError('')

    const reader = new FileReader()
    reader.onload = e => {
      setPreview(e.target?.result as string)
    }
    if (f.type.startsWith('image/')) {
      reader.readAsDataURL(f)
    } else {
      setPreview('')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      const validExts = ['ppt', 'pptx', 'pdf', 'png', 'jpg', 'jpeg', 'bmp', 'webp']
      if (validExts.includes(ext) || f.type.startsWith('image/')) {
        handleFileSelect(f)
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function clearSelection() {
    setFile(null)
    setPreview('')
    setResult('')
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult('')

    try {
      const res = await ocrAPI.recognize(file)
      if ('error' in res.data) {
        setError(res.data.error)
      } else {
        setResult(res.data.text || '未识别到文字')
      }
    } catch (e: any) {
      if (e.response) {
        const status = e.response.status
        const data = e.response.data
        const errorMsg = data?.error || (typeof data === 'string' ? data : null)
        if (errorMsg) {
          setError(errorMsg)
        } else if (status === 500) {
          setError('服务器内部错误，请稍后重试或检查服务状态')
        } else if (status === 413) {
          setError('文件过大，请压缩后再试')
        } else {
          setError(`识别失败 (${status}): ${e.message || '未知错误'}`)
        }
      } else if (e.request) {
        setError('无法连接到服务器，请检查网络连接')
      } else {
        setError('识别失败: ' + (e.message || '未知错误'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleToNote() {
    if (!result) return
    try {
      const res = await ocrAPI.toNote(result, aiEnhanced)
      alert(`笔记创建成功！\n标题: ${res.data.title}`)
    } catch (e: any) {
      setError('转为笔记失败: ' + (e.message || '未知错误'))
    }
  }

  const isImage = file?.type.startsWith('image/')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">PPT 识别</h1>
        <p className="page-subtitle">上传 PPT 文件，自动提取幻灯片中的文字内容</p>
      </div>

      {error && <div className="message message-error">{error}</div>}

      <div className="card delay-1">
        <div className="card-header">
          <h2 className="card-title">上传文件</h2>
        </div>

        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={dragOver ? { borderColor: 'var(--primary)', background: 'rgba(217, 119, 6, 0.08)' } : {}}
        >
          <div className="upload-icon">📊</div>
          <p className="upload-text">
            {dragOver ? '松开以选择文件' : '点击或拖拽文件到此处'}
          </p>
          <p className="upload-hint">
            支持 PPT, PPTX, PDF, PNG, JPG, BMP, WebP 格式
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ppt,.pptx,.pdf,image/*"
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </div>

        {file && (
          <div className="file-info" style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontWeight: 500 }}>{file.name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}

        {preview && isImage && (
          <div className="video-preview" style={{ marginTop: '1rem' }}>
            <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        {file && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? '识别中...' : '开始识别'}
            </button>
            <button className="btn btn-secondary" onClick={clearSelection}>
              清除
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="card">
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '100%', animation: 'pulse 1.5s infinite' }}></div>
            </div>
            <p className="progress-text">AI 正在识别文件中的文字...</p>
          </div>
        </div>
      )}

      {result && (
        <div className="card delay-2">
          <div className="card-header">
            <h2 className="card-title">识别结果</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="checkbox-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={aiEnhanced}
                  onChange={e => setAiEnhanced(e.target.checked)}
                />
                <span className="checkbox-custom"></span>
                AI 增强
              </label>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleToNote}
              >
                📝 转为笔记
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigator.clipboard.writeText(result)}
              >
                复制文本
              </button>
            </div>
          </div>
          <div className="result-box">
            <pre>{result}</pre>
          </div>
        </div>
      )}

      <div className="card delay-3">
        <div className="card-header">
          <h2 className="card-title">使用说明</h2>
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>1. PPT 识别</strong> - 上传 PPT/PPTX 文件，自动提取每张幻灯片的文字内容（含文本框、表格、备注）
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>2. PDF/图片识别</strong> - 也支持 PDF 和常见图片格式的文字识别
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>3. 转为笔记</strong> - 识别完成后可一键转为结构化笔记（含 AI 思维导图）
          </p>
          <p>
            <strong>提示</strong> - 文字清晰的 PPT 识别效果最佳，含图片的幻灯片会自动进行 OCR 识别
          </p>
        </div>
      </div>
    </div>
  )
}