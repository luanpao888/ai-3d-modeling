import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BuildOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  FolderOutlined,
  RadarChartOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { Badge, Button, List, Tabs, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';

const { Text } = Typography;

// ─── DSL node types (mirrors packages/shared/src/types.d.ts) ─────────────────

interface DslNode {
  id?: string;
  name?: string;
  kind?: string;
  primitive?: string;
  assetId?: string;
  children?: string[];
  geometry?: { features?: { op: string }[] };
}

interface AssetItem {
  id: string;
  name?: string;
}

interface Props {
  t: (key: string) => string;
  assets: AssetItem[];
  dslNodes: DslNode[];
  onNavigateToProjects: () => void;
  onFocusNode: (nodeId: string) => void;
  onHighlightNode: (nodeId: string) => void;
}

// ─── Tree building ────────────────────────────────────────────────────────────

function buildTree(nodes: DslNode[]): { roots: DslNode[]; nodeMap: Map<string, DslNode> } {
  const nodeMap = new Map<string, DslNode>();
  const childSet = new Set<string>();

  for (const n of nodes) {
    if (n.id) nodeMap.set(n.id, n);
    if (n.kind === 'group') {
      for (const cid of n.children ?? []) childSet.add(cid);
    }
  }

  const roots = nodes.filter((n) => !childSet.has(n.id ?? ''));
  return { roots, nodeMap };
}

// ─── Node icon ───────────────────────────────────────────────────────────────

function NodeIcon({ node }: { node: DslNode }) {
  if (node.kind === 'group') return <FolderOutlined style={{ color: '#6366f1' }} />;
  if (node.kind === 'constructed') return <BuildOutlined style={{ color: '#a855f7' }} />;
  if (node.kind === 'asset') return <AppstoreOutlined style={{ color: '#22c55e' }} />;
  if (node.primitive === 'sphere' || node.primitive === 'cylinder')
    return <RadarChartOutlined style={{ color: '#64748b' }} />;
  return <LayoutOutlined style={{ color: '#64748b' }} />;
}

// ─── Single tree node (recursive) ────────────────────────────────────────────

function SceneTreeNode({
  node,
  nodeMap,
  depth,
  selectedId,
  onSelect,
}: {
  node: DslNode;
  nodeMap: Map<string, DslNode>;
  depth: number;
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = (node.children ?? []).map((id) => nodeMap.get(id)).filter(Boolean) as DslNode[];
  const hasChildren = children.length > 0;
  const featureCount = node.geometry?.features?.length ?? 0;
  const isSelected = node.id === selectedId;

  return (
    <div>
      <div
        className={`scene-tree-node${isSelected ? ' scene-tree-node--selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => { if (node.id) onSelect(node.id); }}
      >
        {hasChildren ? (
          <button
            className="scene-tree-toggle"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          >
            {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </button>
        ) : (
          <span className="scene-tree-toggle-spacer" />
        )}

        <NodeIcon node={node} />

        <Tooltip title={`id: ${node.id ?? '—'}`} mouseEnterDelay={0.8}>
          <Text className="scene-tree-label">
            {node.name ?? node.id ?? '未命名'}
          </Text>
        </Tooltip>

        {featureCount > 0 && (
          <Tag className="scene-tree-feature-badge">{featureCount} ops</Tag>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <SceneTreeNode
              key={child.id}
              node={child}
              nodeMap={nodeMap}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function StudioSidebar({
  t,
  assets,
  dslNodes,
  onNavigateToProjects,
  onFocusNode,
  onHighlightNode,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { roots, nodeMap } = useMemo(() => buildTree(dslNodes), [dslNodes]);

  function handleSelect(nodeId: string) {
    setSelectedId(nodeId);
    onFocusNode(nodeId);
    onHighlightNode(nodeId);
  }

  const sceneTab = (
    <div className="studio-scene-tree">
      {roots.length === 0 ? (
        <Text type="secondary" className="studio-scene-tree__empty">
          暂无节点
        </Text>
      ) : (
        roots.map((node) => (
          <SceneTreeNode
            key={node.id}
            node={node}
            nodeMap={nodeMap}
            depth={0}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        ))
      )}
    </div>
  );

  const assetTab = (
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
  );

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

      <Tabs
        className="studio-sidebar__tabs"
        size="small"
        items={[
          {
            key: 'scene',
            label: (
              <span>
                {t('sidebar.sceneTree')}
                <Badge
                  count={dslNodes.length}
                  style={{ background: '#ebebeb', color: '#171717', marginLeft: 6 }}
                />
              </span>
            ),
            children: sceneTab,
          },
          {
            key: 'assets',
            label: (
              <span>
                {t('sidebar.assetRegistry')}
                <Badge
                  count={assets.length}
                  style={{ background: '#ebebeb', color: '#171717', marginLeft: 6 }}
                />
              </span>
            ),
            children: assetTab,
          },
        ]}
      />
    </div>
  );
}


