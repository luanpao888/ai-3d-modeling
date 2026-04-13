import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function mountScenePreview(container, dsl, assetIndex = {}) {
  if (!container || !dsl) {
    return () => {};
  }

  container.innerHTML = '';

  const scene = buildSceneFromDsl(dsl, assetIndex);
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

  let frameId;
  const renderFrame = () => {
    frameId = window.requestAnimationFrame(renderFrame);
    controls.update();
    renderer.render(scene, camera);
  };
  renderFrame();

  const handleResize = () => {
    const nextWidth = container.clientWidth || width;
    const nextHeight = container.clientHeight || height;
    camera.aspect = nextWidth / nextHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(nextWidth, nextHeight);
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener('resize', handleResize);
    controls.dispose();
    renderer.dispose();
    container.innerHTML = '';
  };
}

export function buildSceneFromDsl(dsl, assetIndex = {}) {
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

  for (const node of dsl.nodes ?? []) {
    scene.add(createSceneObject(node, assetIndex));
  }

  return scene;
}

export async function exportDslToGlb(dsl, assetIndex = {}, fileName = 'scene.glb') {
  const scene = buildSceneFromDsl(dsl, assetIndex);
  const exporter = new GLTFExporter();

  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (output) => resolve(output),
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

function createSceneObject(node, assetIndex) {
  const color = node.material?.color ?? assetIndex[node.assetId]?.previewColor ?? '#60a5fa';
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: node.material?.metalness ?? 0.15,
    roughness: node.material?.roughness ?? 0.8
  });

  let object;

  if (node.kind === 'asset') {
    object = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    const edgeLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: '#a3a3a3' })
    );
    object.add(mesh);
    object.add(edgeLines);
  } else {
    object = new THREE.Mesh(createPrimitiveGeometry(node), material);
  }

  object.name = node.name ?? node.id;
  object.position.set(...(node.position ?? [0, 0, 0]));
  object.rotation.set(...(node.rotation ?? [0, 0, 0]));
  object.scale.set(...(node.scale ?? [1, 1, 1]));

  return object;
}

function createPrimitiveGeometry(node) {
  const dimensions = node.dimensions ?? {};

  switch (node.primitive) {
    case 'sphere':
      return new THREE.SphereGeometry(dimensions.radius ?? 0.5, 32, 24);
    case 'cylinder':
      return new THREE.CylinderGeometry(
        dimensions.radius ?? 0.35,
        dimensions.radius ?? 0.35,
        dimensions.height ?? 1,
        32
      );
    case 'plane':
      return new THREE.PlaneGeometry(dimensions.width ?? 1, dimensions.height ?? 1);
    case 'box':
    default:
      return new THREE.BoxGeometry(
        dimensions.width ?? 1,
        dimensions.height ?? 1,
        dimensions.depth ?? 1
      );
  }
}
