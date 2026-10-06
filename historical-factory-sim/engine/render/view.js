// The 3D view: scene, camera, lights, the sun, peeling buildings open floor
// by floor, picking, and per-frame updates of everything that moves.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBuildings, buildRoomLabels } from './buildings.js';
import { buildScenery } from './scenery.js';
import { PropsLayer } from './props.js';
import { FiguresLayer } from './figures.js';
import { LotsLayer } from './lots.js';
import { PaperLayer } from './paper.js';
import { VehiclesLayer } from './vehicles.js';
import { WagonsLayer } from './wagons.js';
import { MillEngine, RopeDrive, lancashireBoiler, Smoke } from './machinery.js';
import { sunPosition, sunDirection, lighting } from './sky.js';

export class View {
  constructor(container, scenario) {
    this.container = container;
    this.scenario = scenario;
    const site = scenario.site;
    const pal = scenario.palette;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#b8c4c8', 900, 3200);
    this.scene = scene;

    const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 2, 9000);
    camera.position.set(330, 360, 610);
    this.camera = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-50, 10, 30);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.48;
    controls.minDistance = 25;
    controls.maxDistance = 2600;
    controls.screenSpacePanning = false;
    this.controls = controls;

    // Lights.
    this.hemi = new THREE.HemisphereLight('#dfe6ea', '#4a4236', 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -480; sc.right = 480; sc.top = 420; sc.bottom = -420; sc.near = 10; sc.far = 4000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.target.position.set(-20, 0, 20);
    scene.add(this.sun, this.sun.target);
    this.interior = new THREE.AmbientLight('#ffd9a0', 0);
    scene.add(this.interior);

    // The world.
    const scenery = buildScenery(scenario);
    scene.add(scenery.group);
    this.sceneryLit = scenery.lit;
    const buildings = buildBuildings(site, pal);
    scene.add(buildings.root);
    this.buildings = buildings;
    this.labels = buildRoomLabels(site);
    for (const l of this.labels) scene.add(l);
    this.props = new PropsLayer(site, pal);
    scene.add(this.props.group);
    this.figures = new FiguresLayer(scenario.world);
    scene.add(this.figures.group);
    if (scenario.world.paper) {
      this.paperLayer = new PaperLayer(scenario);
      scene.add(this.paperLayer.group);
    }
    if (scenario.production) {
      this.lots = new LotsLayer(scenario);
      scene.add(this.lots.group);
      // A glow at the door of each stove while it's loaded.
      this.stoveGlows = [];
      for (const unit of scenario.production.equipment.get('stove') || []) {
        const spot = site.spots.get(unit.spot);
        if (!spot) continue;
        const glow = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 0.2), new THREE.MeshStandardMaterial({ color: '#ff9a4a', emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 1.5 }));
        const dir = new THREE.Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
        glow.position.set(spot.x + dir.x * 0.5, spot.y + 0.6, spot.z + dir.z * 0.5);
        glow.rotation.y = spot.facing;
        glow.visible = false;
        scene.add(glow);
        this.stoveGlows.push({ unit, spot, glow });
      }
    }

    // Heaps of loose stuff in the open, sized by what's in the store.
    this.heaps = (scenario.scenery?.heaps || []).map((h) => {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(h.radius, h.height, 9, 2), new THREE.MeshStandardMaterial({ color: h.colour, roughness: 1, flatShading: true }));
      mesh.position.set(h.x, 0, h.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { h, mesh, store: scenario.production?.stores.get(h.store) };
    });

    if (scenario.vehicles?.length) {
      this.vehicles = new VehiclesLayer(scenario);
      scene.add(this.vehicles.group);
    }
    if (scenario.railway) {
      this.wagons = new WagonsLayer(scenario);
      scene.add(this.wagons.group);
    }

    // The engine house and boiler house.
    const mc = scenario.machinery;
    this.engine = new MillEngine(mc.engine);
    scene.add(this.engine.group);
    const from = this.engine.ropePoint();
    this.ropes = new RopeDrive(from, mc.ropeTargets, { radius: mc.engine.flywheelRadius || 9 });
    scene.add(this.ropes.group);
    this.boilerDoors = [];
    for (const b of mc.boilers) {
      const g = lancashireBoiler(b, pal);
      scene.add(g);
      this.boilerDoors.push(g.userData.doorMaterial);
    }
    if (mc.steamPipe) {
      const [a, b] = mc.steamPipe.map((p) => new THREE.Vector3(...p));
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, a.distanceTo(b), 10), new THREE.MeshStandardMaterial({ color: '#d8d2c2', roughness: 0.9 }));
      pipe.position.copy(a).add(b).multiplyScalar(0.5);
      pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      scene.add(pipe);
    }
    const chimney = buildings.root.getObjectByName('chimney');
    this.smoke = chimney ? new Smoke(chimney.userData.chimneyTop) : null;
    if (this.smoke) scene.add(this.smoke.group);

    this.cut = { level: Infinity };
    this.applyCut();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onPick = null;
    this.follow = false;
    let down = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.pick(e);
      down = null;
    });
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // level: Infinity (roofs on), 'open' (roofs off) or a floor number (that
  // floor and below shown, everything above peeled away).
  setCut(level) {
    this.cut.level = level;
    this.applyCut();
  }

  isVisible = (building, floor) => {
    const L = this.cut.level;
    if (L === Infinity || L === 'open') return true;
    const b = this.scenario.site.buildings.get(building);
    if (!b || b.floors <= 1) return true;
    return floor <= L;
  };

  applyCut() {
    const L = this.cut.level;
    for (const { spec, floors, roof, floorMats } of this.buildings.byId.values()) {
      roof.visible = L === Infinity;
      floors.forEach((fg, f) => { fg.visible = this.isVisible(spec.id, f); });
      // Cut the walls of the top floor shown at about waist height.
      const top = L === Infinity ? -1 : L === 'open' ? spec.floors - 1 : Math.min(L, spec.floors - 1);
      floorMats.forEach((mats, f) => {
        const planes = f === top ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), f * spec.floorHeight + 4.5)] : null;
        for (const m of mats) {
          m.clippingPlanes = planes;
          m.clipShadows = true;
          m.needsUpdate = true;
        }
      });
    }
    for (const l of this.labels) {
      const b = this.scenario.site.buildings.get(l.userData.building);
      let top;
      if (L === Infinity) top = -1;
      else if (L === 'open') top = b.floors - 1;
      else top = Math.min(L, b.floors - 1);
      l.visible = l.userData.floor === top && b.floors > 0 && (L !== 'open' || true);
    }
    this.props.setVisibility(this.isVisible);
  }

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hitsP = this.raycaster.intersectObjects(this.figures.pickables(), false);
    const hit = hitsP.find((h) => this.figures.visible[h.instanceId]);
    const hitsL = this.lots ? this.raycaster.intersectObjects(this.lots.pickables(), false) : [];
    const lotHit = hitsL.find((h) => h.instanceId < h.object.count);
    if (hit && (!lotHit || hit.distance <= lotHit.distance + 1)) {
      this.select(hit.instanceId);
      this.onPick?.({ kind: 'person', person: this.scenario.world.people[hit.instanceId] });
      return;
    }
    const hitsW = this.wagons ? this.raycaster.intersectObjects(this.wagons.pickables(), false) : [];
    const wHit = hitsW.find((h) => h.object.parent?.visible);
    if (wHit && (!lotHit || wHit.distance < lotHit.distance)) {
      this.select(-1);
      this.onPick?.({ kind: 'wagon', wagon: this.wagons.wagonFor(wHit.object) });
      return;
    }
    const hitsV = this.vehicles ? this.raycaster.intersectObjects(this.vehicles.pickables(), false) : [];
    const vHit = hitsV.find((h) => h.object.visible && h.object.parent?.visible);
    if (vHit && (!lotHit || vHit.distance < lotHit.distance)) {
      this.select(-1);
      this.onPick?.({ kind: 'vehicle', vehicle: this.vehicles.vehicleFor(vHit.object) });
      return;
    }
    if (lotHit) {
      const id = lotHit.object.userData.ids[lotHit.instanceId];
      this.select(-1);
      if (id && id.startsWith('bike:')) {
        const frameNo = Number(id.slice(5));
        this.onPick?.({ kind: 'bike', machine: this.scenario.world.works.register.find((m) => m.frameNo === frameNo) });
      } else if (id && id !== 'showroom') {
        const lot = this.scenario.production.lots.find((l) => l.id === id);
        if (lot) this.onPick?.({ kind: 'lot', lot });
      }
      return;
    }
    const visibleObjects = [];
    this.scene.traverseVisible((o) => { if (o.isMesh) visibleObjects.push(o); });
    const hits = this.raycaster.intersectObjects(visibleObjects, false);
    for (const h of hits) {
      const ud = h.object.userData || {};
      if (ud.kind === 'prop') {
        const spotId = this.props.spotAt(h.object, h.instanceId);
        this.onPick?.({ kind: 'spot', spot: this.scenario.site.spots.get(spotId) });
        return;
      }
      if (ud.kind === 'floor' || ud.kind === 'wall' || ud.kind === 'roof') {
        const b = this.scenario.site.buildings.get(ud.building);
        const floor = ud.floor ?? (b.floors - 1);
        const p = h.point;
        const room = [...this.scenario.site.rooms.values()].find((r) => r.building === b.id && r.floor === floor && p.x >= r.x0 && p.x <= r.x1);
        this.onPick?.({ kind: 'building', building: b, room, floor });
        return;
      }
    }
    this.select(-1);
    this.onPick?.({ kind: 'none' });
  }

  select(index) {
    this.figures.selected = index;
  }

  focusOn(pos, distance = 140) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(pos);
    this.camera.position.copy(pos).add(dir.multiplyScalar(distance));
  }

  setPreset(name) {
    const presets = this.scenario.cameraPresets || {};
    const p = presets[name];
    if (!p) return;
    this.controls.target.set(...p.target);
    this.camera.position.set(...p.position);
    if (p.cut !== undefined) this.setCut(p.cut);
  }

  frame(t, dt, realTime) {
    const sc = this.scenario;
    const cal = sc.cal;
    const parts = cal.parts(t);
    const dayOfYear = Math.floor((Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / 86400000);
    const minutes = parts.hour * 60 + parts.minute + (t % 1);
    const sp = sunPosition(dayOfYear, minutes, sc.meta.latitude, sc.meta.longitude);
    const L = lighting(sp.elevation);
    this.scene.background = L.sky;
    this.scene.fog.color.copy(L.fog);
    this.hemi.intensity = L.hemi;
    this.hemi.color.set(L.night > 0.5 ? '#9fb2d6' : '#dfe6ea');
    const dir = sunDirection(sp);
    const tg = this.controls.target;
    this.sun.target.position.set(Math.round(tg.x / 50) * 50, 0, Math.round(tg.z / 50) * 50);
    this.sun.target.updateMatrixWorld();
    this.sun.position.copy(this.sun.target.position).add(dir.multiplyScalar(1500));
    this.sun.intensity = L.sun;
    this.sun.color.copy(L.sunColour);
    this.sun.visible = L.sun > 0.01;

    const works = sc.shopsLit ? sc.shopsLit(t) : sc.shopsWorking(t);
    const office = sc.officeWorking(t);
    this.interior.intensity = (works || office) ? 0.55 * L.night : 0.05 * L.night;
    const mod = parts.hour * 60 + parts.minute;
    for (const { spec, litMats } of this.buildings.byId.values()) {
      let on = spec.style === 'office' ? office || (spec.id === 'gatehouse' && L.night > 0.3) : works;
      // Buildings with their own hours (the railway's) are lit by those.
      if (spec.litHours) on = mod >= spec.litHours[0] && mod < spec.litHours[1] && sc.cal.dow(t) !== 0;
      for (const { mat } of litMats) mat.emissiveIntensity = on ? 1.1 * L.night : 0;
    }
    for (const { mat, kind } of this.sceneryLit) {
      mat.emissiveIntensity = kind === 'street' ? 1.6 * L.night : 0.9 * L.night;
    }

    const running = sc.engineRunning(t) ? 1 : 0;
    this.engine.update(dt, running);
    const sp2 = this.engine.speed;
    this.ropes.update(dt, sp2);
    this.props.animate(dt, sp2, works ? 1.3 : 0.25);
    for (const m of this.boilerDoors) m.emissiveIntensity = 0.6 + 0.4 * Math.sin(realTime * 3);
    this.smoke?.update(dt, 0.35 + 0.65 * sp2);

    this.figures.update(t, realTime, this.isVisible);
    this.vehicles?.update(t);
    this.wagons?.update(t, this.isVisible);
    for (const { h, mesh, store } of this.heaps) {
      const f = Math.cbrt(Math.max(0, store ? store.qty(h.item) : 0) / h.full);
      mesh.visible = f > 0.05;
      mesh.scale.setScalar(Math.max(f, 0.05));
      mesh.position.y = (h.height * f) / 2;
    }
    this.paperLayer?.update(this.figures, this.isVisible);
    if (this.lots) {
      this.lots.update(t, this.figures, this.isVisible);
      for (const { unit, spot, glow } of this.stoveGlows) {
        glow.visible = !!unit.load && this.isVisible(spot.building, spot.floor);
        glow.material.emissiveIntensity = 1.2 + 0.3 * Math.sin(realTime * 2 + spot.x);
      }
    }
    if (this.follow && this.figures.selected >= 0 && this.figures.visible[this.figures.selected]) {
      const v = this.figures.positions[this.figures.selected];
      const delta = v.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 4));
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
