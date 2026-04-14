import {
  AppstoreOutlined,
  CodeOutlined,
  FolderOpenOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { Badge, Button, Card, Input, List, Space, Tag, Timeline, Typography } from 'antd';
import { Conversations } from '@ant-design/x';
import type { ReactNode } from 'react';

const { Text, Title } = Typography;

interface ProjectItem {
  id: string;
  name?: string;
  currentVersion?: {
    versionNumber?: number;
  };
}

interface VersionItem {
  versionNumber?: number;
  source?: string;
}

interface AssetItem {
  id: string;
  name?: string;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  t: (key: string) => string;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  onCreateProject: () => void;
  projects: ProjectItem[];
  activeProjectId?: string;
  onOpenProject: (projectId: string) => void;
  versions: VersionItem[];
  assets: AssetItem[];
}

export function StudioSidebar({
  collapsed,
  onToggle,
  t,
  projectName,
  onProjectNameChange,
  onCreateProject,
  projects,
  activeProjectId,
  onOpenProject,
  versions,
  assets
}: Props) {
  const projectConversationItems = projects.map((project) => ({
    key: project.id,
    label: (
      <div className="studio-project-row">
        <div className="studio-project-row__top">
          <Text className="studio-project-name">{project.name}</Text>
          <Tag bordered={false} className="studio-version-tag">
            v{project.currentVersion?.versionNumber ?? 1}
          </Tag>
        </div>
        <Text className="studio-project-id">{project.id}</Text>
      </div>
    ) as ReactNode,
    icon: <FolderOpenOutlined />
  }));

  return (
    <>
      <div className="studio-sider-top">
        <Button
          type="text"
          className="studio-collapse-button"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
        />
        {!collapsed ? (
          <div className="studio-brand-copy">
            <Text className="studio-eyebrow">Project agent workspace</Text>
            <Title level={3}>{t('app.title')}</Title>
            <Text>{t('app.tagline')}</Text>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="studio-sider-scroll">
          <Card className="studio-card" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Text className="studio-eyebrow">{t('sidebar.newProject')}</Text>
              <Input value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} />
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreateProject}>
                {t('actions.createProject')}
              </Button>
            </Space>
          </Card>

          <Card
            className="studio-card"
            bordered={false}
            title={t('sidebar.projects')}
            extra={<Badge count={projects.length} style={{ background: '#ebf5ff', color: '#0068d6' }} />}
          >
            <Conversations
              items={projectConversationItems}
              activeKey={activeProjectId}
              onActiveChange={(key) => onOpenProject(String(key))}
              className="studio-conversations"
            />
          </Card>

          <Card className="studio-card" bordered={false} title={t('sidebar.versions')}>
            <Timeline
              items={versions.map((version) => ({
                color: '#0a72ef',
                children: (
                  <div className="studio-timeline-entry">
                    <Text strong>v{version.versionNumber}</Text>
                    <Text type="secondary">{version.source}</Text>
                  </div>
                )
              }))}
            />
          </Card>

          <Card
            className="studio-card"
            bordered={false}
            title={t('sidebar.assetRegistry')}
            extra={<Badge count={assets.length} style={{ background: '#ebebeb', color: '#171717' }} />}
          >
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
          </Card>
        </div>
      ) : (
        <div className="studio-sider-collapsed-icons">
          <Button type="text" icon={<FolderOpenOutlined />} />
          <Button type="text" icon={<CodeOutlined />} />
          <Button type="text" icon={<RobotOutlined />} />
        </div>
      )}
    </>
  );
}