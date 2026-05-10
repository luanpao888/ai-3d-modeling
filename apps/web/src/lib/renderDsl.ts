import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

type AssetIndex = Record<string, { previewColor?: string }>;
export type ViewAngle = 'top' | 'front' | 'side' | 'perspective';

// ─── Local DSL node types (mirrors packages/shared/src/types.d.ts) ───────────

interface DslFeature {
  op: string;
  shape?: string;
  radius?: number;
  width?: number;
  height?: number;
  depth?: number;
  points?: [number, number][];
  axis?: string;
  angle?: number;
  count?: number;
  spacing?: number;
  [key: string]: unknown;
}

interface DslNodeBase {
  id?: string;
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: { color?: string; metalness?: number; roughness?: number };
}

interface DslPrimitiveNode extends DslNodeBase {
  kind: 'primitive';
  primitive?: string;
  dimensions?: { width?: number; height?: number; depth?: number; radius?: number };
}

interface DslAssetNode extends DslNodeBase {
  kind: 'asset';
  assetId?: string;
}

interface DslGroupNode extends DslNodeBase {
  kind: 'group';
  children?: string[];
}

interface DslConstructedNode extends DslNodeBase {
  kind: 'constructed';
  geometry?: { features?: DslFeature[] };
}

type DslNode = DslPrimitiveNode | DslAssetNode | DslGroupNode | DslConstructedNode | (DslNodeBase & { kind?: string });

interface DslDocument {
  nodes?: DslNode[];
}

// ─── Scene Controller API ────────────────────────────────────────────────────

export interface SceneController {
  /** Tear down the Three.js renderer and remove DOM elements */
  dispose(): void;
  /** Fly the camera to focus on a node by its DSL id */
  focusNode(nodeId: string): void;
  /** Highlight nodes with a tinted overlay. Pass [] to clear all highlights. */
  highlightNodes(nodeIds: string[], color?: string): void;
  /** Render a frame from a named camera angle and return a PNG data URL */
  captureViewport(view?: ViewAngle): Promise<string>;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mountScenePreview(
  container: HTMLDivElement | null,
  dsl: unknown,
  assetIndex: AssetIndex = {}
): SceneController {
  const noop: SceneController = {
    dispose: () => {},
    focusNode: () => {},
    highlightNodes: () => {},
    captureViewport: async () => '',
  };

  if (!container || !dsl || typeof dsl !== 'object') {
    return noop;
  }

  container.innerHTML = '';

  const { scene, objectIndex } = buildSceneFromDsl(dsl as DslDocument, assetIndex);
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 460;

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(6, 5, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.75, 0);

  let frameId = 0;
  const renderFrame = () => {
    frameId = window.requestAnimationFrame(renderFrame);
    controls.update();
    renderer.render(scene, camera);
  };
  renderFrame();

  const handleResize = () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  window.addEventListener('resize', handleResize);
  document.addEventListener('fullscreenchange', handleResize);
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  // Stored original materials for highlight restore
  const highlightCache = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  const controller: SceneController = {
    dispose() {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.innerHTML = '';
    },

    focusNode(nodeId: string) {
      const target = objectIndex.get(nodeId);
      if (!target) return;
      const box = new THREE.Box3().setFromObject(target);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const d = Math.max(size.x, size.y, size.z) * 2.5;
      controls.target.copy(center);
      camera.position.set(center.x + d, center.y + d * 0.6, center.z + d);
      camera.lookAt(center);
      controls.update();
    },

    highlightNodes(nodeIds: string[], color = '#f59e0b') {
      for (const [mesh, mat] of highlightCache) {
        mesh.material = mat;
      }
      highlightCache.clear();
      if (nodeIds.length === 0) return;

      const hlMat = new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.35),
        roughness: 0.4,
        metalness: 0.1,
      });
      for (const nodeId of nodeIds) {
        objectIndex.get(nodeId)?.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            highlightCache.set(child, child.material);
            child.material = hlMat;
          }
        });
      }
    },

    async captureViewport(view: ViewAngle = 'perspective'): Promise<string> {
      const box = new THREE.Box3();
      scene.traverse((obj) => { if (obj instanceof THREE.Mesh) box.expandByObject(obj); });
      const center = box.isEmpty() ? new THREE.Vector3(0, 0.75, 0) : box.getCenter(new THREE.Vector3());
      const size = box.isEmpty() ? new THREE.Vector3(2, 2, 2) : box.getSize(new THREE.Vector3());
      const d = Math.max(size.x, size.y, size.z) * 2.2;

      const savedPos = camera.position.clone();
      const savedTarget = controls.target.clone();

      switch (view) {
        case 'top':   camera.position.set(center.x, center.y + d, center.z);   break;
        case 'front': camera.position.set(center.x, center.y, center.z + d);   break;
        case 'side':  camera.position.set(center.x + d, center.y, center.z);   break;
        default:      camera.position.set(center.x + d * 0.7, center.y + d * 0.5, center.z + d * 0.7);
      }
      controls.target.copy(center);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      camera.position.copy(savedPos);
      controls.target.copy(savedTarget);
      camera.lookAt(savedTarget);
      controls.update();

      return dataUrl;
    },
  };

  return controller;
}

