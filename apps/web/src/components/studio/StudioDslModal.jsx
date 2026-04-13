import { Button, Input, Modal, Space, Tabs, Tag } from 'antd';
import Editor from '@monaco-editor/react';
import JsonView from 'react18-json-view';

export function StudioDslModal({
  t,
  open,
  onClose,
  dslTab,
  onTabChange,
  dslDraft,
  onDraftChange,
  dslObject,
  dslDraftError,
  onFormat,
  onSave
}) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('labels.sceneDsl')}
      width={920}
      className="studio-dsl-modal"
      footer={[
        <Button key="format" onClick={onFormat}>
          {t('actions.formatJson')}
        </Button>,
        <Button key="cancel" onClick={onClose}>
          {t('actions.cancel')}
        </Button>,
        <Button key="save" type="primary" disabled={Boolean(dslDraftError)} onClick={onSave}>
          {t('actions.saveDsl')}
        </Button>
      ]}
    >
      <Tabs
        activeKey={dslTab}
        onChange={onTabChange}
        items={[
          {
            key: 'viewer',
            label: t('labels.dslViewer'),
            children: (
              <div className="studio-json-view-shell">
                <JsonView src={dslObject} theme="github" collapsed={2} displaySize="expanded" />
              </div>
            )
          },
          {
            key: 'editor',
            label: t('labels.dslEditor'),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {dslDraftError ? <Tag color="error">{dslDraftError}</Tag> : <Tag color="success">{t('labels.jsonValid')}</Tag>}
                <div style={{ 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px',
                  overflow: 'hidden',
                  height: '520px'
                }}>
                  <Editor
                    height="100%"
                    language="json"
                    theme="light"
                    value={dslDraft}
                    onChange={(value) => onDraftChange(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: '"GeistMono", "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      wordWrap: 'on',
                      formatOnPaste: true,
                      formatOnType: true,
                      automaticLayout: true,
                      bracketPairColorization: { enabled: true }
                    }}
                  />
                </div>
              </Space>
            )
          }
        ]}
      />
    </Modal>
  );
}
