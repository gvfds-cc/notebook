import { useState, useEffect } from 'react'
import { settingsAPI, ConfigResponse } from '../api'

export default function Settings() {
  const [config, setConfig] = useState<ConfigResponse>({
    llm_api_key: '',
    llm_base_url: 'https://api.deepseek.com/v1',
    llm_model: 'deepseek-chat',
    whisper_api_key: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      const res = await settingsAPI.get()
      setConfig({
        llm_api_key: res.data.llm_api_key || '',
        llm_base_url: res.data.llm_base_url || 'https://api.deepseek.com/v1',
        llm_model: res.data.llm_model || 'deepseek-chat',
        whisper_api_key: res.data.whisper_api_key || '',
      })
    } catch (e: any) {
      setError('加载配置失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      await settingsAPI.update(config)
      setSuccess('保存成功')
    } catch (e: any) {
      setError('保存失败: ' + (e.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setError('')
    setSuccess('')
    setTestResult(null)
    try {
      const res = await settingsAPI.test(config)
      setTestResult(res.data)
    } catch (e: any) {
      setTestResult({ success: false, message: '测试失败: ' + (e.message || '未知错误') })
    } finally {
      setTesting(false)
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
        <h1 className="page-title">系统设置</h1>
        <p className="page-subtitle">配置 AI API 连接信息</p>
      </div>

      {error && <div className="message message-error">{error}</div>}
      {success && <div className="message message-success">{success}</div>}
      {testResult && (
        <div className={`message ${testResult.success ? 'message-success' : 'message-error'}`}>
          {testResult.message}
        </div>
      )}

      <div className="card delay-1">
        <div className="card-header">
          <h2 className="card-title">AI 接口配置</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>API Base URL</label>
            <input
              type="text"
              value={config.llm_base_url ?? ''}
              onChange={e => setConfig({ ...config, llm_base_url: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>

          <div className="form-group">
            <label>API Key</label>
            <input
              type="password"
              value={config.llm_api_key ?? ''}
              onChange={e => setConfig({ ...config, llm_api_key: e.target.value })}
              placeholder="sk-xxxxxxxx"
            />
          </div>

          <div className="form-group">
            <label>模型名称</label>
            <input
              type="text"
              value={config.llm_model ?? ''}
              onChange={e => setConfig({ ...config, llm_model: e.target.value })}
              placeholder="deepseek-chat"
            />
          </div>

          <div className="form-group">
            <label>Whisper API Key（语音识别）</label>
            <input
              type="password"
              value={config.whisper_api_key ?? ''}
              onChange={e => setConfig({ ...config, whisper_api_key: e.target.value })}
              placeholder="sk-xxxx（留空则使用上方 API Key）"
            />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              DeepSeek 等国内 API 不支持语音识别，如需语音转文字请填写 OpenAI Key（https://platform.openai.com/api-keys）。留空则自动用上方 API Key 尝试。
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存配置'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadConfig}>
              重置
            </button>
          </div>
        </form>
      </div>

      <div className="card delay-2">
        <div className="card-header">
          <h2 className="card-title">配置说明</h2>
        </div>
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>API Base URL</strong> - LLM 服务商的 API 地址，例如 DeepSeek 为 <code>https://api.deepseek.com/v1</code>
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>API Key</strong> - 您的私钥，请妥善保管不要泄露
          </p>
          <p>
            <strong>模型名称</strong> - 使用的模型 ID，如 <code>deepseek-chat</code>、<code>gpt-4</code> 等
          </p>
        </div>
      </div>
    </div>
  )
}
