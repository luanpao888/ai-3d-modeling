import {
  ClockCircleOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlusOutlined,
  RightOutlined
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography
} from 'antd';
import { useState } from 'react';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ProjectItem {
  id: string;
  name?: string;
  description?: string;
  units?: string;
  upAxis?: string;
  rotationUnit?: string;
  updatedAt?: string;
  currentVersion?: {
    versionNumber?: number;
    source?: string;
  };
}

interface VersionItem {
  id: string;
  versionNumber?: number;
  source?: string;
  prompt?: string;
  createdAt?: string;
}

interface CreateProjectData {
  name: string;
  description?: string;
  units: string;
  upAxis: string;
}

interface Props {
  t: (key: string) => string;
  projects: ProjectItem[];
  onCreateProject: (data: CreateProjectData) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onLoadVersions: (projectId: string) => Promise<VersionItem[]>;
}

const UNIT_KEYS = ['meter', 'centimeter', 'millimeter', 'inch', 'foot'] as const;

const UNIT_ABBR: Record<string, string> = {
  meter: 'm',
  centimeter: 'cm',
  millimeter: 'mm',
  inch: 'in',
  foot: 'ft'
};

export function ProjectsPage({ t, projects, onCreateProject, onOpenProject, onLoadVersions }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<CreateProjectData>();

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyProject, setHistoryProject] = useState<ProjectItem | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  async function handleOpenHistory(e: React.MouseEvent, project: ProjectItem) {
    e.stopPropagation();
    setHistoryProject(project);
    setVersions([]);
    setHistoryDrawerOpen(true);
    setVersionsLoading(true);
    try {
      setVersions(await onLoadVersions(project.id));
    } finally {
      setVersionsLoading(false);
    }
  }

  async function handleSubmit(values: CreateProjectData) {
    setSubmitting(true);
    try {
      await onCreateProject({ ...values, rotationUnit: 'radian' } as CreateProjectData & { rotationUnit: string });
      setModalOpen(false);
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenModal() {
    form.setFieldsValue({
      units: 'meter',
      upAxis: 'Y'
    });
    setModalOpen(true);
  }

  return (
    <div className="projects-page">
      <div className="projects-page__header">
        <div>
          <Text className="studio-eyebrow">Project agent workspace</Text>
          <Title level={2} className="projects-page__title">
            {t('nav.projects')}
          </Title>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={handleOpenModal}
        >
          {t('actions.createProject')}
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="projects-page__empty">
          <FolderOpenOutlined className="projects-page__empty-icon" />
          <Text type="secondary">{t('projects.noProjects')}</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenModal}>
            {t('actions.createProject')}
          </Button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="project-card"
              bordered={false}
              hoverable
              onClick={() => onOpenProject(project.id)}
            >
              <div className="project-card__body">
                <div className="project-card__meta">
                  <div className="project-card__top">
                    <Text strong className="project-card__name">
                      {project.name}
                    </Text>
                    <Badge
                      count={`v${project.currentVersion?.versionNumber ?? 1}`}
                      style={{ background: '#ebf5ff', color: '#0068d6', boxShadow: 'none', borderRadius: 999, fontWeight: 600, fontSize: 12 }}
                    />
                  </div>
                  {project.description ? (
                    <Text type="secondary" className="project-card__desc">
                      {project.description}
                    </Text>
                  ) : null}
                  <div className="project-card__tags">
                    {project.units ? (
                      <Tag className="studio-pill-tag">
                        {UNIT_ABBR[project.units] ?? project.units}
                      </Tag>
                    ) : null}
                    {project.upAxis ? (
                      <Tag className="studio-pill-tag">{project.upAxis}-up</Tag>
                    ) : null}
                  </div>
                </div>
                <div className="project-card__footer">
                  <Space size={4}>
                    <ClockCircleOutlined style={{ color: '#999', fontSize: 12 }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '—'}
                    </Text>
                  </Space>
                  <Text className="project-card__id">{project.id}</Text>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={<HistoryOutlined />}
                      onClick={(e) => handleOpenHistory(e, project)}
                      title={t('projects.viewHistory')}
                    />
                    <RightOutlined style={{ color: '#999' }} />
                  </Space>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        title={
          <div style={{ lineHeight: 1.5 }}>
            <Text strong>{historyProject?.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
              {historyProject?.id}
            </Text>
          </div>
        }
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        width={360}
      >
        {versionsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <Text type="secondary">{t('projects.noVersions')}</Text>
        ) : (
          <Timeline
            items={versions.map((v, index) => ({
              color: index === 0 ? '#0a72ef' : '#d9d9d9',
              children: (
                <div className="version-history-entry">
                  <div className="version-history-entry__top">
                    <Text strong>v{v.versionNumber}</Text>
                    {v.source ? (
                      <Tag className="studio-pill-tag" style={{ fontSize: 11, marginLeft: 8 }}>
                        {v.source}
                      </Tag>
                    ) : null}
                  </div>
                  {v.prompt ? (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                      {v.prompt.length > 80 ? v.prompt.slice(0, 80) + '…' : v.prompt}
                    </Text>
                  ) : null}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {v.createdAt ? new Date(v.createdAt).toLocaleString() : ''}
                  </Text>
                </div>
              )
            }))}
          />
        )}
      </Drawer>

      <Modal
        className="create-project-modal"
        title={t('actions.createProject')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ units: 'meter', upAxis: 'Y' }}
        >
          <Form.Item
            name="name"
            label={t('projects.form.name')}
            rules={[{ required: true, message: t('projects.form.nameRequired') }]}
          >
            <Input placeholder={t('defaults.projectName')} autoFocus />
          </Form.Item>

          <Form.Item name="description" label={t('projects.form.description')}>
            <TextArea rows={2} placeholder={t('projects.form.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item name="units" label={t('projects.form.units')}>
            <Select
              options={UNIT_KEYS.map((key) => ({
                value: key,
                label: (
                  <span>
                    <Text strong>{t(`projects.form.unitOptions.${key}.label`)}</Text>{' '}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t(`projects.form.unitOptions.${key}.desc`)}
                    </Text>
                  </span>
                )
              }))}
            />
          </Form.Item>

          <Form.Item name="upAxis" label={t('projects.form.upAxis')}>
            <Radio.Group>
              <Radio value="Y">Y-up <Text type="secondary">{t('projects.form.upAxisOptions.Y')}</Text></Radio>
              <Radio value="Z">Z-up <Text type="secondary">{t('projects.form.upAxisOptions.Z')}</Text></Radio>
            </Radio.Group>
          </Form.Item>

          <div className="create-project-modal__footer">
            <Button onClick={() => setModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {t('actions.createProject')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
