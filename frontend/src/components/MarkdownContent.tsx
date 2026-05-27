import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
})

export function normalizeMarkdown(source: string): string {
  if (!source) return ''

  let text = source.replace(/\r\n/g, '\n').trim()

  const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }

  return text
}

interface MarkdownContentProps {
  children: string
  className?: string
}

export default function MarkdownContent({ children, className = 'markdown-body' }: MarkdownContentProps) {
  const content = normalizeMarkdown(children)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      const elements = Array.from(containerRef.current.querySelectorAll('.mermaid')) as HTMLElement[]
      if (elements.length > 0) {
        mermaid.run({
          nodes: Array.from(elements),
          suppressErrors: true,
        }).catch(() => {})
      }
    }
  }, [content])

  if (!content) {
    return <div className={className} style={{ color: 'var(--text-muted)' }}>暂无内容</div>
  }

  return (
    <div className={className} ref={containerRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || '')
            if (match && match[1] === 'mermaid') {
              const code = String(children).replace(/\n$/, '')
              return <div className="mermaid">{code}</div>
            }
            return <code className={className}>{children}</code>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}