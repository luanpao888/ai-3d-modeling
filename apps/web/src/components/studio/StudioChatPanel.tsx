import { AppstoreOutlined, BuildOutlined, FolderOutlined, LayoutOutlined, LoadingOutlined, RadarChartOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Bubble, Sender } from '@ant-design/x';
import { Button, Card, Empty, Flex, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useEffect, useMemo, useRef, useState } from 'react';

import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

interface DslNodeRef {
  id?: string;
  name?: string;
  kind?: string;
  primitive?: string;
}

interface MessageItem {
  id: string;
  role: string;
  createdAt?: string;
  content?: { text?: string } | Record<string, unknown>;
}

interface QuestionItem {
  id: string;
  prompt: string;
  createdAt?: string;
  options?: string[];
  status?: string;
  decision?: string;
}

interface DecisionItem {
  id: string;
  createdAt?: string;
  selectedOption: string;
  rationale?: string;
}

interface HistoryState {
  messages?: MessageItem[];
  questions?: QuestionItem[];
  decisions?: DecisionItem[];
}

interface Props {
  t: (key: string) => string;
  locale: string;
  statusText?: string;
  session: { id: string } | null;
  prompt: string;
  setPrompt: (value: string) => void;
  senderResetKey: number;
  isRunning: boolean;
  streamingText?: string;
  isStreaming?: boolean;
  history: HistoryState;
  hasMoreHistory: boolean;
  isLoadingOlderHistory: boolean;
  onSend: (value?: string) => void;
  onResolveQuestion: (questionId: string, option: string) => void;
  onLoadOlderHistory: () => void;
  dslNodes?: DslNodeRef[];
}

