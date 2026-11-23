// പ്രഷർ ഗേജ്: canvas-ൽ വരച്ച ഡയലും സൂചിയും
import * as THREE from 'three';
import { M, mesh } from './materials.js';

const PSI_PER_BAR = 14.5038;

export function createGauge({ radius = 3, max = 10, unit = 'bar', step = 1, psiStep = 25, rim = M.black }) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const group = new THREE.Group();
  // ബെസൽ
  const bezel = mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, radius * 0.5, 40), rim);
  bezel.rotation.x = Math.PI / 2;
  group.add(bezel);
  // ഡയൽ മുഖം (+Z ദിശയിൽ)
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = radius * 0.26;
  group.add(face);
  // ഗ്ലാസ്
  const glass = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), M.clear);
  glass.position.z = radius * 0.28;
  group.add(glass);

  const angleOf = (v) => ((225 - (270 * Math.min(Math.max(v, 0), max)) / max) * Math.PI) / 180;

  let last = -1;
  function draw(value) {
    const c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fbfbf8';
    ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();

    // bar സ്കെയിൽ (പുറം)
    ctx.strokeStyle = '#111'; ctx.fillStyle = '#111';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let v = 0; v <= max + 1e-6; v += step / 5) {
      const a = angleOf(v);
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const r1 = c * 0.92, r2 = major ? c * 0.78 : c * 0.85;
      ctx.lineWidth = major ? 3 : 1.4;
      ctx.beginPath();
      ctx.moveTo(c + r1 * Math.cos(a), c - r1 * Math.sin(a));
      ctx.lineTo(c + r2 * Math.cos(a), c - r2 * Math.sin(a));
      ctx.stroke();
      if (major) {
        ctx.font = 'bold 22px sans-serif';
        const r3 = c * 0.66;
        ctx.fillText(String(Math.round(v)), c + r3 * Math.cos(a), c - r3 * Math.sin(a));
      }
    }
    // psi സ്കെയിൽ (അകം, ചുവപ്പ്)
    ctx.fillStyle = '#c62828';
    ctx.font = '15px sans-serif';
    const maxPsi = max * PSI_PER_BAR;
    for (let p = 0; p <= maxPsi + 1e-6; p += psiStep) {
      const a = angleOf(p / PSI_PER_BAR);
      const r3 = c * 0.45;
      ctx.fillText(String(p), c + r3 * Math.cos(a), c - r3 * Math.sin(a));
    }
    ctx.fillStyle = '#111';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(unit, c, c + c * 0.38);
    ctx.fillStyle = '#c62828';
    ctx.font = '14px sans-serif';
    ctx.fillText('psi', c, c + c * 0.56);

    // സൂചി
    const a = angleOf(value);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c - c * 0.12 * Math.cos(a), c + c * 0.12 * Math.sin(a));
    ctx.lineTo(c + c * 0.8 * Math.cos(a), c - c * 0.8 * Math.sin(a));
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(c, c, 9, 0, Math.PI * 2); ctx.fill();
    tex.needsUpdate = true;
  }

  draw(0);
  return {
    group,
    set(value) {
      if (Math.abs(value - last) < 0.01) return;
      last = value;
      draw(value);
    },
  };
}
