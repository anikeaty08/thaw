"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { EMBER, addLights, createStage, firstGeometry, loadModel } from "./stage";
import { onIntroDone } from "@/components/motion/IntroCurtain";
import { ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const FROST = new THREE.Color("#2d9cff");
const ICE = new THREE.Color("#d8e9ff");
const GRID = 0.1; // size of one cube part, in model units (the mark is ~4.1 across)
const SAMPLES = 40000; // surface samples used to find which grid cells the mark fills
const BUILD = 2.4; // seconds for the parts to fly in and lock together
const PUSH_RADIUS = 0.95;
const PUSH_STRENGTH = 0.8;

const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * The hero: Thaw's six-armed crystal built from small ice-cube parts, voxelised from the surface
 * of a Blender model (the model itself is never shown). Each part is a Blender ice cube too. When someone arrives the parts tumble in
 * from all sides and lock into the mark; the cursor shoves parts aside and they settle back;
 * scrolling away throws them back out, and scrolling back reassembles it. The inlaid strip in each
 * arm warms from frost to ember around the ring.
 *
 * The canvas fills its parent (the whole hero, behind the copy) so scattered parts can fly across
 * the page; the mark itself sits centred on `anchor`, an empty box in the layout.
 */
export default function HeroMark({ anchor }: { anchor: RefObject<HTMLElement | null> }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = prefersReducedMotion();

    const ndc = new THREE.Vector2();
    let pointerActive = false;
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      pointerActive = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    };
    const onLeave = () => (pointerActive = false);
    if (!reduce) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    // Scrolling the hero away scatters the parts (0 = assembled, 1 = gone).
    let scatter = 0;
    const scroll = reduce
      ? null
      : ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom top", onUpdate: (self) => (scatter = self.progress) });

    // Assembly starts when the intro curtain lifts (or right away when there is none).
    let buildFrom = -1;
    const unsubscribe = onIntroDone(() => (buildFrom = performance.now()));

    const teardown = createStage(el, { fov: 30, position: [0, 0, 11.5], lookAt: [0, 0, 0] }, ({ scene, camera, track }) => {
      addLights(scene);
      const heat = new THREE.PointLight(EMBER, 4, 4);
      scene.add(heat);

      // Stand the mark up to face the camera (it was modelled lying flat).
      const rig = new THREE.Group();
      const model = new THREE.Group();
      model.rotation.x = Math.PI / 2;
      rig.add(model);
      scene.add(rig);

      // Keep the mark centred on the anchor box and sized to it, in world units on the z=0 plane.
      const place = () => {
        const a = anchor.current;
        if (!a) return;
        const cr = el.getBoundingClientRect();
        const ar = a.getBoundingClientRect();
        if (!cr.height || !ar.height) return;
        const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
        const perPx = worldH / cr.height;
        rig.userData.x = (ar.left + ar.width / 2 - (cr.left + cr.width / 2)) * perPx;
        rig.userData.y = -(ar.top + ar.height / 2 - (cr.top + cr.height / 2)) * perPx;
        rig.scale.setScalar((Math.min(ar.width, ar.height) * perPx * 0.85) / 4.1);
      };
      let frames = 0;

      const cubeMat = track(
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3, transparent: true }),
      );

      let parts: THREE.InstancedMesh | null = null;
      let count = 0;
      let target = new Float32Array(0);
      let start = new Float32Array(0);
      let spin = new Float32Array(0);
      let push = new Float32Array(0);
      let delay = new Float32Array(0);
      const dummy = new THREE.Object3D();

      // The part first (a 1-unit ice cube), then the mark it builds.
      loadModel("/models/part-cube.glb", (partGltf) => {
        const source = firstGeometry(partGltf);
        if (!source) return;
        const cubeGeo = track(source.clone().scale(GRID * 0.9, GRID * 0.9, GRID * 0.9));
        loadModel("/models/hero-mark.glb", (gltf) => buildMark(gltf, cubeGeo));
      });

      const buildMark = (gltf: { scene: THREE.Group }, cubeGeo: THREE.BufferGeometry) => {
        gltf.scene.updateMatrixWorld(true);
        const meshes: THREE.Mesh[] = [];
        gltf.scene.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));

        // Voxelise: scatter samples over every surface, snap them to the grid, keep each cell once.
        // A cell touched by an inlaid strip becomes a strip (coloured) part.
        const samplers = meshes.map((m) => new MeshSurfaceSampler(m).build());
        const areas = samplers.map((s) => s.distribution![s.distribution!.length - 1]);
        const total = areas.reduce((a, b) => a + b, 0);
        const cells = new Map<string, { x: number; y: number; z: number; strip: boolean }>();
        const p = new THREE.Vector3();
        samplers.forEach((s, si) => {
          const strip = meshes[si].name.startsWith("Glow_");
          const n = Math.max(200, Math.round((areas[si] / total) * SAMPLES));
          for (let k = 0; k < n; k++) {
            s.sample(p);
            p.applyMatrix4(meshes[si].matrixWorld);
            const x = Math.round(p.x / GRID), y = Math.round(p.y / GRID), z = Math.round(p.z / GRID);
            const key = `${x},${y},${z}`;
            const cell = cells.get(key);
            if (cell) cell.strip ||= strip;
            else cells.set(key, { x: x * GRID, y: y * GRID, z: z * GRID, strip });
          }
        });

        count = cells.size;
        target = new Float32Array(count * 3);
        start = new Float32Array(count * 3);
        spin = new Float32Array(count * 3);
        push = new Float32Array(count * 3);
        delay = new Float32Array(count);
        parts = new THREE.InstancedMesh(cubeGeo, cubeMat, count);
        const c = new THREE.Color();
        let i = 0;
        for (const cell of cells.values()) {
          target.set([cell.x, cell.y, cell.z], i * 3);
          const from = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 4);
          start.set([from.x, from.y, from.z], i * 3);
          spin.set([(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8], i * 3);
          // Outer parts arrive last, so the mark grows out from the hub.
          delay[i] = Math.hypot(cell.x, cell.z) * 0.22 + Math.random() * 0.25;
          // Strips carry the frost-to-ember sweep around the ring; the rest is pale ice.
          const a = (Math.atan2(cell.z, cell.x) / Math.PI + 1) / 2;
          if (cell.strip || Math.hypot(cell.x, cell.z) < 0.3) c.copy(FROST).lerp(EMBER, a).multiplyScalar(1.5);
          else c.copy(ICE).lerp(FROST.clone().lerp(EMBER, a), 0.12);
          parts.setColorAt(i, c);
          i++;
        }
        parts.instanceColor!.needsUpdate = true;
        model.add(parts);
      };

      const raycaster = new THREE.Raycaster();
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      const local = new THREE.Vector3();

      return (t) => {
        if (frames++ % 30 === 0) place();
        if (!parts) return;
        const since = reduce ? 99 : buildFrom < 0 ? -1 : (performance.now() - buildFrom) / 1000;

        let haveCursor = false;
        if (pointerActive && !reduce) {
          raycaster.setFromCamera(ndc, camera);
          if (raycaster.ray.intersectPlane(plane, hit)) {
            local.copy(hit);
            model.worldToLocal(local);
            haveCursor = true;
          }
        }

        const sc = ease(scatter);
        // Thrown-out parts fade as they go, so none hang over the copy below.
        cubeMat.opacity = 1 - sc * 0.92;
        cubeMat.depthWrite = sc < 0.05;
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          const k = since < 0 ? 0 : ease(THREE.MathUtils.clamp((since - delay[i]) / (BUILD - 1), 0, 1));
          const sx = start[j], sy = start[j + 1], sz = start[j + 2];
          let tx = target[j], ty = target[j + 1], tz = target[j + 2];

          // Shove parts out of the cursor's way; they ease aside and drift back.
          let dx = 0, dy = 0, dz = 0;
          if (haveCursor) {
            const ox = tx - local.x, oy = ty - local.y, oz = tz - local.z;
            const d = Math.hypot(ox, oy, oz);
            if (d < PUSH_RADIUS && d > 1e-4) {
              const f = ((PUSH_RADIUS - d) / PUSH_RADIUS) ** 2 * PUSH_STRENGTH;
              dx = (ox / d) * f;
              dy = (oy / d) * f + f * 0.6; // pop up off the plane a little, toward the viewer
              dz = (oz / d) * f;
            }
          }
          push[j] += (dx - push[j]) * 0.14;
          push[j + 1] += (dy - push[j + 1]) * 0.14;
          push[j + 2] += (dz - push[j + 2]) * 0.14;
          tx += push[j];
          ty += push[j + 1];
          tz += push[j + 2];

          let x = sx + (tx - sx) * k;
          let y = sy + (ty - sy) * k;
          let z = sz + (tz - sz) * k;
          // Tumble while flying; square up as they lock in. Shoved parts wobble a little.
          const loose = 1 - k + sc + Math.min(1, Math.hypot(push[j], push[j + 1], push[j + 2]) * 2);
          if (sc > 0) {
            x += (sx * 1.6 - x) * sc;
            y += (sy * 1.6 - y) * sc;
            z += (sz * 1.6 - z) * sc;
          }
          dummy.position.set(x, y, z);
          dummy.rotation.set(spin[j] * loose, spin[j + 1] * loose, spin[j + 2] * loose);
          dummy.scale.setScalar(since < 0 ? 0.0001 : 0.4 + 0.6 * Math.min(1, k * 1.5));
          dummy.updateMatrix();
          parts.setMatrixAt(i, dummy.matrix);
        }
        parts.instanceMatrix.needsUpdate = true;

        if (!reduce) {
          model.rotation.y = Math.sin(t * 0.25) * 0.35; // a slow sway around its own axis
          rig.rotation.y = Math.sin(t * 0.35) * 0.18;
          rig.rotation.x = Math.sin(t * 0.3) * 0.08;
        }
        rig.position.set(rig.userData.x ?? 0, (rig.userData.y ?? 0) + (reduce ? 0 : Math.sin(t * 0.9) * 0.06), 0);
        heat.position.set(rig.position.x, rig.position.y, 1.2);
      };
    });

    return () => {
      unsubscribe();
      scroll?.kill();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      teardown?.();
    };
  }, [anchor]);

  return <div ref={host} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
