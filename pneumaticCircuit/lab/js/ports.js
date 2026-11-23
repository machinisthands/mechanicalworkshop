// പോർട്ടുകൾ: push-in fitting, ക്ലിക്ക് ചെയ്യാനുള്ള ഭാഗം, ഹൈലൈറ്റ്
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { M, mesh, pickable } from './materials.js';

const UP = new THREE.Vector3(0, 1, 0);
const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

export function label(text, cls = 'lbl') {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  return new CSS2DObject(div);
}

export class Port {
  /**
   * @param {THREE.Object3D} parent  ഘടിപ്പിക്കേണ്ട ഗ്രൂപ്പ്
   * @param {object} o  id, name, size(10|4), pos[x,y,z], normal[x,y,z], selfSealing, comp, tag
   */
  constructor(parent, o) {
    this.id = o.id;
    this.name = o.name;
    this.size = o.size;
    this.comp = o.comp;
    this.selfSealing = !!o.selfSealing;
    this.tube = null;      // ഘടിപ്പിച്ച ട്യൂബ്
    this.tubeEnd = -1;
    this.normal = new THREE.Vector3(...o.normal).normalize();

    this.anchor = new THREE.Group();
    this.anchor.position.set(...o.pos);
    this.anchor.quaternion.setFromUnitVectors(UP, this.normal);
    parent.add(this.anchor);

    // push-in fitting (Y ദിശയിൽ ഉണ്ടാക്കി normal-ലേക്ക് തിരിക്കുന്നു)
    const big = this.size === 10;
    const hexR = big ? 1.05 : 0.62, hexH = big ? 0.8 : 0.5;
    const bodyR = big ? 0.82 : 0.46, bodyH = big ? 1.5 : 0.95;
    const colR = big ? 0.9 : 0.52, colH = big ? 0.45 : 0.32;
    const bodyMat = this.selfSealing ? M.brass : M.steel;
    const hex = mesh(new THREE.CylinderGeometry(hexR, hexR, hexH, 6), bodyMat, 0, hexH / 2, 0);
    const body = mesh(new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 24), bodyMat, 0, hexH + bodyH / 2, 0);
    // Blue release collet as a ring, with the open hole the tube goes into
    const holeR = big ? 0.55 : 0.27;
    const topY = hexH + bodyH + colH;
    const collet = mesh(new THREE.CylinderGeometry(colR, colR, colH, 28, 1, true), M.blue, 0, hexH + bodyH + colH / 2, 0);
    const colTop = mesh(new THREE.RingGeometry(holeR, colR, 28), M.blue, 0, topY, 0);
    colTop.rotation.x = -Math.PI / 2;
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9, side: THREE.DoubleSide });
    const holeWall = mesh(new THREE.CylinderGeometry(holeR, holeR, colH, 20, 1, true), holeMat, 0, topY - colH / 2, 0);
    const holeBottom = mesh(new THREE.CircleGeometry(holeR, 20), holeMat, 0, topY - colH + 0.02, 0);
    holeBottom.rotation.x = -Math.PI / 2;
    this.anchor.add(hex, body, collet, colTop, holeWall, holeBottom);
    this.tipLen = hexH + bodyH + colH;

    // ക്ലിക്ക് ചെയ്യാൻ എളുപ്പത്തിന് വലിയ അദൃശ്യ ഗോളം
    const pick = new THREE.Mesh(new THREE.SphereGeometry(big ? 2.2 : 1.7, 12, 10), pickMat);
    pick.position.y = this.tipLen * 0.7;
    pickable(pick, { kind: 'port', port: this });
    this.anchor.add(pick);
    this.pickMesh = pick;

    // ഹൈലൈറ്റ് വളയം
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.9, depthTest: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(big ? 1.6 : 1.1, big ? 0.22 : 0.16, 8, 32), ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = this.tipLen;
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    this.anchor.add(this.ring);

  }

  // ട്യൂബ് കയറുന്ന സ്ഥാനം (ലോകത്തിൽ)
  tip(target = new THREE.Vector3()) {
    return this.anchor.localToWorld(target.set(0, this.tipLen - 0.25, 0));
  }

  worldNormal(target = new THREE.Vector3()) {
    const q = new THREE.Quaternion();
    this.anchor.getWorldQuaternion(q);
    return target.copy(UP).applyQuaternion(q).normalize();
  }

  highlight(mode) {
    // mode: null | 'ok' | 'bad' | 'hover'
    this.ring.visible = !!mode;
    if (mode) this.ring.material.color.set(mode === 'bad' ? 0xef4444 : mode === 'hover' ? 0x3b82f6 : 0x22c55e);
  }

  get desc() {
    return `${this.name} · ${this.size} mm${this.selfSealing ? ' · self-sealing' : ''}`;
  }
}
