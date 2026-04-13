import { Button, Input, Modal, Space, Tabs, Tag } from 'antd';
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
                <Input.TextArea
                  value={dslDraft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  autoSize={{ minRows: 20, maxRows: 28 }}
                  className="studio-dsl-editor"
                />
              </Space>
            )
          }
        ]}
      />
    </Modal>
  );
}
