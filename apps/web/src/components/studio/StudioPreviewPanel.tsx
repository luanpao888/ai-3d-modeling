import { ArrowsAltOutlined, CodeOutlined, ExportOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Flex, Space, Spin, Typography } from 'antd';
import type { RefObject } from 'react';

const { Text } = Typography;

interface Props {
  t: (key: string) => string;
  activeProject: { id?: string } | null;
  isFullscreen: boolean;
  isRunning: boolean;
  previewShellRef: RefObject<HTMLDivElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  onOpenDsl: () => void;
  onToggleFullscreen: () => void | Promise<void>;
  onDownloadZip: () => void | Promise<void>;
  onExportGlb: () => void | Promise<void>;
}

export function StudioPreviewPanel({
  t,
  activeProject,
  isFullscreen,
  isRunning,
  previewShellRef,
  previewRef,
  onOpenDsl,
  onToggleFullscreen,
  onDownloadZip,
  onExportGlb
}: Props) {
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
        {isRunning && (
          <div className="studio-preview-overlay">
            <Spin size="large" />
          </div>
        )}
      </div>
    </Card>
  );
}