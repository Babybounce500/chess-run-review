// Minikarte: die Stadt wird einmal vorgezeichnet, danach nur gedreht und verschoben.
import { MAP } from './config.js';

const PX = 2, HALF = 330;
export function createMinimap(canvas, world) {
  const base = document.createElement('canvas'); base.width = base.height = HALF * 2 * PX;
  const g = base.getContext('2d');
  const rect = (r, color) => { g.fillStyle = color; g.fillRect((r.x0 + HALF) * PX, (r.z0 + HALF) * PX, (r.x1 - r.x0) * PX, (r.z1 - r.z0) * PX); };
  rect({ x0: -HALF, z0: -HALF, x1: HALF, z1: HALF }, '#3a2b52');
  rect({ x0: -MAP.half, z0: -MAP.half, x1: MAP.half, z1: MAP.half }, '#8d7390');
  rect({ x0: -300, z0: MAP.beachZ, x1: MAP.harbourX, z1: MAP.seaZ }, '#e8c08c');
  rect({ x0: -HALF, z0: MAP.seaZ, x1: HALF, z1: HALF }, '#1f6f93');
  rect({ x0: MAP.harbourX, z0: MAP.harbourZ, x1: HALF, z1: HALF }, '#1f6f93');
  rect({ x0: MAP.pierX0, z0: MAP.harbourZ, x1: MAP.pierX1, z1: MAP.pierZ1 }, '#b98a66');
  for (const s of world.roads.segs) rect(s.rect, '#f6e7d8');
  const R = world.roads;
  for (const n of R.nodes) rect({ x0: n.x - R.vw[n.i] / 2, x1: n.x + R.vw[n.i] / 2, z0: n.z - R.hw[n.j] / 2, z1: n.z + R.hw[n.j] / 2 }, '#f6e7d8');
  for (const b of world.blocks) if (b.type === 'plaza') rect(b.inner, '#5fbf8f'); else if (b.type === 'parking') rect(b.inner, '#b9a2c4');
  for (const b of world.buildings) rect(b, '#4d3a66');
  for (const c of world.containers) rect(c, c.color);

  const ctx = canvas.getContext('2d');
  return {
    draw(me, car, yaw, onFoot, range) {
      const css = canvas.clientWidth || 140, ratio = Math.min(2, window.devicePixelRatio || 1), size = Math.round(css * ratio);
      if (canvas.width !== size) canvas.width = canvas.height = size;
      const r = size / 2, s = r / range;                              // Bildpunkte je Meter
      ctx.save(); ctx.clearRect(0, 0, size, size);
      ctx.beginPath(); ctx.arc(r, r, r - 1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#1f6f93'; ctx.fillRect(0, 0, size, size);
      ctx.translate(r, r); ctx.rotate(yaw + Math.PI); ctx.scale(s / PX, s / PX); ctx.translate(-(me.x + HALF) * PX, -(me.z + HALF) * PX);
      ctx.drawImage(base, 0, 0);
      ctx.restore();
      // Richtung im Bild für einen Kartenpunkt
      const to = (x, z) => { const dx = (x - me.x) * s, dz = (z - me.z) * s, a = yaw + Math.PI, c = Math.cos(a), n = Math.sin(a); return [dx * c - dz * n, dx * n + dz * c]; };
      ctx.save(); ctx.translate(r, r);
      if (onFoot) {
        let [x, y] = to(car.x, car.z); const l = Math.hypot(x, y), max = r - 9 * ratio; if (l > max) { x *= max / l; y *= max / l; }
        ctx.beginPath(); ctx.arc(x, y, 6 * ratio, 0, Math.PI * 2); ctx.fillStyle = '#ff2f7e'; ctx.fill(); ctx.lineWidth = 2 * ratio; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      const [nx, ny] = (() => { const a = yaw + Math.PI; return [Math.sin(a), -Math.cos(a)]; })();
      ctx.fillStyle = '#12082a'; ctx.beginPath(); ctx.arc(nx * (r - 10 * ratio), ny * (r - 10 * ratio), 8 * ratio, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + 10 * ratio + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx * (r - 10 * ratio), ny * (r - 10 * ratio) + 0.5);
      ctx.rotate(yaw - me.h); ctx.beginPath(); ctx.moveTo(0, -9 * ratio); ctx.lineTo(6.5 * ratio, 7 * ratio); ctx.lineTo(0, 3.5 * ratio); ctx.lineTo(-6.5 * ratio, 7 * ratio); ctx.closePath();
      ctx.fillStyle = onFoot ? '#37e6e0' : '#ff2f7e'; ctx.fill(); ctx.lineWidth = 2 * ratio; ctx.strokeStyle = '#12082a'; ctx.stroke();
      ctx.restore();
    }
  };
}
