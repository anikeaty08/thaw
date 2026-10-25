"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EMBER, addLights, createStage, iceMaterial, loadModel } from "./stage";
import { prefersReducedMotion } from "@/lib/gsap";

/**
 * A small frozen crystal that turns slowly and floats, with a faint ember heart: a lock waiting to
 * thaw. Used on the connect-wallet screen.
 */
export default function CrystalScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const reduce = prefersReducedMotion();
    const teardown = createStage(host.current, { fov: 30, position: [0, 0.15, 4], lookAt: [0, 0, 0] }, ({ scene, track }) => {
      addLights(scene);
      const heart = new THREE.PointLight(EMBER, 1.2, 2.5);
      scene.add(heart);

      const mat = track(iceMaterial(true));
      const rig = new THREE.Group();
      rig.rotation.z = 0.12;
      scene.add(rig);
      loadModel("/models/crystal.glb", (gltf) => {
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = mat;
        });
        // Centre the model on its bounding box so it spins in place.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        gltf.scene.position.sub(box.getCenter(new THREE.Vector3()));
        rig.add(gltf.scene);
      });

      return (t) => {
        if (reduce) return;
        rig.rotation.y = t * 0.45;
        rig.position.y = Math.sin(t * 1.3) * 0.08;
        heart.intensity = 0.9 + Math.sin(t * 2) * 0.4;
      };
    });
    return teardown ?? undefined;
  }, []);

  return <div ref={host} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />;
}
