// Panel, toast, alarm and tooltip helpers
import { info } from './i18n.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.panel = $('panel');
    this.toastEl = $('toast');
    this.tooltip = $('tooltip');
    this.alarm = $('alarm');
    this.warn = $('warn');
    this.hint = $('hint');
    this.current = null;
    $('panelClose').onclick = () => this.close();
  }

  toast(msg, err = false) {
    const t = this.toastEl;
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => (t.className = ''), 2600);
  }

  setHint(text, active = false) {
    this.hint.textContent = text;
    this.hint.classList.toggle('active', active);
  }

  showTooltip(text, x, y, above = false) {
    if (!text) { this.tooltip.classList.add('hidden'); return; }
    this.tooltip.textContent = text;
    this.tooltip.classList.remove('hidden');
    if (above) {
      const w = this.tooltip.offsetWidth;
      this.tooltip.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x - w / 2)) + 'px';
      this.tooltip.style.top = Math.max(50, y - 80) + 'px';
      this.tooltip.classList.add('big');
    } else {
      this.tooltip.style.left = x + 14 + 'px';
      this.tooltip.style.top = y + 12 + 'px';
      this.tooltip.classList.remove('big');
    }
  }

  close() {
    this.panel.classList.add('hidden');
    this.current = null;
    document.querySelectorAll('#legendList li').forEach((li) => li.classList.remove('on'));
  }

  // key: INFO-ലെ കീ അല്ലെങ്കിൽ {title, sub, text}
  open(key, controls) {
    const inf = typeof key === 'string' ? info(key) : key;
    $('pTitle').textContent = inf.title;
    $('pSub').textContent = inf.sub || '';
    $('pText').textContent = inf.text || '';
    const box = $('pControls');
    box.innerHTML = '';
    (controls || []).forEach((c) => box.appendChild(c));
    this.panel.classList.remove('hidden');
    this.current = key;
  }

  btn(text, onClick, cls = '') {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }

  slider(labelText, min, max, step, value, onInput, unit = '') {
    const wrap = document.createElement('div');
    const l = document.createElement('label');
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = ` ${value.toFixed(1)} ${unit}`;
    l.textContent = labelText;
    l.appendChild(v);
    const r = document.createElement('input');
    r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = value;
    r.oninput = () => { v.textContent = ` ${(+r.value).toFixed(1)} ${unit}`; onInput(+r.value); };
    wrap.append(l, r);
    return wrap;
  }

  setAlarm(html) {
    if (html) { this.alarm.innerHTML = html; this.alarm.classList.remove('hidden'); }
    else this.alarm.classList.add('hidden');
  }

  setWarn(html) {
    if (html) { this.warn.innerHTML = html; this.warn.classList.remove('hidden'); }
    else this.warn.classList.add('hidden');
  }
}
