"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { EMBER, addLights, coinMaterial, createStage, firstGeometry, iceMaterial, loadModel } from "@/components/three/stage";

const DRIPS = 120;
const COINS = 12;
const COIN_SCALE = 0.75;
// Smallest cube melts first, the big one last: the stack visibly thaws piece by piece.
const MELT_ORDER = ["IceCube_B", "IceCube_A", "IceCube_Main"];

interface Shard {
  mesh: THREE.Object3D;
  base: THREE.Vector3;
  /** Slice of the overall melt (0 → 1) during which this cube shrinks away. */
  from: number;
  to: number;
}

/**
 * A small stack of clear ice cubes (the debt). As `melt.current` goes 0 → 1 the cubes melt one
 * after another while a stack of MUSD coins (the repayments) builds up beside them, each coin
 * dropping into place. Loaded on demand and only renders while on screen.
 */
export default function IceScene({ melt, reduceMotion }: { melt: MutableRefObject<number>; reduceMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const teardown = createStage(host.current, { fov: 32, position: [0.3, 2.2, 8.4], lookAt: [0.3, 1.15, 0] }, ({ scene, track }) => {
      addLights(scene);
      const warm = new THREE.PointLight(EMBER, 0, 6);
      warm.position.set(0, 0.2, 1.4);
      scene.add(warm);

      const iceMat = track(iceMaterial());
      const cluster = new THREE.Group();
      cluster.position.x = 0.25; // the stack leans left; nudge it so the cubes and coins share the frame
      scene.add(cluster);
      const shards: Shard[] = [];
      loadModel("/models/ice-cubes.glb", (gltf) => {
        gltf.scene.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.material = iceMat;
          const i = MELT_ORDER.indexOf(obj.name);
          const slot = i < 0 ? MELT_ORDER.length - 1 : i;
          // Overlapping windows so the melt never stalls between cubes; all gone by 90%.
          const span = 1 / MELT_ORDER.length;
          shards.push({ mesh: obj, base: obj.scale.clone(), from: Math.max(0, slot * span - 0.06), to: Math.min(0.9, (slot + 1) * span + 0.04) });
        });
        cluster.add(gltf.scene);
      });

      // A soft warm glow on the ground under the coins: a radial gradient, not a hard disc.
      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = glowCanvas.height = 128;
      const g = glowCanvas.getContext("2d")!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(247,127,58,0.9)");
      grad.addColorStop(1, "rgba(247,127,58,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const glowMat = track(
        new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(glowCanvas)), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(1.5, 0.01, 0.6);
      scene.add(glow);

      // The repaid MUSD: coins that stack up one by one as the ice melts.
      const coinMat = track(coinMaterial());
      const COIN_H = 0.09 * COIN_SCALE;
      const stackAt = new THREE.Vector3(1.5, 0, 0.6);
      let coins: THREE.InstancedMesh | null = null;
      const coinDrop = new Float32Array(COINS); // 0 = still above, 1 = landed
      const dummy = new THREE.Object3D();
      loadModel("/models/musd-coin.glb", (gltf) => {
        const geo = firstGeometry(gltf);
        if (!geo) return;
        coins = new THREE.InstancedMesh(geo, coinMat, COINS);
        coins.scale.setScalar(COIN_SCALE);
        scene.add(coins);
      });

      // Drips falling from the melting cubes.
      const positions = new Float32Array(DRIPS * 3);
      const seeds = Array.from({ length: DRIPS }, () => ({
        x: (Math.random() - 0.5) * 1.6,
        z: (Math.random() - 0.5) * 1.0,
        speed: 0.35 + Math.random() * 0.5,
        phase: Math.random(),
      }));
      const dripGeo = track(new THREE.BufferGeometry());
      dripGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dripMat = track(new THREE.PointsMaterial({ color: EMBER, size: 0.055, transparent: true, opacity: 0, depthWrite: false }));
      scene.add(new THREE.Points(dripGeo, dripMat));

      let melted = 0;
      return (t) => {
        // Ease toward the scroll position so fast scrolls still melt smoothly.
        melted = THREE.MathUtils.lerp(melted, THREE.MathUtils.clamp(melt.current, 0, 1), 0.08);

        if (!reduceMotion) {
          cluster.rotation.y = Math.sin(t * 0.3) * 0.25;
          cluster.position.y = Math.sin(t * 1.1) * 0.04;
        }
        for (const s of shards) {
          const k = 1 - THREE.MathUtils.smoothstep(melted, s.from, s.to);
          // Melting ice slumps toward its base (the pivot): it loses height faster than width.
          s.mesh.scale.set(s.base.x * (0.15 + 0.85 * k), s.base.y * k, s.base.z * (0.15 + 0.85 * k));
          s.mesh.visible = k > 0.01;
        }

        warm.intensity = melted * 4;
        glow.scale.setScalar(0.6 + melted * 1.1);
        glowMat.opacity = melted * 0.55;

        if (coins) {
          const target = Math.round(melted * COINS);
          for (let i = 0; i < COINS; i++) {
            // Coins up to the target fall into place; ones past it lift away again on scroll back.
            coinDrop[i] = THREE.MathUtils.lerp(coinDrop[i], i < target ? 1 : 0, 0.12);
            const d = coinDrop[i];
            const wobble = (i % 3) * 0.04 - 0.04;
            dummy.position.set(
              (stackAt.x + wobble) / COIN_SCALE,
              (stackAt.y + i * COIN_H + (1 - d) * 1.2) / COIN_SCALE,
              (stackAt.z - wobble * 0.5) / COIN_SCALE,
            );
            dummy.rotation.set(0, i * 0.7, (1 - d) * 0.6);
            dummy.scale.setScalar(d < 0.02 ? 0.0001 : 1);
            dummy.updateMatrix();
            coins.setMatrixAt(i, dummy.matrix);
          }
          coins.instanceMatrix.needsUpdate = true;
        }

        dripMat.opacity = melted > 0.02 && melted < 0.995 ? 0.9 : 0;
        for (let i = 0; i < DRIPS; i++) {
          const s = seeds[i];
          const active = i / DRIPS < Math.min(1, melted * 1.4) && melted < 0.995;
          const life = reduceMotion ? s.phase : (s.phase + t * s.speed * 0.45) % 1;
          positions[i * 3] = active ? s.x * (1 - melted * 0.5) : 0;
          positions[i * 3 + 1] = active ? 1.4 * (1 - melted) - life * (1.7 * (1 - melted) + 0.3) : -99;
          positions[i * 3 + 2] = active ? s.z : 0;
        }
        dripGeo.attributes.position.needsUpdate = true;
      };
    });
    return teardown ?? undefined;
  }, [melt, reduceMotion]);

  return <div ref={host} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
