// പൊതുവായ മെറ്റീരിയലുകളും ചെറിയ സഹായ ഫംഗ്ഷനുകളും
import * as THREE from 'three';

export const M = {
  alu: new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.8, roughness: 0.32 }),
  aluDark: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.75, roughness: 0.4 }),
  board: new THREE.MeshStandardMaterial({ color: 0xb8bec5, metalness: 0.6, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1c1f23, metalness: 0.1, roughness: 0.55 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.0, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc39a4a, metalness: 0.9, roughness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xdde2e7, metalness: 0.95, roughness: 0.16 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x1f63c6, metalness: 0.1, roughness: 0.45 }),
  bluePlate: new THREE.MeshStandardMaterial({ color: 0x2b8ad8, metalness: 0.2, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.1, roughness: 0.4 }),
  tank: new THREE.MeshStandardMaterial({ color: 0xeef0f2, metalness: 0.35, roughness: 0.35 }),
  motor: new THREE.MeshStandardMaterial({ color: 0x3b4450, metalness: 0.5, roughness: 0.45 }),
  clear: new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.35 }),
  oil: new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.1, roughness: 0.2, transparent: true, opacity: 0.85 }),
  table: new THREE.MeshStandardMaterial({ color: 0xd9cbb8, metalness: 0.0, roughness: 0.85 }),
  slot: new THREE.MeshStandardMaterial({ color: 0x6d757d, metalness: 0.6, roughness: 0.5 }),
};

// മെഷ് ഉണ്ടാക്കി ഷാഡോ സെറ്റ് ചെയ്യുന്നു
export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);

// Y അക്ഷത്തിലുള്ള സിലിണ്ടർ
export const cyl = (r, h, mat, x, y, z, seg = 32) =>
  mesh(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z);

// X അക്ഷത്തിലുള്ള സിലിണ്ടർ
export function cylX(r, h, mat, x, y, z, seg = 32) {
  const m = cyl(r, h, mat, x, y, z, seg);
  m.rotation.z = Math.PI / 2;
  return m;
}

// Z അക്ഷത്തിലുള്ള സിലിണ്ടർ
export function cylZ(r, h, mat, x, y, z, seg = 32) {
  const m = cyl(r, h, mat, x, y, z, seg);
  m.rotation.x = Math.PI / 2;
  return m;
}

// ഉരുണ്ട അരികുള്ള ബോക്സ്
export function roundBox(w, h, d, r, mat, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  const hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw, -h / 2);
  s.lineTo(hw, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -hh);
  s.lineTo(w / 2, hh);
  s.quadraticCurveTo(w / 2, h / 2, hw, h / 2);
  s.lineTo(-hw, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, hh);
  s.lineTo(-w / 2, -hh);
  s.quadraticCurveTo(-w / 2, -h / 2, -hw, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * Math.min(r, d / 4), bevelEnabled: true, bevelSize: Math.min(r, d / 4) * 0.6, bevelThickness: Math.min(r, d / 4), bevelSegments: 3 });
  geo.center();
  return mesh(geo, mat, x, y, z);
}

// ഒരു ഒബ്ജക്റ്റിനെ ക്ലിക്ക് ചെയ്യാവുന്നതാക്കുന്നു
export function pickable(obj, data) {
  obj.userData.pick = data;
  return obj;
}
