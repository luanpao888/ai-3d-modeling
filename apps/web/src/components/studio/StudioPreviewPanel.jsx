import { ArrowsAltOutlined, CodeOutlined, ExportOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Flex, Space, Typography } from 'antd';

const { Text } = Typography;

export function StudioPreviewPanel({
  t,
  activeProject,
  isFullscreen,
  previewShellRef,
  previewRef,
  onOpenDsl,
  onToggleFullscreen,
  onDownloadZip,
  onExportGlb
}) {
  const exportMenuItems = [
    {
      key: 'zip',
      label: t('actions.exportZip'),
      onClick: onDownloadZip
    },
    {
      key: 'glb',
      label: t('actions.exportGlb'),
      onClick: onExportGlb
    }
  ];

  return (
    <Card className="studio-card studio-preview-card" bordered={false}>
      <Flex justify="space-between" align="center" className="studio-preview-meta">
        <div>
          <Text className="studio-eyebrow">{t('labels.preview')}</Text>
          {/* <Text type="secondary">
            {t('labels.currentVersion')}: v{activeProject?.currentVersion?.versionNumber ?? 1}
          </Text> */}
        </div>
        <Space wrap>
          <Button icon={<CodeOutlined />} onClick={onOpenDsl}>
            {t('actions.editDsl')}
          </Button>
          <Button icon={<ArrowsAltOutlined />} onClick={onToggleFullscreen}>
            {isFullscreen ? t('actions.exitFullscreen') : t('actions.fullscreen')}
          </Button>
          <Dropdown menu={{ items: exportMenuItems }} trigger={['click']} disabled={!activeProject}>
            <Button icon={<ExportOutlined />} disabled={!activeProject}>
              {t('actions.export')}
            </Button>
          </Dropdown>
        </Space>
      </Flex>

      <div className="studio-preview-shell" ref={previewShellRef}>
        <div className="studio-preview-canvas" ref={previewRef} />
      </div>
    </Card>
  );
}