// ─── Scene builder ────────────────────────────────────────────────────────────

export function buildSceneFromDsl(dsl: DslDocument, assetIndex: AssetIndex = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f7f7f5');

  scene.add(new THREE.AmbientLight('#ffffff', 1.5));
  const keyLight = new THREE.DirectionalLight('#ffffff', 1.5);
  keyLight.position.set(5, 10, 7);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight('#ffffff', 0.7);
  fillLight.position.set(-4, 6, -2);
  scene.add(fillLight);
  scene.add(new THREE.GridHelper(20, 20, '#d1d5db', '#e5e7eb'));

  const nodes = dsl.nodes ?? [];

  // Build lookup maps
  const nodeMap = new Map<string, DslNode>();
  const childSet = new Set<string>();
  for (const node of nodes) {
    if (node.id) nodeMap.set(node.id, node);
    if ((node as DslGroupNode).kind === 'group') {
      for (const cid of (node as DslGroupNode).children ?? []) childSet.add(cid);
    }
  }

  const objectIndex = new Map<string, THREE.Object3D>();

  // Only add root-level nodes (non-children) to the scene
  for (const node of nodes) {
    if (node.id && childSet.has(node.id)) continue;
    scene.add(createSceneObject(node, assetIndex, nodeMap, objectIndex));
  }

  return { scene, objectIndex };
}

export async function exportDslToGlb(
  dsl: unknown,
  assetIndex: AssetIndex = {},
  fileName = 'scene.glb'
) {
  const { scene } = buildSceneFromDsl((dsl as DslDocument) ?? {}, assetIndex);
  const exporter = new GLTFExporter();

  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (output) => resolve(output as ArrayBuffer),
      (error) => reject(error),
      { binary: true }
    );
  });

  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Object creation ──────────────────────────────────────────────────────────

function createSceneObject(
  node: DslNode,
  assetIndex: AssetIndex,
  nodeMap: Map<string, DslNode>,
  objectIndex: Map<string, THREE.Object3D>
): THREE.Object3D {
  const nodeId = node.id ?? '';
  const color =
    node.material?.color ??
    ((node as DslAssetNode).assetId ? assetIndex[(node as DslAssetNode).assetId!]?.previewColor : undefined) ??
    '#60a5fa';

  const stdMat = () =>
    new THREE.MeshStandardMaterial({
      color,
      metalness: node.material?.metalness ?? 0.15,
      roughness: node.material?.roughness ?? 0.8,
    });

  let object: THREE.Object3D;

  switch ((node as DslNode & { kind?: string }).kind) {
    case 'group': {
      object = new THREE.Group();
      for (const childId of (node as DslGroupNode).children ?? []) {
        const child = nodeMap.get(childId);
        if (child) object.add(createSceneObject(child, assetIndex, nodeMap, objectIndex));
      }
      break;
    }

    case 'constructed': {
      const features = (node as DslConstructedNode).geometry?.features ?? [];
      const geometry = createConstructedGeometry(features);
      object = new THREE.Mesh(geometry ?? new THREE.BoxGeometry(0.5, 0.5, 0.5), stdMat());
      break;
    }

    case 'asset': {
      object = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), stdMat());
      object.add(mesh);
      object.add(
        new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry),
          new THREE.LineBasicMaterial({ color: '#a3a3a3' })
        )
      );
      break;
    }

    default: // 'primitive'
      object = new THREE.Mesh(createPrimitiveGeometry(node as DslPrimitiveNode), stdMat());
  }

  object.name = node.name ?? nodeId ?? 'node';
  if (nodeId) objectIndex.set(nodeId, object);

  object.position.set(...(node.position ?? [0, 0, 0]));
  object.rotation.set(...(node.rotation ?? [0, 0, 0]));
  object.scale.set(...(node.scale ?? [1, 1, 1]));

  return object;
}

