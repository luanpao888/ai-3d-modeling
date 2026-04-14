import { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  dslText: string;
  onClose: () => void;
  onSave: (value: string) => void;
  t: (key: string) => string;
}

export function DslEditorModal({ isOpen, dslText, onClose, onSave, t }: Props) {
  const [editText, setEditText] = useState(dslText);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setEditText(dslText);
    setError('');
    setIsSaved(false);
  }, [dslText, isOpen]);

  if (!isOpen) {
    return null;
  }

  function validateJson(text: string) {
    try {
      JSON.parse(text);
      setError('');
      return true;
    } catch (e) {
      setError(`${t('errors.jsonInvalid')}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(editText);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditText(formatted);
      setError('');
    } catch (e) {
      setError(`${t('errors.jsonInvalid')}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleSave() {
    if (validateJson(editText)) {
      onSave(editText);
      setIsSaved(true);
      setTimeout(() => {
        onClose();
      }, 500);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('labels.sceneDsl')}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="dsl-editor-container">
          <textarea
            className="dsl-editor-textarea"
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value);
              setError('');
            }}
            spellCheck="false"
          />
        </div>

        {error && <div className="editor-error">{error}</div>}
        {isSaved && <div className="editor-success">{t('status.dslSaved')}</div>}

        <div className="modal-actions">
          <button className="secondary" onClick={handleFormat}>
            {t('actions.formatJson')}
          </button>
          <div style={{ flex: 1 }} />
          <button className="secondary" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button onClick={handleSave}>{t('actions.saveDsl')}</button>
        </div>
      </div>
    </div>
  );
}