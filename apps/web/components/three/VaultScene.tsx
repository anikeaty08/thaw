"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { addLights, coinMaterial, createStage, firstGeometry, loadModel } from "./stage";
import { ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

const COINS = 5;
const COIN_SCALE = 0.42;

/**
 * The tMUSD vault: a heavy safe whose round door swings open as the lender section scrolls into
 * view, showing the MUSD stacked inside. Turns a little toward the cursor.
 */
export default function VaultScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = prefersReducedMotion();

    // Door opening follows the scroll through the section (fully open with reduced motion).
    let open = reduce ? 1 : 0;
    const trigger = reduce
      ? null
      : ScrollTrigger.create({ trigger: el, start: "top 85%", end: "center 45%", onUpdate: (self) => (open = self.progress) });

    let pointerX = 0;
    let pointerY = 0;
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    const teardown = createStage(el, { fov: 30, position: [0.9, 1.6, 5.4], lookAt: [0, 0.78, 0] }, ({ scene, track }) => {
      addLights(scene);
      const inner = new THREE.PointLight(0xffc48a, 0, 2.5);
      inner.position.set(0, 0.85, 0.55);
      scene.add(inner);

      const bodyMat = track(
        new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#1c2b3f"), metalness: 0.85, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
      );
      const doorMat = track(
        new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#2f4d70"), metalness: 0.9, roughness: 0.22, clearcoat: 1, envMapIntensity: 1.4 }),
      );

      const rig = new THREE.Group();
      scene.add(rig);
      let door: THREE.Object3D | null = null;
      loadModel("/models/vault.glb", (gltf) => {
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.material = o.name === "Vault_Door" ? doorMat : bodyMat;
          if (o.name === "Vault_Door") door = o;
        });
        rig.add(gltf.scene);
      });

      // MUSD resting inside the opening.
      const coinMat = track(coinMaterial());
      loadModel("/models/musd-coin.glb", (gltf) => {
        const geo = firstGeometry(gltf);
        if (!geo) return;
        const coins = new THREE.InstancedMesh(geo, coinMat, COINS);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < COINS; i++) {
          dummy.position.set((i % 2) * 0.05 - 0.02, 0.36 + i * 0.04, 0.56);
          dummy.rotation.set(0, i * 0.9, 0);
          dummy.scale.setScalar(COIN_SCALE);
          dummy.updateMatrix();
          coins.setMatrixAt(i, dummy.matrix);
        }
        rig.add(coins);
      });

      let shown = open;
      return (t) => {
        shown = THREE.MathUtils.lerp(shown, open, 0.08);
        // The door hinges on its left edge (its pivot from Blender) and swings out toward us.
        if (door) door.rotation.y = -shown * THREE.MathUtils.degToRad(105);
        inner.intensity = shown * 2.2;
        if (!reduce) {
          rig.rotation.y = THREE.MathUtils.lerp(rig.rotation.y, -0.35 + pointerX * 0.18, 0.05);
          rig.rotation.x = THREE.MathUtils.lerp(rig.rotation.x, pointerY * 0.06, 0.05);
          rig.position.y = Math.sin(t * 1.1) * 0.03;
        } else {
          rig.rotation.y = -0.35;
        }
      };
    });

    return () => {
      trigger?.kill();
      window.removeEventListener("pointermove", onPointer);
      teardown?.();
    };
  }, []);

  return <div ref={host} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
