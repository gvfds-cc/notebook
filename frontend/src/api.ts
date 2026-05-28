import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

// 笔记相关
export const notesAPI = {
  list: () => api.get<Note[]>('/notes/'),
  get: (id: string) => api.get<Note>(`/notes/${id}`),
  create: (data: { title: string; content: string; tags?: string[]; ai_enhanced?: boolean }) =>
    api.post<Note>('/notes/', data),
  update: (id: string, data: { title?: string; content?: string; tags?: string[] }) =>
    api.put<Note>(`/notes/${id}`, data),
  delete: (id: string) => api.delete(`/notes/${id}`),
  export: (id: string, format: string = 'markdown') =>
    api.get<{ content: string }>(`/notes/${id}/export?format=${format}`),
}

// 录课相关
export const recordAPI = {
  list: () => api.get<RecordingSession[]>('/record/'),
  get: (id: string) => api.get<RecordingSession>(`/record/${id}`),
  start: (title?: string) => api.post<RecordingSession>('/record/start', { title }),
  stop: (id: string) => api.post<RecordingSession>(`/record/stop/${id}`),
  process: (id: string) => api.post<{ message: string; status: string; session_id: string; started_at?: string }>(`/record/process/${id}`),
  getTaskStatus: (id: string) => api.get<{ session_id: string; status: string; is_processing: boolean; progress: number; progress_message?: string; processing_started_at?: string; processed_at?: string; note_id?: string; fused_data?: string }>(`/record/task-status/${id}`),
  delete: (id: string) => api.delete(`/record/${id}`),
  resetStuck: () => api.post<{ message: string }>('/record/reset-stuck'),
  uploadAudio: (id: string, blob: Blob) => {
    const formData = new FormData()
    formData.append('file', blob, `${id}.webm`)
    return api.post(`/record/${id}/upload`, formData)
  },
  saveTranscript: (id: string, text: string) => {
    return api.post(`/record/${id}/transcript`, { text })
  },
  importAudio: (file: File, title?: string, transcript?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    if (transcript) formData.append('transcript', transcript)
    return api.post<RecordingSession>('/record/import-audio', formData)
  },
}

// 复习计划相关
export const reviewAPI = {
  list: () => api.get<ReviewTask[]>('/review/plan'),
  create: (data: ReviewTaskCreate) => api.post<ReviewTask>('/review/plan', data),
  markDone: (id: string) => api.post<ReviewTask>(`/review/plan/${id}/done`),
  markSkipped: (id: string) => api.post<ReviewTask>(`/review/plan/${id}/skip`),
  seedSample: () => api.post<ReviewTask[] | { message: string }>('/review/seed-sample'),
}

// 智能问答
export const qaAPI = {
  ask: (question: string) =>
    api.post<QAResponse>('/qa/ask', { question }),
}

// OCR
export const ocrAPI = {
  recognize: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ text: string } | { error: string }>('/ocr/demo', formData)
  },
  toNote: (text: string, aiEnhanced: boolean = true) =>
    api.post<{ id: string; title: string; message: string; ai_enhanced_applied: boolean; ai_enhanced_message: string }>('/ocr/to-note', { text, ai_enhanced: aiEnhanced }),
}

// 系统设置
export const settingsAPI = {
  get: () => api.get<ConfigResponse>('/config'),
  update: (config: ConfigResponse) => api.put('/config/all', config),
  test: (config: ConfigResponse) => api.post<{ success: boolean; message: string }>('/config/test', {
    api_key: config.llm_api_key,
    base_url: config.llm_base_url,
    model: config.llm_model,
  }),
}

// 类型定义
export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  raw_markdown?: string
  created_at: string
  updated_at: string
}

export interface RecordingSession {
  id: string
  title?: string
  audio_path?: string
  screenshots: string[]
  asr_result?: string
  ocr_result?: string
  fused_data?: string
  note_id?: string
  status: string
  progress: number
  progress_message?: string
  created_at: string
  processed_at?: string
  processing_started_at?: string
}

export interface ReviewTask {
  id: string
  knowledge_id: string
  note_id: string
  title: string
  scheduled_time: string
  interval_label?: string
  status: string
  created_at: string
  completed_at?: string
}

export interface ReviewTaskCreate {
  knowledge_id: string
  note_id: string
  title: string
  scheduled_time: string
  interval_label?: string
}

export interface QAResponse {
  question: string
  answer: string
  sources: string[]
}

export interface ConfigResponse {
  llm_api_key: string | null
  llm_base_url: string | null
  llm_model: string | null
  whisper_api_key: string | null
}

export default api
