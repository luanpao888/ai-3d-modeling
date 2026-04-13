import { Button, Card, Flex, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd';

const { Text, Title } = Typography;

export function StudioToolbar({
  t,
  activeProject,
  statusText,
  locale,
  setLocale,
  languages,
  sessionMode,
  setSessionMode,
  transportMode,
  session
}) {
  return (
    <Card className="studio-card studio-toolbar" bordered={false}>
      <Flex justify="space-between" align="center" gap={16} wrap>
        <div>
          <Text className="studio-eyebrow">Current workspace</Text>
          <Title level={3} className="studio-toolbar-title">
            {activeProject?.name ?? t('toolbar.noProjectSelected')}
          </Title>
          <Text type="secondary">{statusText}</Text>
        </div>

        <Space size={12} wrap align="center">
          <Select
            value={locale}
            style={{ width: 120 }}
            onChange={setLocale}
            options={languages.map((item) => ({ value: item.code, label: item.label }))}
          />
          <Segmented
            value={sessionMode}
            onChange={setSessionMode}
            options={['navigator', 'autopilot'].map((mode) => {
              const descKey = mode === 'navigator' ? 'navigatorDesc' : 'autopilotDesc';
              return {
                value: mode,
                label: (
                  <Tooltip title={t(`modes.${descKey}`)}>
                    {t(`modes.${mode}`)}
                  </Tooltip>
                )
              };
            })}
          />
          {/* <Tag className="studio-pill-tag">{transportMode}</Tag> */}
          <Tag className="studio-pill-tag">{t('toolbar.unitsValue')}</Tag>
          {session ? <Tag className="studio-pill-tag">session {session.id}</Tag> : null}
        </Space>
      </Flex>
    </Card>
  );
}
