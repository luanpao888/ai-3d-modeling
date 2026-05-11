import { CaretRightOutlined, CodeOutlined, LoadingOutlined } from '@ant-design/icons';
import { Collapse, Typography } from 'antd';
import { useMemo, useState } from 'react';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Segment {
  type: 'text' | 'think' | 'code';
  content: string;
  /** language hint for code blocks */
  lang?: string;
  /** true when the block is still open (streaming) */
  open?: boolean;
}

interface MessageCardProps {
  /** Raw message content – may contain <think>…</think> and fenced code blocks */
  content: string;
  /** Whether tokens are still arriving for this message */
  isStreaming?: boolean;
  /** Formatted timestamp string (already localised by caller) */
  timestamp?: string | null;
  t: (key: string) => string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Splits raw AI output into typed segments:
 *   - `think`  → <think>…</think> blocks
 *   - `code`   → fenced code blocks (```lang\n…```)
 *   - `text`   → everything else
 *
 * When a block is still unclosed (streaming), the segment is marked `open: true`.
 */
function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = [];

  // We walk the string state-machine style so we handle nesting edge-cases.
  let remaining = raw;

  while (remaining.length > 0) {
    // --- think block ---
    const thinkStart = remaining.indexOf('<think>');
    const codeStart = remaining.search(/```/);

    // Determine which special token comes first (or neither)
    const nextSpecial =
      thinkStart === -1 && codeStart === -1
        ? -1
        : thinkStart === -1
        ? codeStart
        : codeStart === -1
        ? thinkStart
        : Math.min(thinkStart, codeStart);

    if (nextSpecial === -1) {
      // No more special tokens – rest is plain text
      if (remaining.trim()) segments.push({ type: 'text', content: remaining });
      break;
    }

    // Push any leading plain text before the special token
    if (nextSpecial > 0) {
      const leadText = remaining.slice(0, nextSpecial);
      if (leadText.trim()) segments.push({ type: 'text', content: leadText });
      remaining = remaining.slice(nextSpecial);
    }

    if (remaining.startsWith('<think>')) {
      remaining = remaining.slice('<think>'.length);
      const closeIdx = remaining.indexOf('</think>');
      if (closeIdx === -1) {
        // Still open
        segments.push({ type: 'think', content: remaining, open: true });
        remaining = '';
      } else {
        segments.push({ type: 'think', content: remaining.slice(0, closeIdx), open: false });
        remaining = remaining.slice(closeIdx + '</think>'.length);
      }
    } else if (remaining.startsWith('```')) {
      // Fenced code block
      const afterFence = remaining.slice(3);
      const langEnd = afterFence.indexOf('\n');
      const lang = langEnd === -1 ? '' : afterFence.slice(0, langEnd).trim();
      const body = langEnd === -1 ? '' : afterFence.slice(langEnd + 1);
      const closeIdx = body.indexOf('\n```');
      if (closeIdx === -1) {
        // Still open
        segments.push({ type: 'code', content: body, lang, open: true });
        remaining = '';
      } else {
        segments.push({ type: 'code', content: body.slice(0, closeIdx), lang, open: false });
        remaining = body.slice(closeIdx + '\n```'.length);
      }
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ThinkBlock({ content, open, t }: { content: string; open?: boolean; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);

  if (open) {
    // Still streaming – show animated "thinking" indicator
    return (
      <div className="msg-think-streaming">
        <LoadingOutlined className="msg-think-icon" />
        <Text type="secondary" className="msg-think-label">{t('labels.thinking')}</Text>
        {content.trim() && (
          <div className="msg-think-preview">
            <Text type="secondary">{content.slice(-120)}</Text>
          </div>
        )}
      </div>
    );
  }

  const lineCount = content.split('\n').length;
  const label = expanded ? t('labels.hideThinking') : `${t('labels.showThinking')} · ${lineCount} ${t('labels.lines')}`;

  return (
    <div className="msg-think-block">
      <button
        className={`msg-collapse-trigger msg-collapse-trigger--think ${expanded ? 'msg-collapse-trigger--open' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <CaretRightOutlined className="msg-caret" />
        <Text type="secondary">{label}</Text>
      </button>
      {expanded && (
        <pre className="msg-think-content">{content.trimEnd()}</pre>
      )}
    </div>
  );
}

function CodeBlock({ content, lang, open, t }: { content: string; lang?: string; open?: boolean; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const lineCount = lines.length;
  const preview = lines.slice(0, 2).join('\n');

  if (open) {
    return (
      <div className="msg-code-block msg-code-block--streaming">
        <div className="msg-code-header">
          <CodeOutlined className="msg-code-icon" />
          {lang && <Text code className="msg-code-lang">{lang}</Text>}
          <LoadingOutlined className="msg-think-icon" style={{ marginLeft: 'auto' }} />
        </div>
        <pre className="msg-code-body msg-code-body--preview">{preview}{lineCount > 2 ? '\n…' : ''}</pre>
      </div>
    );
  }

  const headerLabel = expanded
    ? t('labels.hideCode')
    : `${t('labels.showCode')} · ${lineCount} ${t('labels.lines')}`;

  return (
    <div className="msg-code-block">
      <button
        className={`msg-collapse-trigger msg-collapse-trigger--code ${expanded ? 'msg-collapse-trigger--open' : ''}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <CaretRightOutlined className="msg-caret" />
        <CodeOutlined className="msg-code-icon" />
        {lang && <Text code className="msg-code-lang">{lang}</Text>}
        <Text type="secondary" className="msg-code-summary">{headerLabel}</Text>
      </button>
      {expanded && (
        <pre className="msg-code-body">{content.trimEnd()}</pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageCard
// ---------------------------------------------------------------------------

export function MessageCard({ content, isStreaming, timestamp, t }: MessageCardProps) {
  const segments = useMemo(() => parseSegments(content), [content]);

  return (
    <div className="msg-card">
      {segments.map((seg, idx) => {
        if (seg.type === 'think') {
          return <ThinkBlock key={idx} content={seg.content} open={seg.open} t={t} />;
        }
        if (seg.type === 'code') {
          return <CodeBlock key={idx} content={seg.content} lang={seg.lang} open={seg.open} t={t} />;
        }
        // plain text
        return (
          <div key={idx} className="msg-text">
            {seg.content}
            {isStreaming && idx === segments.length - 1 && (
              <span className="studio-streaming-cursor" />
            )}
          </div>
        );
      })}
      {/* If all segments are think/code with no trailing text but still streaming */}
      {isStreaming && segments.length > 0 && segments[segments.length - 1].type !== 'text' && (
        <span className="studio-streaming-cursor" />
      )}
      {timestamp && (
        <Text type="secondary" className="studio-message-time">{timestamp}</Text>
      )}
    </div>
  );
}
