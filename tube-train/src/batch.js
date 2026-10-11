// Draws the trains' repeated parts in batches.
//
// Every car is built from the same few dozen shapes and materials, so two
// trains of eight cars would be well over a thousand separate draws, which
// is what makes a frame slow. Instead, the parts that share a shape and a
// material are drawn together as one instanced mesh. The cars keep their own
// meshes, which still move with the doors, the bogies and the wheels, but
// they are put on a layer the camera doesn't see; each frame their places
// are copied into the batches, leaving out the ones that are hidden or out
// of view.

import * as THREE from 'three';

const UNSEEN = 31;                    // the layer the batched meshes are moved to

export function batchMeshes(roots) {
  const byKey = new Map();
  for (const root of roots) {
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
      const key = `${o.geometry.uuid} ${o.material.uuid} ${o.castShadow} ${o.receiveShadow}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(o);
    });
  }
  const group = new THREE.Group();
  group.name = 'batches';
  const batches = [];
  for (const members of byKey.values()) {
    if (members.length < 2) continue;
    const { geometry, material, castShadow, receiveShadow } = members[0];
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const mesh = new THREE.InstancedMesh(geometry, material, members.length);
    mesh.name = `batch: ${members[0].name || material.name || material.type}`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = false;           // each part is culled on its own instead
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.boundingSphere = new THREE.Sphere();
    for (const o of members) o.layers.set(UNSEEN);
    // each part, and what it hangs from, for telling whether it's shown
    const parts = members.map(o => {
      const chain = [];
      for (let p = o; p; p = p.parent) chain.push(p);
      return { o, chain };
    });
    batches.push({ mesh, parts, radius: geometry.boundingSphere.radius, centre: geometry.boundingSphere.center });
    group.add(mesh);
  }

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const box = new THREE.Box3();
  const shown = (chain) => { for (const p of chain) if (!p.visible) return false; return true; };

  return {
    group,
    get count() { return batches.length; },
    // Runs `fn` with the batched meshes' materials taken away, so that
    // building the shaders for a scene doesn't build ones for them that will
    // never be used.
    async without(fn) {
      for (const b of batches) for (const { o } of b.parts) o.material = null;
      try { return await fn(); } finally {
        for (const b of batches) for (const { o } of b.parts) o.material = b.mesh.material;
      }
    },
    // Copies the parts' places into the batches. The world matrices must be
    // up to date. With `camera`, parts out of its view are left out (but not
    // when there are shadows to cast, which can fall from outside the view).
    update(camera = null) {
      if (camera) frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const b of batches) {
        const arr = b.mesh.instanceMatrix.array;
        let n = 0;
        box.makeEmpty();
        for (const { o, chain } of b.parts) {
          if (!shown(chain)) continue;
          sphere.center.copy(b.centre);
          sphere.radius = b.radius;
          sphere.applyMatrix4(o.matrixWorld);
          if (camera && !frustum.intersectsSphere(sphere)) continue;
          box.expandByPoint(sphere.center);
          o.matrixWorld.toArray(arr, 16 * n++);
        }
        b.mesh.count = n;
        b.mesh.visible = n > 0;
        if (!n) continue;
        b.mesh.instanceMatrix.clearUpdateRanges();
        b.mesh.instanceMatrix.addUpdateRange(0, 16 * n);
        b.mesh.instanceMatrix.needsUpdate = true;
        // the middle of the batch, for sorting it among the see-through things
        box.getBoundingSphere(b.mesh.boundingSphere);
        b.mesh.boundingSphere.radius += b.radius;
      }
    },
  };
}
