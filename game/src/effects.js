// Juice: particles, floating texts, expanding rings, lightning bolts and screen
// shake. Nothing here affects the rules — it only shows what happened.
export function makeFx() {
  const fx = {
    particles: [],
    texts: [],
    rings: [],
    bolts: [],
    shakeMag: 0,
    burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        fx.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
          life: 0.4 + Math.random() * 0.35, maxLife: 0.75,
          size: 2 + Math.random() * 3.5, color,
        });
      }
    },
    text(x, y, str, color, size = 13) {
      fx.texts.push({ x, y, str, color, size, life: 0.9 });
    },
    ring(x, y, radius, color) {
      fx.rings.push({ x, y, radius, color, life: 0.4 });
    },
    addShake(mag) {
      fx.shakeMag = Math.min(9, fx.shakeMag + mag);
    },
    update(dt) {
      for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
        const p = fx.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          fx.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 160 * dt;
      }
      for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
        const t = fx.texts[i];
        t.life -= dt;
        t.y -= 34 * dt;
        if (t.life <= 0) fx.texts.splice(i, 1);
      }
      for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
        const r = fx.rings[i];
        r.life -= dt;
        if (r.life <= 0) fx.rings.splice(i, 1);
      }
      for (let i = fx.bolts.length - 1; i >= 0; i -= 1) {
        const b = fx.bolts[i];
        b.life -= dt;
        if (b.life <= 0) fx.bolts.splice(i, 1);
      }
      if (fx.shakeMag > 0) fx.shakeMag = Math.max(0, fx.shakeMag - dt * 22);
    },
    draw(ctx) {
      // Rings.
      for (const r of fx.rings) {
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * (1 - r.life / 0.4) + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Lightning bolts (jagged).
      for (const b of fx.bolts) {
        ctx.strokeStyle = `rgba(220, 190, 255, ${Math.max(0, b.life / 0.16)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const segs = 5;
        ctx.moveTo(b.x1, b.y1);
        for (let i = 1; i < segs; i += 1) {
          const t = i / segs;
          const mx = b.x1 + (b.x2 - b.x1) * t + (Math.random() - 0.5) * 16;
          const my = b.y1 + (b.y2 - b.y1) * t + (Math.random() - 0.5) * 16;
          ctx.lineTo(mx, my);
        }
        ctx.lineTo(b.x2, b.y2);
        ctx.stroke();
      }
      // Particles.
      for (const p of fx.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Floating texts.
      ctx.textAlign = 'center';
      for (const t of fx.texts) {
        ctx.globalAlpha = Math.min(1, t.life / 0.5);
        ctx.font = `bold ${t.size}px system-ui, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
  return fx;
}
