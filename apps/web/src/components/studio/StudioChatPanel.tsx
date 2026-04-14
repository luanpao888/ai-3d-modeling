import { AppstoreOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Bubble, Sender } from '@ant-design/x';
import { Button, Card, Empty, Flex, Space, Tag, Typography } from 'antd';
import { useMemo, useRef, useState } from 'react';

const { Text, Title } = Typography;

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

interface EventItem {
  id: string;
  event: string;
  payload: unknown;
}

interface Props {
  t: (key: string) => string;
  session: { id: string } | null;
  prompt: string;
  setPrompt: (value: string) => void;
  senderResetKey: number;
  isRunning: boolean;
  history: HistoryState;
  hasMoreHistory: boolean;
  isLoadingOlderHistory: boolean;
  events: EventItem[];
  onSend: (value?: string) => void;
  onResolveQuestion: (questionId: string, option: string) => void;
  onLoadOlderHistory: () => void;
}

export function StudioChatPanel({
  t,
  session,
  prompt,
  setPrompt,
  senderResetKey,
  isRunning,
  history,
  hasMoreHistory,
  isLoadingOlderHistory,
  events,
  onSend,
  onResolveQuestion,
  onLoadOlderHistory
}: Props) {
  const [isAtTop, setIsAtTop] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const mergedTimelineItems = useMemo(() => {
    const records: Array<{ key: string; role: 'user' | 'ai' | 'system'; order: number; content: React.ReactNode }> = [];

    for (const message of history.messages ?? []) {
      records.push({
        key: `message-${message.id}`,
        role: message.role === 'assistant' ? 'ai' : 'user',
        order: Date.parse(message.createdAt || '') || 0,
        content: getMessageContent(message.content)
      });
    }

    for (const question of history.questions ?? []) {
      records.push({
        key: `question-${question.id}`,
        role: 'ai',
        order: Date.parse(question.createdAt || '') || 0,
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
          </div>
        )
      });
    }

    for (const decision of history.decisions ?? []) {
      records.push({
        key: `decision-${decision.id}`,
        role: 'system',
        order: Date.parse(decision.createdAt || '') || 0,
        content: (
          <div className="studio-system-block">
            <Text strong>{t('labels.decision')}</Text>
            <Text>{decision.selectedOption}</Text>
            {decision.rationale ? <Text type="secondary">{decision.rationale}</Text> : null}
          </div>
        )
      });
    }

    const eventBase = Date.now();
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      records.push({
        key: event.id,
        role: 'system',
        order: eventBase + index,
        content: (
          <div className="studio-system-block">
            <Text strong>{event.event}</Text>
            <pre className="studio-event-pre">{JSON.stringify(event.payload, null, 2)}</pre>
          </div>
        )
      });
    }

    records.sort((left, right) => left.order - right.order);
    return records;
  }, [events, history.decisions, history.messages, history.questions, isRunning, onResolveQuestion, t]);

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
        <Sender
          key={senderResetKey}
          loading={isRunning}
          submitType="enter"
          onChange={setPrompt}
          onSubmit={(value) => onSend(String(value ?? ''))}
          placeholder={t('labels.aiPrompt')}
          autoSize={{ minRows: 3, maxRows: 6 }}
          footer={<Text type="secondary">{t('labels.ctrlEnter')}</Text>}
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