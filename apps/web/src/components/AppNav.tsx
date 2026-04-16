import {
  AppstoreOutlined,
  FolderOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

interface Props {
  t: (key: string) => string;
  hasActiveProject: boolean;
}

export function AppNav({ t, hasActiveProject }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { path: '/projects', icon: <FolderOutlined />, label: t('nav.projects') },
    { path: '/studio',   icon: <ToolOutlined />,   label: t('nav.studio'),  disabled: !hasActiveProject },
    { path: '/assets',   icon: <AppstoreOutlined />, label: t('nav.assets') }
  ];

  return (
    <div className="app-nav">
      {items.map(({ path, icon, label, disabled }) => (
        <Tooltip key={path} title={label} placement="right">
          <Button
            type="text"
            icon={icon}
            disabled={disabled}
            className={`app-nav-btn${pathname.startsWith(path) ? ' app-nav-btn--active' : ''}`}
            onClick={() => !disabled && navigate(path)}
          />
        </Tooltip>
      ))}
    </div>
  );
}
