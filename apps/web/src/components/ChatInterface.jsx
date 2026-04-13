import { useEffect, useRef, useState } from 'react';

export function ChatInterface({
  history,
  events,
  session,
  isRunning,
  prompt,
  onPromptChange,
  onSendMessage,
  onResolveQuestion,
  pendingQuestions,
  t
}) {
  const messagesContainerRef = useRef(null);
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Combine messages, questions, decisions, and events into unified timeline
  useEffect(() => {
    const combined = [];

    // Add messages
    if (history.messages) {
      history.messages.forEach((msg) => {
        combined.push({
          id: `msg-${msg.id}`,
          type: 'message',
          role: msg.role,
          timestamp: msg.createdAt,
          content: msg.content?.text ?? JSON.stringify(msg.content),
          order: msg.createdAt || 0
        });
      });
    }

    // Add questions
    if (history.questions) {
      history.questions.forEach((q) => {
        combined.push({
          id: `q-${q.id}`,
          type: 'question',
          timestamp: q.createdAt,
          questionId: q.id,
          prompt: q.prompt,
          options: q.options,
          status: q.status,
          order: q.createdAt || 0
        });
      });
    }

    // Add decisions
    if (history.decisions) {
      history.decisions.forEach((d) => {
        combined.push({
          id: `dec-${d.id}`,
          type: 'decision',
          timestamp: d.createdAt,
          option: d.selectedOption,
          rationale: d.rationale,
          order: d.createdAt || 0
        });
      });
    }

    // Add events
    if (events) {
      events.forEach((evt) => {
        combined.push({
          id: evt.id,
          type: 'event',
          event: evt.event,
          payload: evt.payload,
          order: Date.parse(evt.id) || 0
        });
      });
    }

    // Sort by timestamp/order (oldest first)
    combined.sort((a, b) => (a.order || 0) - (b.order || 0));

    setDisplayedMessages(combined);

    // Auto-scroll to bottom when new messages arrive
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 0);
  }, [history, events]);

  function handleScroll(e) {
    const { scrollTop } = e.target;
    // When scrolled to top, could load more (for future pagination)
    if (scrollTop === 0 && !loadingMore && displayedMessages.length > 0) {
      // This will be populated when backend supports pagination
      setLoadingMore(false);
    }
  }

  function handleSend() {
    if (prompt.trim() && onSendMessage) {
      onSendMessage();
    }
  }

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-title">
          <h3>{session ? t(`modes.${session.mode}`) : t('labels.chatTitle')}</h3>
          {session && <span className="session-id-badge">{session.id.slice(0, 8)}...</span>}
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
        {displayedMessages.length === 0 ? (
          <div className="chat-empty">
            <p className="muted">{t('labels.noMessages')}</p>
          </div>
        ) : null}

        {displayedMessages.map((item) => (
          <div key={item.id} className={`chat-item chat-item-${item.type}`}>
            {item.type === 'message' && (
              <div className={`message-bubble ${item.role}`}>
                <div className="message-role">{item.role}</div>
                <div className="message-content">{item.content}</div>
              </div>
            )}

            {item.type === 'question' && (
              <div className="assistant-message question-bubble">
                <div className="message-role">🤔 {t('labels.decision')}</div>
                <div className="question-prompt">{item.prompt}</div>
                {item.status === 'pending' ? (
                  <div className="question-options">
                    {item.options.map((option, idx) => (
                      <button
                        key={idx}
                        className="option-chip"
                        onClick={() => onResolveQuestion(item.questionId, option)}
                        disabled={isRunning}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="question-resolved">
                    <span className="resolved-indicator">✓</span> {t('labels.resolved')}
                  </div>
                )}
              </div>
            )}

            {item.type === 'decision' && (
              <div className="system-message decision-message">
                <div className="message-role">✓ {t('labels.decision')}</div>
                <div>
                  <strong>{item.option}</strong>
                  {item.rationale && <div className="muted">{item.rationale}</div>}
                </div>
              </div>
            )}

            {item.type === 'event' && (
              <div className="system-message event-message">
                <div className="message-role">⚙ Event</div>
                <div>
                  <strong>{item.event}</strong>
                  <pre>{JSON.stringify(item.payload, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        ))}

        {loadingMore && <div className="loading-indicator">{t('labels.loadingMore')}</div>}
      </div>

      <div className="chat-input-section">
        <textarea
          className="chat-input"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={t('labels.aiPrompt')}
          disabled={isRunning}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSend();
            }
          }}
        />
        <div className="input-actions">
          <span className="input-hint">{t('labels.ctrlEnter')}</span>
          <button onClick={handleSend} disabled={isRunning || !prompt.trim()}>
            {t('actions.sendMessage')}
          </button>
        </div>
      </div>
    </div>
  );
}
