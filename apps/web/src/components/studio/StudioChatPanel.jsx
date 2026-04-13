import { AppstoreOutlined, RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { Bubble, Sender } from '@ant-design/x';
import { Button, Card, Empty, Flex, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';

const { Text, Title } = Typography;

export function StudioChatPanel({
  t,
  session,
  sessionMode,
  prompt,
  setPrompt,
  isRunning,
  history,
  events,
  onSend,
  onResolveQuestion
}) {
  const mergedTimelineItems = useMemo(() => {
    const records = [];

    for (const message of history.messages ?? []) {
      records.push({
        key: `message-${message.id}`,
        role: message.role === 'assistant' ? 'ai' : 'user',
        order: Date.parse(message.createdAt || '') || 0,
        content: message.content?.text ?? JSON.stringify(message.content, null, 2)
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

  return (
    <Card className="studio-card studio-chat-card" bordered={false}>
      <Flex justify="space-between" align="center" className="studio-chat-head">
        <div>
          <Text className="studio-eyebrow">{t('labels.chatTitle')}</Text>
          <Title level={4} className="studio-chat-title">
            {session ? t(`modes.${session.mode}`) : t('actions.createSession')}
          </Title>
        </div>
        <Tag className="studio-pill-tag">{mergedTimelineItems.length}</Tag>
      </Flex>

      {mergedTimelineItems.length ? (
        <Bubble.List className="studio-bubble-list" items={mergedTimelineItems} role={roleConfig} autoScroll />
      ) : (
        <div className="studio-empty-chat">
          <Empty description={t('labels.noMessages')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}

      <div className="studio-sender-wrap">
        <Sender
          value={prompt}
          loading={isRunning}
          submitType="enter"
          onChange={setPrompt}
          onSubmit={onSend}
          placeholder={t('labels.aiPrompt')}
          autoSize={{ minRows: 3, maxRows: 6 }}
          prefix={<Tag className="studio-pill-tag studio-mode-tag">{t(`modes.${sessionMode}`)}</Tag>}
          footer={
            <Flex justify="space-between" align="center" className="studio-sender-footer">
              <Text type="secondary">{t('labels.ctrlEnter')}</Text>
              <Button type="primary" icon={<SendOutlined />} onClick={onSend} loading={isRunning}>
                {t('actions.sendMessage')}
              </Button>
            </Flex>
          }
        />
      </div>
    </Card>
  );
}