export function StudioChatPanel({
  t,
  locale,
  statusText,
  session,
  prompt,
  setPrompt,
  senderResetKey,
  isRunning,
  streamingText = '',
  isStreaming = false,
  history,
  hasMoreHistory,
  isLoadingOlderHistory,
  onSend,
  onResolveQuestion,
  onLoadOlderHistory,
  dslNodes = []
}: Props) {
  const [isAtTop, setIsAtTop] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const mentionNodes = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return dslNodes
      .filter((n) => !q || (n.name ?? n.id ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, dslNodes]);

  function handlePromptChange(value: string) {
    setPrompt(value);
    const match = value.match(/@([\u4e00-\u9fa5\w]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function handleMentionSelect(node: DslNodeRef) {
    const name = node.name ?? node.id ?? '';
    const next = prompt.replace(/@[\u4e00-\u9fa5\w]*$/, `@${name} `);
    setPrompt(next);
    setMentionQuery(null);
  }

  function handleSubmit(value?: string) {
    const raw = String(value ?? prompt).trim();
    // Expand @name → [node:id name=name] for AI context
    const expanded = raw.replace(/@([\u4e00-\u9fa5\w]+)/g, (m, name) => {
      const found = dslNodes.find((n) => (n.name ?? n.id) === name);
      return found?.id ? `[node:${found.id} name=${name}]` : m;
    });
    onSend(expanded);
  }
  const prevItemCountRef = useRef(0);

  const mergedTimelineItems = useMemo(() => {
    const records: Array<{ key: string; role: 'user' | 'ai' | 'system'; order: number; content: React.ReactNode }> = [];
    let latestOrder = 0;

    for (const message of history.messages ?? []) {
      const messageText = getMessageContent(message.content).trim();
      if (!messageText) {
        continue;
      }

      const timestamp = formatCompactTime(message.createdAt, locale);
      const order = Date.parse(message.createdAt || '') || 0;
      latestOrder = Math.max(latestOrder, order);
      records.push({
        key: `message-${message.id}`,
        role: message.role === 'assistant' ? 'ai' : 'user',
        order,
        content: (
          <div className="studio-message-block">
            <div>{messageText}</div>
            {timestamp ? <Text type="secondary" className="studio-message-time">{timestamp}</Text> : null}
          </div>
        )
      });
    }

    for (const question of history.questions ?? []) {
      if (question.status === 'resolved' && question.decision === 'superseded') {
        continue;
      }

      const timestamp = formatCompactTime(question.createdAt, locale);
      const order = Date.parse(question.createdAt || '') || 0;
      latestOrder = Math.max(latestOrder, order);
      records.push({
        key: `question-${question.id}`,
        role: 'ai',
        order,
        content: (
          <div className="studio-question-block">
            <Text strong>{question.prompt}</Text>
            <Space wrap>
              {(question.options ?? []).map((option) => (
                <Button
                  key={option}
                  size="small"
                  className="studio-option-button"
                  onClick={() => onResolveQuestion(question.id, option)}
                  disabled={question.status !== 'pending' || isRunning}
                >
                  {option}
                </Button>
              ))}
            </Space>
            <Text type="secondary">
              {question.status === 'pending' ? t('status.waitingUser') : t('labels.resolved')}
            </Text>
            {timestamp ? <Text type="secondary" className="studio-message-time">{timestamp}</Text> : null}
          </div>
        )
      });
    }

    if (isStreaming) {
      records.push({
        key: 'message-streaming',
        role: 'ai',
        order: latestOrder + 1,
        content: (
          <div className="studio-message-block studio-message-block--streaming">
            <div>
              {streamingText || <span className="studio-streaming-cursor" />}
            </div>
          </div>
        )
      });
    }

    records.sort((left, right) => left.order - right.order);
    return records;
  }, [history.decisions, history.messages, history.questions, isRunning, isStreaming, locale, onResolveQuestion, streamingText, t]);

  const roleConfig = useMemo(
    () => ({
      user: {
        placement: 'end',
        variant: 'shadow',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--user"><UserOutlined /></div>
      },
      ai: {
        placement: 'start',
        variant: 'shadow',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--ai"><RobotOutlined /></div>
      },
      system: {
        placement: 'start',
        variant: 'outlined',
        avatar: <div className="studio-bubble-avatar studio-bubble-avatar--system"><AppstoreOutlined /></div>
      }
    }),
    []
  );

  const canLoadMore = Boolean(hasMoreHistory);

  // Scroll to bottom when new messages are appended (not when loading older history)
  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) {
      return;
    }
    const prevCount = prevItemCountRef.current;
    const nextCount = mergedTimelineItems.length;
    prevItemCountRef.current = nextCount;
    if (nextCount > prevCount && !isLoadingOlderHistory) {
      container.scrollTop = container.scrollHeight;
    }
  }, [mergedTimelineItems.length, isLoadingOlderHistory]);

  // Scroll to bottom while streaming tokens arrive
  useEffect(() => {
    if (!isStreaming) return;
    const container = timelineScrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isStreaming, streamingText]);

  function handleTimelineScroll(event: React.UIEvent<HTMLDivElement>) {
    setIsAtTop(event.currentTarget.scrollTop <= 24);

    if (!canLoadMore) {
      return;
    }

    if (event.currentTarget.scrollTop <= 24) {
      onLoadOlderHistory();
    }
  }

  function handleTimelineWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!canLoadMore || event.deltaY >= 0) {
      return;
    }

    const container = timelineScrollRef.current;
    if (!container) {
      return;
    }

    const reachedTop = container.scrollTop <= 24;
    const hasNoOverflow = container.scrollHeight <= container.clientHeight;
    if (reachedTop || hasNoOverflow) {
      setIsAtTop(true);
      onLoadOlderHistory();
    }
  }

  return (
    <Card className="studio-card studio-chat-card" bordered={false}>
      <Flex justify="space-between" align="center" className="studio-chat-head">
        <div>
          <Text className="studio-eyebrow">{t('labels.chatTitle')}</Text>
          <Title level={4} className="studio-chat-title">
            {session ? t('labels.sessionHistory') : t('actions.createSession')}
          </Title>
          {statusText ? <Text type="secondary" className="studio-chat-status">{statusText}</Text> : null}
        </div>
        <Tag className="studio-pill-tag">{mergedTimelineItems.length}</Tag>
      </Flex>

      {mergedTimelineItems.length ? (
        <div className="studio-chat-scroll" ref={timelineScrollRef} onScroll={handleTimelineScroll} onWheel={handleTimelineWheel}>
          {canLoadMore ? <Text type="secondary" className="studio-chat-load-more">{isLoadingOlderHistory ? t('labels.loadingMore') : t('labels.pullToLoadPrevious')}</Text> : null}
          {!canLoadMore && isAtTop ? <Text type="secondary" className="studio-chat-load-more">{t('labels.noMoreMessagesTop')}</Text> : null}
          <Bubble.List className="studio-bubble-list" items={mergedTimelineItems as any} role={roleConfig as any} />
        </div>
      ) : (
        <div className="studio-empty-chat">
          <Empty description={t('labels.noMessages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}

      <div className="studio-sender-wrap">
        {mentionQuery !== null && mentionNodes.length > 0 && (
          <div className="studio-mention-panel">
            {mentionNodes.map((node) => (
              <button
                key={node.id}
                className="studio-mention-item"
                onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(node); }}
              >
                {node.kind === 'group' ? <FolderOutlined /> :
                 node.kind === 'constructed' ? <BuildOutlined /> :
                 (node.primitive === 'sphere' || node.primitive === 'cylinder') ? <RadarChartOutlined /> :
                 node.kind === 'asset' ? <AppstoreOutlined /> : <LayoutOutlined />}
                <span className="studio-mention-name">{node.name ?? node.id}</span>
                {node.id && <span className="studio-mention-id">#{node.id}</span>}
              </button>
            ))}
          </div>
        )}
        <Sender
          key={senderResetKey}
          value={prompt}
          loading={isRunning}
          submitType="enter"
          onChange={handlePromptChange}
          onSubmit={handleSubmit}
          placeholder={t('labels.aiPrompt')}
          autoSize={{ minRows: 3, maxRows: 6 }}
          footer={<Text type="secondary">{t('labels.ctrlEnter')}</Text>}
          suffix={(oriNode) =>
            isRunning ? (
              <Button shape="circle" type="primary" icon={<LoadingOutlined spin />} disabled />
            ) : (
              oriNode
            )
          }
        />
      </div>
    </Card>
  );
}

function getMessageContent(content: MessageItem['content']): string {
  if (!content) {
    return '';
  }

  if ('text' in content && typeof content.text === 'string') {
    return content.text;
  }

  return JSON.stringify(content, null, 2);
}

function formatCompactTime(isoTime: string | undefined, locale: string): string | null {
  if (!isoTime) {
    return null;
  }

  const time = dayjs(isoTime);
  if (!time.isValid()) {
    return null;
  }

  const now = dayjs();
  const diffInMinutes = Math.abs(now.diff(time, 'minute'));
  const isZh = locale.toLowerCase().startsWith('zh');
  const dayjsLocale = isZh ? 'zh-cn' : 'en';
  const absolute = time.locale(dayjsLocale).format('HH:mm');

  if (diffInMinutes < 1) {
    return isZh ? `刚刚 · ${absolute}` : `now · ${absolute}`;
  }

  if (diffInMinutes < 60) {
    return isZh ? `${diffInMinutes}分前 · ${absolute}` : `${diffInMinutes}m ago · ${absolute}`;
  }

  const diffInHours = Math.abs(now.diff(time, 'hour'));
  if (diffInHours < 24) {
    return isZh ? `${diffInHours}小时前 · ${absolute}` : `${diffInHours}h ago · ${absolute}`;
  }

  const diffInDays = Math.abs(now.diff(time, 'day'));
  if (diffInDays < 30) {
    return isZh ? `${diffInDays}天前 · ${absolute}` : `${diffInDays}d ago · ${absolute}`;
  }

  return time.locale(dayjsLocale).format(isZh ? 'MM-DD HH:mm' : 'MMM D HH:mm');
}