// ─── Primitive geometry ───────────────────────────────────────────────────────

function createPrimitiveGeometry(node: DslPrimitiveNode): THREE.BufferGeometry {
  const d = node.dimensions ?? {};
  switch (node.primitive) {
    case 'sphere':
      return new THREE.SphereGeometry(d.radius ?? 0.5, 32, 24);
    case 'cylinder':
      return new THREE.CylinderGeometry(d.radius ?? 0.35, d.radius ?? 0.35, d.height ?? 1, 32);
    case 'plane':
      return new THREE.PlaneGeometry(d.width ?? 1, d.height ?? 1);
    default: // 'box'
      return new THREE.BoxGeometry(d.width ?? 1, d.height ?? 1, d.depth ?? 1);
  }
}

// ─── Constructed / feature geometry ──────────────────────────────────────────

function createConstructedGeometry(features: DslFeature[]): THREE.BufferGeometry | null {
  let geometry: THREE.BufferGeometry | null = null;
  let profilePts: THREE.Vector2[] = [];
  let profileShape: THREE.Shape | null = null;

  for (const feat of features) {
    switch (feat.op) {
      case 'profile': {
        profilePts = buildProfilePoints(feat);
        profileShape = buildShape(profilePts);
        break;
      }
      case 'revolve': {
        if (profilePts.length < 2) break;
        const angleDeg = (feat.angle as number) ?? 360;
        const angleRad = angleDeg * (Math.PI / 180);
        const segs = angleDeg >= 360 ? 64 : Math.max(8, Math.ceil((angleDeg / 360) * 64));
        geometry = new THREE.LatheGeometry(profilePts, segs, 0, angleRad);
        break;
      }
      case 'extrude': {
        const shape = profileShape ?? (() => {
          const s = new THREE.Shape();
          s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
          return s;
        })();
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: (feat.depth as number) ?? (feat.height as number) ?? 1,
          bevelEnabled: false,
        });
        break;
      }
      case 'sweep': {
        // Simplified: straight tube using profile radius until full sweep support
        const r = profilePts.length > 0 ? profilePts[0].x : (feat.radius as number) ?? 0.1;
        const h = (feat.height as number) ?? (feat.depth as number) ?? 1;
        geometry = new THREE.CylinderGeometry(r, r, h, 32);
        break;
      }
      // 'loft', 'boolean', 'fillet', 'array' deferred to geometry compute layer
    }
  }

  return geometry;
}

function buildProfilePoints(feat: DslFeature): THREE.Vector2[] {
  if (feat.shape === 'polyline' || feat.shape === 'custom') {
    return ((feat.points as [number, number][]) ?? []).map(([x, y]) => new THREE.Vector2(x, y));
  }
  if (feat.shape === 'rectangle') {
    const hw = ((feat.width as number) ?? 1) / 2;
    const hh = ((feat.height as number) ?? 1) / 2;
    return [new THREE.Vector2(0, -hh), new THREE.Vector2(hw, -hh), new THREE.Vector2(hw, hh), new THREE.Vector2(0, hh)];
  }
  // Default: circular arc profile for revolve (half-circle in XY plane)
  const r = (feat.radius as number) ?? 0.5;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(t) * r, Math.cos(t) * r));
  }
  return pts;
}

function buildShape(points: THREE.Vector2[]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length === 0) {
    shape.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
    return shape;
  }
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return shape;
}