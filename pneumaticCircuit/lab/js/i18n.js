// Text shown in the lab (English only)
import { CUT_IN, CUT_OUT } from './sim.js';

const S = {
  en: {
    pageTitle: 'Pneumatics Lab 3D',
    tHome: 'Overview',
    knobUp: 'Knob pulled up (unlocked) — drag left/right on it to set the pressure. Tap again to lock.',
    knobDown: 'Knob pushed down (locked)',
    ttRegDown: 'Regulator knob – tap to pull it up',
    ttRegUp: 'Drag left/right to turn · tap to lock',
    ttDrain: 'Filter drain – press and hold',
    drainNoAir: 'No air pressure in the filter — the water only drips out',
    drainDry: 'No water collected yet — only air sprays out.',
    drainEmpty: 'The bowl is dry and there is no air pressure',
    setBubble: 'Set {s} bar · Out {o} bar',
    appTitle: 'Pneumatics Lab',
    appSub: 'Interactive 3D trainer',
    partsBtn: 'Parts',
    tUndo: 'Undo (Ctrl+Z)', tRedo: 'Redo (Ctrl+Y)',
    pwrOn: '⏻ Power ON', pwrOff: '⏻ Power OFF',
    toastMainsOn: 'Mains switch ON', toastMainsOff: 'Mains switch OFF',
    ttMains: 'Mains switch (compressor socket)',
    tColors: 'Pressure colours',
    tSound: 'Sound',
    tReset: 'Start again',
    tHelp: 'Help',
    chipTank: 'Tank', chipMotor: 'Motor', chipReg: 'FR Out', chipCyl: 'Cylinder',
    hintIdle: 'Pick a tube, then tap the ports to connect it',
    hintFirst: '{size} mm tube: tap the first port',
    hintSecond: 'Now tap the second port (tap anywhere else to drop the loose end)',
    hintPickup: 'Tap the port where this tube end should go',
    tube10: '10 mm tube', tube4: '4 mm tube', cancel: '✕ Cancel',
    plugBtn: 'Plug',
    hintPlug: 'Plug: tap a 4 mm port to close it (tap a plugged port to take the plug out)',
    tapPortPlug: 'Tap a 4 mm port to fit the plug',
    errPlugged: 'This port is closed with a plug',
    errPlugSize: 'The plug fits only 4 mm ports',
    errPlugSelf: 'This port seals itself — no plug needed',
    plugIn: 'Plug fitted: {name}',
    plugOut: 'Plug taken out: {name}',
    plugTitle: 'Plug',
    plugRemove: 'Take out the plug',
    tCylType: 'Cylinder type',
    segSingle: 'Single acting', segDouble: 'Double acting',
    cylSingleName: 'Single acting cylinder', cylDoubleName: 'Double acting cylinder',
    toastSingle: 'Single acting cylinder fitted',
    toastDouble: 'Double acting cylinder fitted',
    errOccupied: 'This port already has a tube',
    errSize: 'This tube does not fit this port',
    errSame: 'Both ends of a tube cannot go into the same port',
    errBlowing: 'Air is blowing out of this port — the tube cannot be pushed in',
    errWhip: 'The tube is whipping around under pressure — it cannot be held',
    connected: 'Connected: {a} → {b}',
    dropped: 'One end of the tube is loose — tap it to pick it up again',
    tapPort: 'Tap a port (push-in fitting)',
    compOn: '⏻ Switch compressor OFF', compOff: '⏻ Switch compressor ON',
    regLabel: 'Regulator setting:',
    svClose: '⇠ Close sliding valve', svOpen: '⇢ Open sliding valve',
    leverToggle: '⇄ Lever',
    tubeTitle: '{size} mm tube',
    endFree: 'Loose (not connected)',
    endLine: 'End {n}: {name}',
    endRemove: 'Pull out end {n}',
    pickLoose: 'Pick up loose end',
    removeTube: 'Remove tube',
    toastCompOn: 'Compressor ON — pressure switch active',
    toastCompOff: 'Compressor OFF',
    toastSvOpen: 'Sliding valve open — air flows to the manifold',
    toastSvClose: 'Sliding valve closed — manifold exhausted',
    ttHasTube: ' · tube fitted',
    ttPower: 'ON/OFF switch',
    ttSlide: 'Sliding valve – tap to open/close',
    ttLever: '5/2 lever – tap to change over',
    ttReg: 'Regulator knob',
    ttTube: '{size} mm tube',
    ttFree: 'Loose tube end – tap to pick up',
    toastColorsOn: 'Pressurised tubes are shown in red',
    toastColorsOff: 'Normal colours',
    toastLandscape: 'Turn your phone sideways (landscape) for a better view',
    mRun: 'Running', mStandby: 'Standby', mOff: 'OFF',
    cMoving: 'Moving', cExt: 'Extended', cRet: 'Retracted', cMid: 'Mid-way',
    alarmTitle: '⚠ DANGER!',
    alarmCompOn: 'The compressor is ON. ',
    alarmStill: 'The line is still under pressure. ',
    alarmBody: 'A tube is whipping around under air pressure ({p} bar). Something is wrong.',
    wrongAir: '💨 Air is escaping — something is wrong.',
    lowPressure: '⚠ Low pressure',
    helpTitle: 'How to use',
    help1: 'Choose <b>Single acting</b> or <b>Double acting</b> at the top. Pick a <b>10 mm</b> or <b>4 mm</b> tube at the bottom (the <b>Plug</b> closes an unused 4 mm port).',
    help2: 'Tap the first port, then the second port.',
    help3: 'Switch the power ON at the <b>mains switch</b> (or the ⏻ button at the top).',
    help4: 'Open the <b>sliding valve</b> and move the <b>5/2 lever</b> to operate the cylinder.',
    help5: 'Tap any part to see its name.',
    helpSmall: 'Drag to rotate · pinch/scroll to zoom',
    helpOk: 'Start',
    names: { compressor: 'Compressor', fr: 'FRL (Filter, Regulator, Lubricator)', slide: 'Sliding valve', manifold: 'Manifold', valve: '5/2 Lever valve', cylinder: 'Double acting cylinder' },
  },
};

