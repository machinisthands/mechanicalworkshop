// നീല PU ട്യൂബ്: രണ്ട് പോർട്ടുകൾക്കിടയിൽ വളഞ്ഞു കിടക്കുന്നത്, അയഞ്ഞ അറ്റം തെറിക്കുന്നത്
import * as THREE from 'three';
import { pickable } from './materials.js';

const BLUE = new THREE.Color(0x2a7de1);
const RED = new THREE.Color(0xe53935);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpM = new THREE.Vector3();

let nextId = 1;

export class Tube {
  constructor(size, scene) {
    this.id = nextId++;
    this.size = size;
    this.scene = scene;
    this.r = size === 10 ? 0.5 : 0.22;
    this.ends = [{ port: null }, { port: null }];
    this.freePos = new THREE.Vector3();     // അയഞ്ഞ അറ്റത്തിന്റെ ഇപ്പോഴത്തെ സ്ഥാനം
    this.dragTarget = null;                  // വലിക്കുമ്പോൾ pointer സ്ഥാനം
    this.whip = 0;                           // തെറിക്കലിന്റെ ശക്തി (bar)
    this.pressure = 0;
    this.phase = Math.random() * 10;
    this.dirty = true;

    this.mat = new THREE.MeshStandardMaterial({ color: BLUE.clone(), roughness: 0.35, metalness: 0.0, transparent: true, opacity: 0.92, emissive: 0x000000 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.castShadow = true;
    pickable(this.mesh, { kind: 'tube', tube: this });
    scene.add(this.mesh);

    // അയഞ്ഞ അറ്റം പിടിക്കാനുള്ള ഭാഗം
    this.handle = new THREE.Mesh(
      new THREE.SphereGeometry(size === 10 ? 1.6 : 1.3, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0x2a7de1, transparent: true, opacity: 0.18, depthWrite: false })
    );
    pickable(this.handle, { kind: 'freeEnd', tube: this });
    this.handle.visible = false;
    scene.add(this.handle);

    // എയർ ചീറ്റുന്നത് കാണിക്കാൻ ഒരു cone
    const jetGeo = new THREE.ConeGeometry(size === 10 ? 1.2 : 0.8, 5, 16, 1, true);
    jetGeo.translate(0, -2.5, 0);
    jetGeo.rotateX(Math.PI); // അറ്റം tube-ൽ, വിരിവ് പുറത്തേക്ക് (+Y)
    this.jet = new THREE.Mesh(jetGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    this.jet.visible = false;
    scene.add(this.jet);
  }

  get connectedCount() { return (this.ends[0].port ? 1 : 0) + (this.ends[1].port ? 1 : 0); }
  get freeIndex() { return this.ends[0].port ? (this.ends[1].port ? -1 : 1) : 0; }
  get attachedPort() { return this.ends[0].port || this.ends[1].port; }

  attach(i, port) {
    this.ends[i].port = port;
    port.tube = this;
    port.tubeEnd = i;
    this.dirty = true;
  }

  detach(i) {
    const p = this.ends[i].port;
    if (!p) return;
    p.tube = null;
    p.tubeEnd = -1;
    this.ends[i].port = null;
    p.tip(this.freePos);
    this.dirty = true;
  }

  dispose() {
    for (const i of [0, 1]) this.detach(i);
    this.scene.remove(this.mesh, this.handle, this.jet);
    this.mesh.geometry.dispose();
  }

  setColor(pressureColors) {
    const on = this.pressure > 0.15;
    this.mat.color.copy(pressureColors && on ? RED : BLUE);
    this.mat.emissive.set(on ? (pressureColors ? 0x330000 : 0x061a3a) : 0x000000);
  }

  // ട്യൂബിന്റെ വക്രരേഖ
  _points(t) {
    const pts = [];
    const [e0, e1] = this.ends;
    if (e0.port && e1.port) {
      const a = e0.port.tip(new THREE.Vector3()), b = e1.port.tip(new THREE.Vector3());
      const na = e0.port.worldNormal(new THREE.Vector3()), nb = e1.port.worldNormal(new THREE.Vector3());
      const d = a.distanceTo(b);
      const L = THREE.MathUtils.clamp(d * 0.28, 2.5, 10);
      const ca = a.clone().addScaledVector(na, L), cb = b.clone().addScaledVector(nb, L);
      // A port can give lead points that the tube follows first (e.g. around the compressor)
      const la = e0.port.lead.length ? e0.port.leadWorld() : [ca];
      const lb = e1.port.lead.length ? e1.port.leadWorld() : [cb];
      const A = la[la.length - 1], B = lb[lb.length - 1];
      const mid = A.clone().add(B).multiplyScalar(0.5);
      mid.y -= Math.min(A.distanceTo(B) * 0.18, 12);
      mid.z += Math.min(d * 0.08, 6); // ബോർഡിൽ നിന്ന് അൽപം മുന്നോട്ട്
      mid.y = Math.max(mid.y, 1.2);
      pts.push(a, a.clone().addScaledVector(na, L * 0.35), ...la, mid, ...lb.reverse(), b.clone().addScaledVector(nb, L * 0.35), b);
      return pts;
    }
    const port = this.attachedPort;
    if (!port) return null;
    const a = port.tip(new THREE.Vector3());
    const na = port.worldNormal(new THREE.Vector3());
    const ca = a.clone().addScaledVector(na, 4);

    // അയഞ്ഞ അറ്റം എവിടെ വേണം
    let target;
    if (this.dragTarget) {
      target = this.dragTarget.clone();
    } else if (this.whip > 0.15) {
      const A = 3 + this.whip * 2.4;
      const ph = this.phase;
      target = a.clone().addScaledVector(na, 9).add(tmpM.set(
        Math.sin(t * 19 + ph) * A + Math.sin(t * 7.3 + ph) * A * 0.4,
        Math.sin(t * 27 + ph * 2) * A * 0.7 + 3,
        Math.cos(t * 15 + ph) * A * 0.6 + 2
      ));
    } else {
      // തൂങ്ങിക്കിടക്കുന്നു
      target = a.clone().addScaledVector(na, 7);
      target.y -= 14;
      target.z += 5;
    }
    target.y = Math.max(target.y, 0.6);
    const k = this.dragTarget ? 1 : this.whip > 0.15 ? 0.55 : 0.12;
    this.freePos.lerp(target, k);
    const f = this.freePos;
    const mid = ca.clone().add(f).multiplyScalar(0.5);
    if (!this.dragTarget && this.whip <= 0.15) mid.y -= 2;
    pts.push(a, ca, mid, f.clone());
    return pts;
  }

  update(t) {
    const moving = this.connectedCount === 1;
    if (!this.dirty && !moving) return;
    const pts = this._points(t);
    if (!pts) return;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const seg = Math.min(120, Math.max(24, Math.round(len * 1.2)));
    const geo = new THREE.TubeGeometry(curve, seg, this.r, 10, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.dirty = false;

    // അയഞ്ഞ അറ്റം
    const fi = this.freeIndex;
    this.handle.visible = fi >= 0 && !this.dragTarget;
    if (fi >= 0) {
      this.handle.position.copy(this.freePos);
      const tan = curve.getTangent(1, tmpN);
      this.jet.visible = this.whip > 0.15;
      if (this.jet.visible) {
        this.jet.position.copy(this.freePos);
        this.jet.quaternion.setFromUnitVectors(tmpA.set(0, 1, 0), tan);
        const s = 0.7 + Math.random() * 0.6;
        this.jet.scale.set(s, 0.6 + this.whip * 0.25 * s, s);
      }
    } else {
      this.jet.visible = false;
    }
  }
}
