// Abendhimmel, Licht, Dunst und Wasser.
import * as THREE from '../vendor/three.module.js';
import { SUN } from './textures.js';
import { MAP } from './config.js';

export const FOG = 0xe9907f;
const SKY = /* glsl */`
  uniform vec3 sun; varying vec3 dir;
  float band(float y, float c, float w) { return smoothstep(w, 0.0, abs(y - c)); }
  void main() {
    vec3 d = normalize(dir); float h = max(d.y, 0.0);
    vec3 horizon = vec3(0.914, 0.565, 0.498), low = vec3(1.0, 0.62, 0.40), mid = vec3(0.86, 0.38, 0.56), high = vec3(0.20, 0.17, 0.45);
    vec3 c = mix(horizon, low, smoothstep(0.0, 0.07, h)); c = mix(c, mid, smoothstep(0.07, 0.3, h)); c = mix(c, high, smoothstep(0.28, 0.75, h));
    float s = max(dot(d, normalize(sun)), 0.0);
    c += vec3(1.0, 0.55, 0.22) * pow(s, 9.0) * 0.55;
    float disc = smoothstep(0.9975, 0.9981, s);
    float stripes = step(0.5, fract(d.y * 95.0)) * step(d.y, normalize(sun).y - 0.012);
    c = mix(c, vec3(1.0, 0.86, 0.55), disc * (1.0 - stripes * 0.75));
    float a = atan(d.x, d.z);
    float cl = band(h, 0.16 + 0.018 * sin(a * 3.0), 0.022) * smoothstep(0.1, 0.9, sin(a * 5.0 + 1.0) * sin(a * 2.0 - 0.4) + 0.35)
             + band(h, 0.27 + 0.02 * sin(a * 4.0 + 2.0), 0.016) * smoothstep(0.2, 0.9, sin(a * 7.0) * sin(a * 3.0 + 1.7) + 0.25)
             + band(h, 0.09, 0.009) * smoothstep(0.35, 0.9, sin(a * 9.0 + 0.6) * sin(a * 4.0) + 0.3);
    c = mix(c, vec3(1.0, 0.72, 0.66) - h * 0.7, clamp(cl, 0.0, 1.0) * 0.75);
    gl_FragColor = vec4(c, 1.0);
  }`;

export function createEnvironment(scene) {
  scene.fog = new THREE.Fog(FOG, 80, 300);
  scene.background = new THREE.Color(FOG);
  const hemi = new THREE.HemisphereLight(0xc9b8ff, 0x9a6a60, 1.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb47a, 2.3); sun.position.set(SUN[0], SUN[1], SUN[2]); scene.add(sun);
  const sunDir = new THREE.Vector3(SUN[0], SUN[1] * 0.45, SUN[2]);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 14), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: sunDir } },
    vertexShader: 'varying vec3 dir; void main(){ dir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: SKY
  }));
  sky.renderOrder = 10; sky.frustumCulled = false; scene.add(sky);            // zuletzt zeichnen: spart Füllrate

  const uniforms = { time: { value: 0 }, sun: { value: sunDir }, near: { value: 80 }, far: { value: 300 }, fogColor: { value: new THREE.Vector3((FOG >> 16 & 255) / 255, (FOG >> 8 & 255) / 255, (FOG & 255) / 255) } };   // Bildschirmfarbe, ohne Umrechnung
  const waterMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec3 w; void main(){ vec4 p = modelMatrix * vec4(position, 1.0); w = p.xyz; gl_Position = projectionMatrix * viewMatrix * p; }',
    fragmentShader: /* glsl */`
      uniform float time, near, far; uniform vec3 sun, fogColor; varying vec3 w;
      void main() {
        vec2 p = w.xz;
        float a = sin(p.x * 0.31 + time * 0.9) + sin(p.y * 0.47 - time * 1.1) + sin((p.x + p.y) * 0.17 + time * 0.6);
        float b = sin(p.x * 1.3 - time * 1.7 + a) * sin(p.y * 1.1 + time * 1.3 + a);
        vec3 view = normalize(w - cameraPosition);
        vec3 n = normalize(vec3(0.05 * b + 0.03 * a, 1.0, 0.04 * b - 0.02 * a));
        vec3 r = reflect(view, n);
        float f = pow(1.0 - max(-view.y, 0.0), 3.0);
        vec3 c = mix(vec3(0.07, 0.24, 0.36), vec3(0.80, 0.45, 0.55), f);
        c += vec3(1.0, 0.62, 0.30) * pow(max(dot(r, normalize(sun)), 0.0), 60.0) * 1.2;
        c += vec3(0.10, 0.07, 0.09) * smoothstep(0.55, 1.0, b);
        float d = length(w - cameraPosition);
        gl_FragColor = vec4(mix(c, fogColor, smoothstep(near * 1.5, far * 1.5, d)), 1.0);
      }`
  });
  const plane = (x0, z0, x1, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), waterMat); m.position.set((x0 + x1) / 2, -0.7, (z0 + z1) / 2); scene.add(m); return m; };
  // zwei Flächen: offenes Meer und Hafenbecken
  const sea = plane(-760, MAP.seaZ, MAP.harbourX, 900);
  const basin = plane(MAP.harbourX, MAP.harbourZ, 760, 900);
  return {
    sky, sea, basin,
    update(camera, time, view) {
      sky.position.copy(camera.position);
      uniforms.time.value = time; uniforms.near.value = view * 0.3; uniforms.far.value = view;
      scene.fog.near = view * 0.28; scene.fog.far = view;
    }
  };
}