export const INFO = {
  en: {
    compressor: {
      title: 'Silent Air Compressor',
      sub: 'Air receiver · Tank + Motor + Pressure switch',
      text: `Draws in atmospheric air, compresses it and stores it in the tank. Pressure switch: the motor stops when the tank reaches ${CUT_OUT} bar (cut-out) and starts again when the pressure drops to ${CUT_IN} bar (cut-in).`,
    },
    fr: {
      title: 'Filter + Regulator',
      sub: 'The F and R of the FRL unit · with gauge',
      text: 'Filter: removes dust and water from the air and collects them in the bowl (drain at the bottom). Regulator: tap the knob to pull it up, then drag it left/right to set the outlet pressure; the gauge shows the set pressure. Press and hold the drain knob at the bottom to blow out the collected water.',
    },
    lub: {
      title: 'Lubricator',
      sub: 'The L of the FRL unit',
      text: 'Adds a fine oil mist to the air while it flows, so that the valve and cylinder run smoothly with less wear. You can see the drops falling in the sight dome on top.',
    },
    slide: {
      title: 'Sliding valve (3/2 hand slide valve)',
      sub: 'Built as one unit with the manifold',
      text: 'Slide the blue sleeve towards the manifold to open it — air flows into the manifold. Slide it the other way to close it; the air in the manifold is then exhausted. Always close it before pulling out tubes.',
    },
    manifold: {
      title: 'Manifold',
      sub: '1 inlet · 7 outlets (3 on top, 3 underneath, 1 at the end)',
      text: 'Distributes air from one supply to several devices. Every outlet has a self-sealing push-in fitting — a ball inside lets air out only when a tube is pushed in. Pull the tube out and the port seals itself.',
    },
    valve: {
      title: '5/2 Hand lever valve',
      sub: '5 ports · 2 positions · detented (no spring)',
      text: 'Port 1 = supply, 2 & 4 = outputs to the cylinder, 3 & 5 = exhaust (with silencers). Lever one way: 1→2 open, 4 exhausts through 5. Lever the other way: 1→4 open, 2 exhausts through 3. The lever stays where you put it.',
    },
    silencer: {
      title: 'Silencer (Exhaust muffler)',
      sub: 'On ports 3 and 5 of the 5/2 valve',
      text: 'The exhaust air spreads out through thousands of tiny pores, so it slows down and makes much less noise.',
    },
    cylinderSingle: {
      title: 'Single acting cylinder',
      sub: 'Air on one side only · spring return',
      text: 'Air into the rear port (A) pushes the piston out (extend). When that air is let out, the spring inside pushes the piston back (retract). The front has only a small breather vent, no port.',
    },
    cylinder: {
      title: 'Double acting cylinder',
      sub: 'Air can be supplied to both sides',
      text: 'Air into the rear port (A) pushes the piston out (extend); air into the front port (B) pulls it back (retract). The air on the other side must escape through the valve. The brass cushion screw on the rear cap slows the piston near the end of its stroke.',
    },
  },
};

let lang = 'en';

export const getLang = () => lang;

export function t(key, p = {}) {
  const s = S[lang][key] ?? S.en[key] ?? key;
  return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, n) => (p[n] ?? '')) : s;
}

export const info = (key) => INFO[lang][key];

// Fill the page's fixed texts (elements marked with data-i18n / data-i18n-title / data-i18n-html)
export function applyStatic() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  document.querySelectorAll('[data-name]').forEach((el) => (el.textContent = S[lang].names[el.dataset.name]));
}
