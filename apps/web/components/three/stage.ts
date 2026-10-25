import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Shared plumbing for the site's small three.js scenes. Every model comes from Blender
// (apps/web/design/thaw-models.blend) as geometry only, and gets its material here so it follows
// the site palette.

export const EMBER = new THREE.Color("#f77f3a");

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Registers something to dispose when the stage is torn down. */
  track: <T extends { dispose(): void }>(thing: T) => T;
}

/**
 * Mounts a transparent canvas into `el` with a soft studio environment (so glass and metal have
 * something to reflect), keeps it sized to the element, and calls `frame` every animation frame
 * while the element is on screen. Returns the teardown, or null when WebGL isn't available, in
 * which case whatever sits behind the canvas stays as the fallback.
 */
export function createStage(
  el: HTMLElement,
  view: { fov: number; position: [number, number, number]; lookAt: [number, number, number] },
  setup: (stage: Stage) => (t: number) => void,
): (() => void) | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute("aria-hidden", "true");
  el.appendChild(renderer.domElement);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(thing: T) => (disposables.push(thing), thing);

  const scene = new THREE.Scene();
  const pmrem = track(new THREE.PMREMGenerator(renderer));
  scene.environment = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);

  const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.1, 50);
  camera.position.set(...view.position);
  camera.lookAt(...view.lookAt);

  const frame = setup({ scene, camera, track });

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = el;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  let visible = false;
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  io.observe(el);

  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible) return;
    frame(clock.getElapsedTime());
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}

const loader = new GLTFLoader();
export function loadModel(url: string, onLoad: (gltf: GLTF) => void) {
  loader.load(url, onLoad, undefined, () => {
    // A missing model leaves the scene empty; the fallback behind the canvas still shows.
  });
}

/** Clear, glassy ice: transmission for the body, clearcoat for the wet sheen. */
export function iceMaterial(flat = false) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e3f1ff"),
    roughness: 0.06,
    metalness: 0,
    transmission: 0.92,
    thickness: 0.9,
    ior: 1.31,
    attenuationColor: new THREE.Color("#5aa9ff"),
    attenuationDistance: 1.6,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
    flatShading: flat,
  });
}

/** Warm, polished MUSD coin metal. */
export function coinMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffb877"),
    metalness: 1,
    roughness: 0.3,
    clearcoat: 0.6,
    envMapIntensity: 1.3,
  });
}

/** The cool frost key light and blue rim every scene shares. */
export function addLights(scene: THREE.Scene) {
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  const rim = new THREE.DirectionalLight(0x7cc0ff, 2.5);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim);
}

/** First mesh geometry in a loaded model (for instancing a single-part model like the coin). */
export function firstGeometry(gltf: GLTF): THREE.BufferGeometry | null {
  let geo: THREE.BufferGeometry | null = null;
  gltf.scene.traverse((o) => {
    if (!geo && o instanceof THREE.Mesh) geo = o.geometry as THREE.BufferGeometry;
  });
  return geo;
}
