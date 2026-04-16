import {
  AppstoreOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { Badge, Button, List, Typography } from 'antd';

const { Text } = Typography;

interface AssetItem {
  id: string;
  name?: string;
}

interface Props {
  t: (key: string) => string;
  assets: AssetItem[];
  onNavigateToProjects: () => void;
}

export function StudioSidebar({ t, assets, onNavigateToProjects }: Props) {
  return (
    <div className="studio-sidebar">
      <div className="studio-sidebar__back">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onNavigateToProjects}
          className="studio-sidebar__back-btn"
        >
          {t('nav.projects')}
        </Button>
      </div>

      <div className="studio-sidebar__section">
        <div className="studio-sidebar__section-header">
          <Text className="studio-eyebrow studio-sidebar__section-label">{t('sidebar.assetRegistry')}</Text>
          <Badge count={assets.length} style={{ background: '#ebebeb', color: '#171717' }} />
        </div>
        <List
          dataSource={assets}
          renderItem={(asset) => (
            <List.Item className="studio-asset-row">
              <List.Item.Meta
                avatar={<AppstoreOutlined className="studio-asset-icon" />}
                title={<Text>{asset.name}</Text>}
                description={<Text type="secondary">{asset.id}</Text>}
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}

