// 3D-Szene: Stadt, Fahrzeuge, Figur, Kamera-Anwendung, Qualitätsstufen, Messwerte.
import * as THREE from '../vendor/three.module.js';
import { QUALITY } from './config.js';
import { buildCity } from './citymesh.js';
import { createEnvironment } from './environment.js';
import { createEffects } from './effects.js';
import { palmGeometry, lampGeometry, lampGlowGeometry, bollardGeometry, benchGeometry, planterGeometry, parkedGeometry, playerCar, person, CAR_COLORS } from './models.js';
import { sideSpeed, forwardSpeed, speedOf } from './vehicles.js';

export function createView(container, world, quality = 'high') {
  const dpr = () => Math.max(1, window.devicePixelRatio || 1);
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low' && dpr() < 2, powerPreference: 'high-performance' });
  renderer.sortObjects = true;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.25, 800);
  const env = createEnvironment(scene), city = buildCity(world, scene), fx = createEffects(scene);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Inventar als Instanzen ---------- */
  const lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
  const basic = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const instanced = (geometry, material, list, tall) => {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length)); mesh.frustumCulled = false; mesh.count = 0; scene.add(mesh);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const items = list.map((p) => ({ x: p.x, z: p.z, m: m.compose(new THREE.Vector3(p.x, 0, p.z), q.setFromAxisAngle(up, p.rot), new THREE.Vector3(p.s, p.s, p.s)).clone() }));
    return { mesh, items, reach: tall };
  };
  const of = (k) => world.props.filter((p) => p.kind === k);
  const props = [
    instanced(palmGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), of('palm'), 1),
    instanced(lampGeometry(), lambert, of('lamp'), 0.7),
    instanced(lampGlowGeometry(), basic, of('lamp'), 0.7),
    instanced(bollardGeometry(), lambert, of('bollard'), 0.45),
    instanced(benchGeometry(), lambert, of('bench'), 0.45),
    instanced(planterGeometry(), lambert, of('planter'), 0.45)
  ];
  const dir = new THREE.Vector3();
  // nur Instanzen im Sichtkegel (grob) und in Reichweite übernehmen
  function cull(view) {
    camera.getWorldDirection(dir);
    const fl = Math.hypot(dir.x, dir.z) || 1, fx2 = dir.x / fl, fz = dir.z / fl, flat = fl > 0.6;
    const cx = camera.position.x, cz = camera.position.z, cosLimit = Math.cos(Math.min(Math.PI * 0.47, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) + 0.25));
    return (x, z, reach) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); if (d > view * reach) return false; if (!flat || d < 14) return true; return (dx * fx2 + dz * fz) / d > cosLimit; };
  }

  const parked = new THREE.InstancedMesh(parkedGeometry(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0x665044 }), Math.max(1, world.parked.length));
  parked.frustumCulled = false; scene.add(parked);
  const colors = CAR_COLORS.map((c) => new THREE.Color(c));
  const hero = playerCar(); scene.add(hero.group);
  const figure = person(); scene.add(figure.group);
  const carShadow = fx.shadow(3.1, 6.2), manShadow = fx.shadow(1.1, 1.1), parkedShadows = new THREE.InstancedMesh(carShadow.geometry, carShadow.material, Math.max(1, world.parked.length));
  parkedShadows.frustumCulled = false; parkedShadows.renderOrder = 1; scene.add(parkedShadows);
  // Markierung über dem eigenen Auto, damit man es zu Fuß wiederfindet
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0x37e6e0, toneMapped: false })); scene.add(marker);

  let Q = QUALITY[quality], level = quality, width = 1, height = 1, shake = 0, time = 0, smokeT = 0;
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3();

  function resize() {
    width = Math.max(1, container.clientWidth || innerWidth); height = Math.max(1, container.clientHeight || innerHeight);
    renderer.setPixelRatio(Math.min(dpr(), Q.maxRatio) * Q.ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Hochformat: waagrechter Blick bleibt brauchbar weit; das Geschehen rückt nach oben (unten liegen die Knöpfe)
    camera.fov = camera.aspect < 1 ? Math.min(80, 2 * Math.atan(Math.tan(33 * Math.PI / 180) / camera.aspect) * 180 / Math.PI) : 60;
    const touch = document.body.classList.contains('has-touch');
    const lift = camera.aspect < 0.8 ? (touch ? 0.1 : 0.03) : touch && height < 520 ? 0.04 : 0;
    if (lift) camera.setViewOffset(width, height, 0, Math.round(height * lift), width, height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  resize();

  function render(vs, cam, dt) {
    time += dt;
    const car = vs.car;
    // Eigenes Auto
    hero.group.position.set(car.x, 0, car.z); hero.group.rotation.y = car.h;
    const u = forwardSpeed(car), side = sideSpeed(car);
    hero.lean.rotation.z += ((reduced ? 0 : Math.max(-0.07, Math.min(0.07, -car.w * u * 0.0026))) - hero.lean.rotation.z) * Math.min(1, dt * 8);
    hero.lean.rotation.x += (((car.braking ? 0.025 : 0) - (vs.gas && u > 0 && u < 20 ? 0.018 : 0)) - hero.lean.rotation.x) * Math.min(1, dt * 6);
    for (const w of hero.wheels) { w.spin.rotation.x += u * dt / 0.4; if (w.front) w.pivot.rotation.y = -car.steer * 0.5; }
    hero.tailMat.color.setHex(car.braking ? 0xff2a3c : car.reversing ? 0xffd9c0 : 0x8a1424);
    carShadow.position.set(car.x, 0.05, car.z); carShadow.rotation.y = car.h;
    // Figur
    const p = vs.player, onFoot = vs.mode === 'foot';
    figure.group.visible = manShadow.visible = onFoot && Math.hypot(cam.pos[0] - p.x, cam.pos[1] - 1.4 - p.y, cam.pos[2] - p.z) > 0.75;
    figure.group.position.set(p.x, p.y, p.z); figure.group.rotation.y = p.h;
    figure.animate(p, p.walked, Math.hypot(p.vx, p.vz), dt);
    manShadow.position.set(p.x, 0.055, p.z); manShadow.scale.setScalar(Math.max(0.4, 1 - p.y * 0.4));
    marker.visible = onFoot && Math.hypot(p.x - car.x, p.z - car.z) > 3.5;
    marker.position.set(car.x, 2.5 + (reduced ? 0 : Math.sin(time * 2.5) * 0.15), car.z); marker.rotation.y = time * 1.5;

    // Spuren und Qualm
    const s = Math.sin(car.h), c = Math.cos(car.h), driving = vs.mode === 'car';
    const slide = driving && speedOf(car) > 5 && (Math.abs(side) > 2.6 || (car.braking && u > 14));
    for (let i = 0; i < 2; i++) {
      const off = i ? 0.9 : -0.9, x = car.x - c * off - s * 1.4, z = car.z + s * off - c * 1.4;
      fx.trail(i, x, z, slide);
      if (slide && Q.particles && dt > 0 && Math.random() < dt * 28) fx.smoke.emit(x, 0.35, z, (Math.random() - 0.5), 0.7 + Math.random(), (Math.random() - 0.5), 0.9, 0.93, 0.82, 0.86, 0.45);
    }
    smokeT -= dt;
    if (car.damage > 55 && smokeT <= 0) { smokeT = car.damage > 85 ? 0.07 : 0.18; const g = car.damage > 85 ? 0.16 : 0.45; fx.smoke.emit(car.x + s * 1.6, 1.0, car.z + c * 1.6, (Math.random() - 0.5) * 0.5, 1.3, (Math.random() - 0.5) * 0.5, 1.4, g, g * 0.9, g, 0.55); }
    fx.update(dt);

    // Kamera
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    if (shake > 0.002 && !reduced) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake * 0.6; }
    shake *= Math.max(0, 1 - dt * 9);
    camera.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    camera.updateMatrixWorld();

    city.update(camera.position.x, camera.position.z, Q.view);
    const seen = cull(Q.view);
    for (const set of props) { let n = 0; for (const it of set.items) if (seen(it.x, it.z, set.reach)) set.mesh.setMatrixAt(n++, it.m); set.mesh.count = n; set.mesh.visible = n > 0; set.mesh.instanceMatrix.needsUpdate = true; }
    let n = 0;
    for (const o of vs.parked) {
      if (!seen(o.x, o.z, 0.75)) continue;
      m4.compose(v3.set(o.x, 0, o.z), q4.setFromAxisAngle(up, o.h), one); parked.setMatrixAt(n, m4); parked.setColorAt(n, colors[o.color % colors.length]);
      m4.setPosition(o.x, 0.048, o.z); parkedShadows.setMatrixAt(n, m4); n++;
    }
    parked.count = parkedShadows.count = n; parked.visible = parkedShadows.visible = n > 0; parked.instanceMatrix.needsUpdate = parkedShadows.instanceMatrix.needsUpdate = true; if (parked.instanceColor) parked.instanceColor.needsUpdate = true;
    env.update(camera, time, Q.view);
    renderer.render(scene, camera);
  }

  return {
    render, resize, renderer, camera, scene,
    setQuality(name) { if (!QUALITY[name] || name === level) return; level = name; Q = QUALITY[name]; resize(); },
    quality: () => level,
    crash(speed, car) {
      shake = Math.min(0.55, speed * 0.028);
      const s = Math.sin(car.h), c = Math.cos(car.h), front = forwardSpeed(car) <= 0 ? 2 : -2;
      for (let i = 0; i < Math.min(26, speed * 1.6); i++) fx.sparks.emit(car.x + s * front + (Math.random() - 0.5), 0.6, car.z + c * front + (Math.random() - 0.5), (Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8, 0.3 + Math.random() * 0.4, 1, 0.75, 0.35, 1, 14);
    },
    dust(x, z) { for (let i = 0; i < 6; i++) fx.smoke.emit(x, 0.15, z, (Math.random() - 0.5) * 2, 0.4, (Math.random() - 0.5) * 2, 0.5, 0.95, 0.85, 0.75, 0.35); },
    reset() { fx.clear(); shake = 0; },
    stats() {
      const i = renderer.info, gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: level, ratio: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height], chunks: city.chunks.filter((c) => c.group.visible).length, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), cam: camera.position.toArray(), fov: camera.fov };
    },
    // Bildschirmposition eines Weltpunkts (für Layoutprüfungen)
    project(x, y, z) { const q = new THREE.Vector3(x, y, z).project(camera); return { x: (q.x + 1) / 2 * width, y: (1 - q.y) / 2 * height, front: q.z < 1 }; }
  };
}
