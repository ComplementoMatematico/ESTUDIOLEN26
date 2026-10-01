/* ============ Estudio Lenguaje · Sofía · motor de la presentación ============ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ---------- almacenamiento seguro ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('sofia_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sofia_' + k, JSON.stringify(v)); } catch (e) {} }
};
const settings = Object.assign({ voiceURI: null, rate: 0.95, pitch: 1, speakFeedback: true, autoRead: false, clickRead: false, steps: true, sound: true, allVoices: false }, store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);

/* ============ EFECTOS: sonido, confeti, toast ============ */
const FX = {
  ctx: null,
  tone(freq, start, dur, type = 'sine', vol = .18) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + start + .02);
    g.gain.exponentialRampToValueAtTime(.001, c.currentTime + start + dur);
    o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + .05);
  },
  sound(ok) {
    if (!settings.sound) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ok) { this.tone(784, 0, .15); this.tone(1047, .1, .25); this.tone(1319, .2, .3, 'sine', .12); }
      else { this.tone(220, 0, .18, 'triangle', .2); this.tone(165, .14, .28, 'triangle', .2); }
    } catch (e) {}
  },
  parts: [], raf: null,
  confetti(el, big) {
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    let x = innerWidth / 2, y = innerHeight / 2;
    if (el && el.getBoundingClientRect) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    const cols = ['#e5467e', '#7b5cd6', '#13a399', '#ffd84d', '#ff8fb6', '#2f7fd1'];
    const n = big ? 160 : 45;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (big ? 9 : 6) * (0.4 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (big ? 6 : 4), r: 4 + Math.random() * 5, c: pick(cols), rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1 });
    }
    if (!this.raf) this.loop(ctx, cv);
  },
  loop(ctx, cv) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    this.parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .28; p.vx *= .99; p.rot += p.vr; p.life -= .012;
      ctx.save(); ctx.globalAlpha = Math.max(p.life, 0); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); ctx.restore(); });
    this.parts = this.parts.filter(p => p.life > 0 && p.y < cv.height + 40);
    if (this.parts.length) this.raf = requestAnimationFrame(() => this.loop(ctx, cv));
    else { this.raf = null; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
};
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }

/* ============ LECTURA EN VOZ ALTA ============ */
const MONTHS = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORD = { 1: 'primero', 2: 'segundo', 3: 'tercero', 4: 'cuarto', 5: 'quinto', 6: 'sexto', 7: 'séptimo', 8: 'octavo' };
function cleanForSpeech(t) {
  return t
    .replace(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/g, (m, d, mo, y) => `${+d} de ${MONTHS[+mo] || mo} de ${y.length === 2 ? '20' + y : y}`)
    .replace(/N°\s?(\d+)/g, 'número $1').replace(/\s?°C/g, ' grados')
    .replace(/(\d)°\s?/g, (m, d) => (ORD[d] || d) + ' ')
    .replace(/\bObj:/g, 'Objetivo:').replace(/\bPág\./g, 'Página').replace(/\bAct\./g, 'Actividad')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/[★☆✦✧✳♡✓✔✕✗⬆⬇↺↗»«“”"]/g, '')
    .replace(/[→←·•—–]/g, ', ')
    .replace(/_{2,}/g, ' línea en blanco ')
    .replace(/\s*\n+\s*/g, '. ').replace(/\s{2,}/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
}
function textOf(el) {
  if (el.querySelector('.noread')) { const c = el.cloneNode(true); $$('.noread', c).forEach(n => n.remove()); return c.textContent; }
  return el.innerText;
}
const TTS = {
  ok: 'speechSynthesis' in window,
  voices: [], queue: [], cur: null, curEl: null,
  init() {
    if (!this.ok) return;
    const load = () => { this.voices = speechSynthesis.getVoices(); fillVoices(); };
    load(); speechSynthesis.onvoiceschanged = load; setTimeout(load, 700); setTimeout(load, 2000);
  },
  score(v) {
    let s = 0; const n = v.name.toLowerCase();
    if (v.lang.toLowerCase().startsWith('es')) s += 20;
    if (!v.localService) s += 4;
    if (n.includes('natural') || n.includes('online')) s += 5;
    if (/es[-_]cl/i.test(v.lang)) s += 4; else if (/es[-_](mx|us|419|ar|co)/i.test(v.lang)) s += 2;
    if (n.includes('google')) s += 1;
    return s;
  },
  best() { return this.voices.slice().sort((a, b) => this.score(b) - this.score(a))[0] || null; },
  voice() { return this.voices.find(v => v.voiceURI === settings.voiceURI) || this.best(); },
  chunks(text) {
    const parts = text.match(/[^.!?¡¿;:]+[.!?;:]*|[¡¿][^.!?]*[.!?]*/g) || [text];
    const out = []; let buf = '';
    parts.forEach(p => { p = p.trim(); if (!p) return; if ((buf + ' ' + p).length > 190 && buf) { out.push(buf); buf = p; } else buf = buf ? buf + ' ' + p : p; });
    if (buf) out.push(buf);
    return out;
  },
  play(items) {
    if (!this.ok) { toast('Tu navegador no permite lectura en voz alta 😢'); return; }
    this.stop();
    items.forEach(it => { const t = cleanForSpeech(it.text || ''); if (t) this.chunks(t).forEach(c => this.queue.push({ text: c, el: it.el })); });
    if (!this.queue.length) return;
    $('#btnRead').classList.add('reading');
    setTimeout(() => this.next(), 60);
  },
  say(text) { this.play([{ text }]); },
  next() {
    const it = this.queue.shift();
    if (!it) return this.finish();
    if (it.el !== this.curEl) { if (this.curEl) this.curEl.classList.remove('reading-now'); this.curEl = it.el || null;
      if (it.el) { revealUpTo(it.el); it.el.classList.add('reading-now'); it.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
    const u = new SpeechSynthesisUtterance(it.text), v = this.voice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-CL';
    u.rate = settings.rate; u.pitch = settings.pitch;
    u.onend = u.onerror = () => { if (this.cur === u) this.next(); };
    this.cur = u; speechSynthesis.speak(u);
  },
  finish() { this.cur = null; if (this.curEl) this.curEl.classList.remove('reading-now'); this.curEl = null; $('#btnRead').classList.remove('reading'); },
  stop() { this.queue = []; this.cur = null; if (this.ok) speechSynthesis.cancel(); this.finish(); }
};
function fillVoices() {
  const sel = $('#voiceSel'); if (!sel) return;
  let list = TTS.voices.filter(v => settings.allVoices || v.lang.toLowerCase().startsWith('es'));
  if (!list.length) list = TTS.voices;
  list = list.slice().sort((a, b) => TTS.score(b) - TTS.score(a));
  const curV = TTS.voice();
  sel.innerHTML = list.length ? '' : '<option>No hay voces disponibles todavía…</option>';
  list.forEach(v => { const o = h('option', null, `${v.localService ? '💻' : '🌐'} ${v.name} (${v.lang})`); o.value = v.voiceURI; if (curV && v.voiceURI === curV.voiceURI) o.selected = true; sel.append(o); });
}
function readSlide() {
  const s = slides[cur];
  let els = $$('.rd', s).filter(e => e.offsetParent !== null || e.closest('.frag'));
  els = els.filter(e => !els.some(o => o !== e && o.contains(e)));
  if (!els.length) return TTS.play([{ text: s.innerText }]);
  TTS.play(els.map(el => ({ text: textOf(el), el })));
}

/* ============ PRESENTACIÓN ============ */
const slides = $$('.slide');
let cur = 0, frag = 0;
const fragsOf = s => $$('.frag', s);
function applyFragAction(f, on) { if (f.dataset.action === 'ans') f.closest('.slide').classList.toggle('show-ans', on); }
function show(i, opts = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  const prevI = cur;
  slides.forEach((s, k) => { s.classList.toggle('active', k === i); s.classList.toggle('before', k < i); });
  const s = slides[i], fs = fragsOf(s);
  if (opts.fromBack || !settings.steps) {
    fs.forEach((f, k) => { f.style.transitionDelay = settings.steps ? '0s' : (k * 0.07) + 's'; f.classList.add('in'); applyFragAction(f, true); });
    frag = fs.length;
  } else {
    fs.forEach(f => { f.style.transitionDelay = '0s'; f.classList.remove('in'); });
    frag = 0;
  }
  s.scrollTop = 0;
  cur = i;
  if (prevI !== i || opts.force) { TTS.stop(); s.dispatchEvent(new CustomEvent('enter')); }
  try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
  updateUI();
  if (settings.autoRead && !opts.silent) setTimeout(() => { if (cur === i) readSlide(); }, 650);
}
function revealNext() {
  const fs = fragsOf(slides[cur]);
  if (frag < fs.length) { const f = fs[frag]; f.style.transitionDelay = '0s'; f.classList.add('in'); applyFragAction(f, true); frag++;
    const r = f.getBoundingClientRect(), st = $('#stage').getBoundingClientRect();
    if (r.bottom > st.bottom - 20) f.scrollIntoView({ block: 'center', behavior: 'smooth' });
    updateUI(); return true; }
  return false;
}
function revealUpTo(el) {
  const s = el.closest('.slide'); if (!s || s !== slides[cur]) return;
  const fs = fragsOf(s); const target = el.closest('.frag') || el;
  let idx = fs.indexOf(target);
  if (idx < 0) { idx = fs.findIndex(f => f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) - 1; if (idx < -1) idx = fs.length - 1; }
  while (frag <= idx && frag < fs.length) revealNext();
}
function next() { if (settings.steps && revealNext()) return; if (cur < slides.length - 1) show(cur + 1); }
function prev() {
  const fs = fragsOf(slides[cur]);
  if (settings.steps && frag > 0 && fs.length) { frag--; fs[frag].classList.remove('in'); applyFragAction(fs[frag], false); updateUI(); return; }
  if (cur > 0) show(cur - 1, { fromBack: true });
}
function showAllFrags() { while (revealNext()); }
function updateUI() {
  const s = slides[cur];
  $('#counter').textContent = `${cur + 1} / ${slides.length}`;
  $('#progress i').style.width = ((cur + 1) / slides.length * 100) + '%';
  $('#slideTitle').textContent = s.dataset.title || '';
  const chip = $('#secChip'); chip.textContent = s.dataset.section || ''; chip.dataset.s = s.dataset.section || '';
  $('#prev').disabled = cur === 0 && frag === 0; $('#next').disabled = cur === slides.length - 1 && frag >= fragsOf(s).length;
  const fs = fragsOf(s), ind = $('#stepInd');
  if (settings.steps && fs.length && frag < fs.length) { ind.classList.add('show'); $('#stepTxt').textContent = `Paso ${frag} de ${fs.length} · ▶ avanza`; }
  else ind.classList.remove('show');
  $$('#tocBody a').forEach((a, k) => a.classList.toggle('on', k === cur));
}
function slideIndexOf(ref) {
  const el = document.getElementById(ref); if (el) return slides.indexOf(el.closest('.slide'));
  return slides.findIndex(s => (s.dataset.title || '').includes(ref));
}
function goto(ref) { const i = typeof ref === 'number' ? ref : slideIndexOf(ref); if (i >= 0) { closePanels(); show(i); } }

/* ============ PANELES ============ */
function closePanels() { $$('.side.show').forEach(p => p.classList.remove('show')); $$('.overlay.show').forEach(o => { o.classList.remove('show'); if (o.id === 'pdfModal') $('#pdfHost').innerHTML = ''; }); }
function togglePanel(id) { const p = $('#' + id), open = p.classList.contains('show'); closePanels(); if (!open) p.classList.add('show'); }
function buildToc() {
  const body = $('#tocBody'); let sec = '';
  slides.forEach((s, k) => {
    if (s.dataset.section !== sec) { sec = s.dataset.section; body.append(h('div', 'toc-sec', { Cuaderno: '📓 ', Sugerencias: '💡 ', Actividades: '🎮 ', 'Control de lectura': '📖 ' }[sec] + sec)); }
    const a = h('a', null, `<span>${k + 1}</span>${s.dataset.title}`); a.href = '#' + (k + 1);
    a.onclick = e => { e.preventDefault(); goto(k); }; body.append(a);
  });
}
function openPdf(n) {
  n = n || +(slides[cur].dataset.page || 1);
  closePanels(); $('#pdfModal').classList.add('show');
  $('#pdfHost').innerHTML = `<iframe src="LENGUAJE_SOFIA.pdf#page=${n}&view=FitH" title="PDF original, página ${n}"></iframe>`;
  $('#pdfOpen').href = 'LENGUAJE_SOFIA.pdf#page=' + n;
  $$('#pdfPages button').forEach(b => b.classList.toggle('on', +b.textContent === n));
}
function toggleFull() { const d = document; if (!d.fullscreenElement) (d.documentElement.requestFullscreen || d.documentElement.webkitRequestFullscreen || (() => {})).call(d.documentElement); else (d.exitFullscreen || d.webkitExitFullscreen).call(d); }
function blackout(white) { const b = $('#blackout'); if (b.classList.contains('show')) { b.classList.remove('show'); return; } b.classList.toggle('w', !!white); b.classList.add('show'); }

/* ============ PUNTAJE ============ */
const ACTS = { ho: 'Act. 1 · Hecho u opinión', afi: 'Act. 2 · Detective de afiches', arbol: 'Act. 3 · Árbol de palabras', rew: 'Act. 4 · Reescribe el aviso', inf: 'Act. 5 · Inferencias', pred: 'Act. 6 · Predicciones', voc: 'Act. 7 · Adivina la palabra', carta: 'Act. 8 · Carta formal', match: 'Act. 9 · Une conceptos', ctrl: '📖 Control de lectura', open: '✍️ Preguntas de desarrollo' };
const Score = {
  data: {}, totals: {},
  add(act, n) { this.totals[act] = (this.totals[act] || 0) + n; this.render(act); },
  mark(act, item, val) { const a = this.data[act] = this.data[act] || {}; if (!(item in a)) a[item] = val; this.render(act); },
  set(act, item, val) { (this.data[act] = this.data[act] || {})[item] = val; this.render(act); },
  got(act) { return Object.values(this.data[act] || {}).reduce((s, v) => s + (v === true ? 1 : typeof v === 'number' ? v : 0), 0); },
  render(act) { $$(`[data-score="${act}"]`).forEach(e => e.innerHTML = `⭐ <b>${this.got(act)}</b>/${this.totals[act] || 0}`); }
};
const OKM = ['¡Excelente!', '¡Muy bien!', '¡Correcto!', '¡Genial, Sofía!', '¡Perfecto!', '¡Así se hace!', '¡Bravo!'];
const BADM = ['¡Casi!', 'Mmm, no es esa.', '¡Inténtalo otra vez!', 'Todavía no.', 'Ups, revisa de nuevo.'];
function feedback(box, ok, msg, opt = {}) {
  box.className = 'fb show ' + (opt.info ? 'info' : ok ? 'ok' : 'bad');
  const head = opt.head || (ok ? pick(OKM) : pick(BADM));
  box.innerHTML = `<b>${opt.info ? '💡' : ok ? '✅' : '❌'} ${head}</b> ${msg || ''}`;
  if (!opt.info) FX.sound(ok);
  if (ok && !opt.noConfetti) FX.confetti(box, opt.big);
  if (settings.speakFeedback && !opt.silent) TTS.say(head + ' ' + box.textContent.replace(head, ''));
}

/* ============ COMPONENTES ============ */
// Opción múltiple: cada tarjeta independiente; 2 intentos, luego muestra la respuesta
function mcq(container, act, items, prefix = '') {
  items.forEach((it, idx) => {
    const id = prefix + idx, card = h('div', 'q-card');
    card.innerHTML = `${it.ctx ? `<div class="g-text rd" style="margin-bottom:10px">${it.ctx}</div>` : ''}<div class="q"><span class="qt rd">${it.q}</span><button class="spk" title="Escuchar pregunta">🔊</button></div><div class="opts"></div><div class="fb"></div>`;
    const opts = $('.opts', card), fb = $('.fb', card);
    const order = shuffle(it.o.map((t, k) => ({ t, k })));
    let tries = 0, done = false;
    order.forEach((o, j) => {
      const b = h('button', 'opt', `<span class="lt">${'abcd'[j]}</span><span>${o.t}</span>`);
      b.onclick = () => {
        if (done) return;
        if (o.k === it.a) {
          done = true; b.classList.add('right'); $$('.opt', opts).forEach(x => x.disabled = true); card.classList.add('done-ok');
          Score.mark(act, id, tries === 0); feedback(fb, true, it.why || '');
        } else {
          tries++; b.classList.add('wrong'); b.disabled = true; Score.mark(act, id, false);
          if (tries >= 2) { done = true; const r = $$('.opt', opts)[order.findIndex(x => x.k === it.a)]; r.classList.add('right'); $$('.opt', opts).forEach(x => x.disabled = true);
            feedback(fb, false, `La respuesta correcta es: <b>${it.o[it.a]}</b>. ${it.why || ''}`, { head: 'No era esa, pero aprendamos:' }); }
          else feedback(fb, false, '💡 Pista: ' + (it.hint || 'vuelve a leer con calma y busca la pista en el texto.'));
        }
      };
      opts.append(b);
    });
    $('.spk', card).onclick = () => TTS.play([{ text: (it.ctx ? h('div', null, it.ctx).textContent + '. ' : '') + h('div', null, it.q).textContent + '. ' + order.map((o, j) => `${'abcd'[j]}: ${h('div', null, o.t).textContent}`).join('. ') }]);
    container.append(card);
  });
  Score.add(act, items.length);
}

// Clasificador (tocar + tocar, o arrastrar)
function sorter(container, act, { buckets, items, hint, cols }) {
  container.innerHTML = `<div class="pool no-swipe"></div><div class="buckets no-swipe" style="grid-template-columns:repeat(${cols || buckets.length},minmax(0,1fr))"></div><div class="fb"></div>`;
  const pool = $('.pool', container), bw = $('.buckets', container), fb = $('.fb', container);
  let sel = null, left = items.length;
  const tries = {};
  const bEls = buckets.map(b => { const e = h('div', 'bucket ' + b.cls, `<h4>${b.label}</h4><div class="in"></div>`); e.dataset.k = b.k; bw.append(e); return e; });
  shuffle(items).forEach((it, idx) => {
    const c = h('div', 'chip', it.t); c.draggable = true; c.dataset.i = items.indexOf(it); pool.append(c);
    c.onclick = () => { if (c.classList.contains('placed')) return; $$('.chip.sel', container).forEach(x => x.classList.remove('sel')); sel = sel === c ? null : c; if (sel) c.classList.add('sel'); };
    c.ondragstart = e => { sel = c; e.dataTransfer.setData('text/plain', c.dataset.i); };
  });
  const attempt = (chip, bEl) => {
    if (!chip || chip.classList.contains('placed')) return;
    const it = items[+chip.dataset.i], id = chip.dataset.i;
    if (it.k === bEl.dataset.k) {
      chip.classList.remove('sel'); chip.classList.add('placed'); chip.draggable = false; $('.in', bEl).append(chip); sel = null; left--;
      Score.mark(act, id, !tries[id]);
      if (!left) feedback(fb, true, `¡Completaste toda la actividad! ${it.why ? '<br>Última: ' + it.why : ''}`, { head: '¡Actividad completa! 🎉', big: true });
      else feedback(fb, true, it.why || '');
    } else {
      tries[id] = (tries[id] || 0) + 1; Score.mark(act, id, false);
      chip.classList.remove('shake', 'sel'); sel = null; void chip.offsetWidth; chip.classList.add('shake');
      feedback(fb, false, `“${it.t}” no va en “${bEl.querySelector('h4').textContent}”. 💡 ${it.hint || hint || 'Piensa otra vez.'}`);
    }
  };
  bEls.forEach(b => {
    b.onclick = () => attempt(sel, b);
    b.ondragover = e => { e.preventDefault(); b.classList.add('over'); };
    b.ondragleave = () => b.classList.remove('over');
    b.ondrop = e => { e.preventDefault(); b.classList.remove('over'); const c = $(`.chip[data-i="${e.dataTransfer.getData('text/plain')}"]`, container); attempt(c, b); };
  });
  Score.add(act, items.length);
}

// Ordenar
function orderer(container, act, items) {
  const list = h('ol', 'order-list no-swipe'), fb = h('div', 'fb');
  const bar = h('div', 'reveal-bar', '<button class="btn pink">✅ Revisar orden</button><button class="btn">🔀 Desordenar</button><button class="btn">🔊 Leer en este orden</button>');
  let checked = false;
  const render = arr => { list.innerHTML = ''; arr.forEach(i => { const li = h('li', null, `<span class="num"></span><span class="txt">${items[i].t}</span><span class="tag noread" style="display:none">${items[i].lab}</span><span class="mv"><button title="Subir">▲</button><button title="Bajar">▼</button></span>`); li.dataset.i = i; li.draggable = true; list.append(li); }); renum(); };
  const renum = () => $$('li', list).forEach((li, k) => { $('.num', li).textContent = k + 1; li.classList.remove('ok', 'bad'); });
  list.addEventListener('click', e => {
    const b = e.target.closest('.mv button'); if (!b) return; const li = b.closest('li');
    if (b.textContent === '▲' && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
    if (b.textContent === '▼' && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    renum();
  });
  let drag = null;
  list.addEventListener('dragstart', e => { drag = e.target.closest('li'); drag.classList.add('dragging'); });
  list.addEventListener('dragend', () => { if (drag) drag.classList.remove('dragging'); drag = null; renum(); });
  list.addEventListener('dragover', e => { e.preventDefault(); const over = e.target.closest('li'); if (!drag || !over || over === drag) return; const r = over.getBoundingClientRect(); list.insertBefore(drag, e.clientY > r.top + r.height / 2 ? over.nextElementSibling : over); });
  const [bCheck, bShuf, bRead] = $$('button', bar);
  bCheck.onclick = () => {
    let good = 0;
    $$('li', list).forEach((li, k) => { const ok = +li.dataset.i === k; li.classList.add(ok ? 'ok' : 'bad'); $('.tag', li).style.display = ok ? '' : 'none'; if (ok) good++; if (!checked) Score.mark(act, 'p' + k, ok); });
    checked = true;
    if (good === items.length) feedback(fb, true, 'La carta quedó perfectamente ordenada: lugar y fecha → destinatario → saludo → problema → solicitud → despedida → firma.', { head: '¡Carta perfecta! ✉️', big: true });
    else feedback(fb, false, `Tienes ${good} de ${items.length} partes en su lugar (las verdes). 💡 Recuerda: una carta parte con el lugar y la fecha, y termina con la firma.`);
  };
  const mixed = () => { let a; do { a = shuffle(items.map((_, i) => i)); } while (a.filter((v, k) => v === k).length > 1); return a; };
  bShuf.onclick = () => { render(mixed()); fb.className = 'fb'; };
  bRead.onclick = () => TTS.play($$('li .txt', list).map(e => ({ text: e.textContent, el: e.closest('li') })));
  render(mixed());
  container.append(list, bar, fb);
  Score.add(act, items.length);
}

// Unir
function matcher(container, act, pairs) {
  container.innerHTML = '<div class="match no-swipe"><div class="colm L"></div><div class="colm R"></div></div><div class="fb"></div>';
  const L = $('.L', container), R = $('.R', container), fb = $('.fb', container);
  let selL = null, left = pairs.length; const tries = {};
  shuffle(pairs.map((p, i) => i)).forEach(i => { const b = h('button', 'mitem', '🔹 ' + pairs[i].a); b.dataset.i = i; L.append(b); b.onclick = () => { if (b.disabled) return; $$('.mitem.sel', L).forEach(x => x.classList.remove('sel')); selL = b; b.classList.add('sel'); }; });
  shuffle(pairs.map((p, i) => i)).forEach(i => { const b = h('button', 'mitem', pairs[i].b); b.dataset.i = i; R.append(b);
    b.onclick = () => {
      if (b.disabled) return;
      if (!selL) { toast('Primero toca un concepto de la izquierda 👈'); return; }
      const li = selL.dataset.i;
      if (li === b.dataset.i) { [selL, b].forEach(x => { x.classList.remove('sel'); x.classList.add('done'); x.disabled = true; }); Score.mark(act, li, !tries[li]); left--; selL = null;
        feedback(fb, true, `<b>${pairs[li].a}</b>: ${pairs[li].b}`, left ? {} : { head: '¡Uniste todos los conceptos! 🔗', big: true }); }
      else { tries[li] = 1; Score.mark(act, li, false); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); feedback(fb, false, `Esa no es la definición de <b>${pairs[li].a}</b>. 💡 ${pairs[li].hint || 'Lee la definición completa.'}`); }
    }; });
  Score.add(act, pairs.length);
}

/* ============ DATOS ============ */
const HO = [
  { t: 'Chile tiene 16 regiones.', k: 'h', why: 'Se puede comprobar en un mapa o en fuentes oficiales.' },
  { t: 'El invierno es la estación más linda del año.', k: 'o', why: '“Más linda” depende del gusto de cada persona.' },
  { t: 'El agua hierve a 100 °C a nivel del mar.', k: 'h', why: 'Es un dato científico que se puede medir.' },
  { t: 'Los gatos son mejores mascotas que los perros.', k: 'o', why: '“Mejores” es una valoración personal.' },
  { t: 'Gabriela Mistral ganó el Premio Nobel de Literatura en 1945.', k: 'h', why: 'Fecha y premio verificables en cualquier enciclopedia.' },
  { t: 'Creo que la prueba del lunes será fácil.', k: 'o', why: '“Creo” es la pista clásica de una opinión.' },
  { t: 'Chillán es la capital de la Región de Ñuble.', k: 'h', why: 'Se puede comprobar: es un dato geográfico.' },
  { t: 'La pizza con piña es deliciosa.', k: 'o', why: '“Deliciosa” depende del gusto: ¡a muchos no les gusta!' },
  { t: 'Las abejas producen miel.', k: 'h', why: 'Es un hecho de la naturaleza que se puede observar.' },
  { t: 'Ese afiche es demasiado aburrido.', k: 'o', why: '“Aburrido” expresa lo que siente quien lo dice.' },
  { t: 'En el estudio participaron 18 parejas perro-propietario.', k: 'h', why: 'Es una cifra comprobable (¡está en tu guía!).' },
  { t: 'Cuidar el mar es una excelente idea.', k: 'o', why: '“Excelente” es una valoración (¡también de tu guía!).' }
];
const AFICHES = [
  { name: '♻️ Afiche 1', bg: 'linear-gradient(160deg,#25b56a,#0f7a6e)', pic: '♻️🌍', slog: '¡Recicla hoy, respira mañana!', small: 'Punto limpio en la plaza · sábados de 10:00 a 14:00', logo: 'Municipalidad de Villa Esperanza',
    qs: [
      { q: '¿Quién es el emisor de este afiche?', o: ['La Municipalidad de Villa Esperanza', 'Una empresa de bebidas', 'Un supermercado', 'Los estudiantes del 6° B'], a: 0, why: 'Su nombre aparece como firma abajo a la derecha: esa es la pista del emisor.', hint: 'busca el logotipo o la firma en una esquina.' },
      { q: '¿Cuál es su intención?', o: ['Concientizar a las personas para que reciclen', 'Vender bolsas de basura', 'Entretener con un chiste', 'Informar el pronóstico del tiempo'], a: 0, why: 'Busca cambiar una conducta (reciclar) sin vender nada.' },
      { q: '¿Es publicidad o propaganda?', o: ['Propaganda', 'Publicidad'], a: 0, why: 'Difunde una idea o conducta y no vende un producto: es propaganda.', hint: '¿está vendiendo algo?' },
      { q: '¿Qué recurso usa el eslogan?', o: ['Un verbo en imperativo (“Recicla”) que da una orden', 'Una pregunta', 'Un personaje famoso', 'Un precio en oferta'], a: 0, why: '“Recicla” es imperativo; además contrasta “hoy” con “mañana”.' }
    ] },
  { name: '👟 Afiche 2', bg: 'linear-gradient(160deg,#ff7a3d,#e5467e)', pic: '🏃‍♂️👟⚡', slog: 'FlashPro: ¡corre como los grandes!', small: 'Para chicos ganadores · ¡Ahora con 30% de descuento!', logo: 'FlashPro®',
    qs: [
      { q: '¿Quién es el emisor?', o: ['La marca FlashPro', 'Un club deportivo', 'El Ministerio del Deporte', 'Una familia'], a: 0, why: 'El logotipo “FlashPro®” revela que es la propia marca.' },
      { q: '¿Cuál es su intención?', o: ['Vender zapatillas', 'Concientizar sobre el deporte', 'Invitar a una carrera', 'Enseñar a correr'], a: 0, why: 'El descuento del 30% muestra un fin comercial: vender.', hint: 'fíjate en el texto secundario.' },
      { q: '¿A qué público se dirige?', o: ['Niños y jóvenes que hacen deporte', 'Adultos mayores', 'Bebés', 'Profesores'], a: 0, why: 'La imagen de un corredor joven y las palabras “chicos ganadores” lo indican.' },
      { q: '¿Qué estereotipo transmite?', o: ['Que solo los chicos (hombres) son deportistas ganadores', 'Que las zapatillas son caras', 'Que correr es peligroso', 'Que el deporte es aburrido'], a: 0, why: 'Muestra solo a un niño y dice “chicos ganadores”, dejando fuera a las niñas.' }
    ] },
  { name: '🔬 Afiche 3', bg: 'linear-gradient(160deg,#5b7fe0,#7b5cd6)', pic: '🔬🧪🌋', slog: '¿Te atreves a descubrir?', small: 'Feria Científica · viernes 9 de octubre · gimnasio · ¡entrada liberada!', logo: '6° básico B',
    qs: [
      { q: '¿Quién es el emisor?', o: ['El curso 6° básico B', 'Un laboratorio', 'Una tienda de juguetes', 'La municipalidad'], a: 0, why: 'La firma “6° básico B” identifica al emisor.' },
      { q: '¿Cuál es su intención?', o: ['Informar e invitar a la feria', 'Vender microscopios', 'Prohibir los experimentos', 'Contar un cuento'], a: 0, why: 'Da fecha, lugar y dice “entrada liberada”: invita sin vender.' },
      { q: '¿Qué recurso usa el eslogan?', o: ['Una pregunta que desafía al lector', 'Una rima', 'Un dato numérico', 'Un famoso'], a: 0, why: 'Termina con “?”: las preguntas involucran al público, como dice tu cuaderno.' },
      { q: '¿Qué función cumple “viernes 9 de octubre · gimnasio”?', o: ['Es texto secundario: entrega detalles', 'Es el eslogan', 'Es la imagen central', 'Es el emisor'], a: 0, why: 'Tu cuaderno: “Texto secundario: detalles o fechas”.' }
    ] }
];
const ARBOL = { buckets: [{ k: 'f', label: '🍎 Frutas', cls: 'c1' }, { k: 'i', label: '🎻 Instrumentos', cls: 'c2' }, { k: 't', label: '🚌 Medios de transporte', cls: 'c3' }, { k: 'u', label: '✏️ Útiles escolares', cls: 'c4' }],
  items: [['manzana', 'f'], ['kiwi', 'f'], ['durazno', 'f'], ['guitarra', 'i'], ['flauta', 'i'], ['tambor', 'i'], ['bicicleta', 't'], ['avión', 't'], ['micro', 't'], ['cuaderno', 'u'], ['sacapuntas', 'u'], ['regla', 'u']].map(([t, k]) => ({ t, k })),
  hint: 'Pregúntate: “¿___ es un tipo de qué?”' };
const ARBOL2 = [
  { q: '“Lucas tiene un loro. El loro habla mucho.” ¿Con qué hiperónimo evitas repetir “loro”?', o: ['ave', 'perro', 'objeto', 'pez'], a: 0, why: '“El ave habla mucho”: ave es la palabra general que incluye a loro.' },
  { q: 'En “Compré rosas, claveles y margaritas”, ¿cuál es el hiperónimo de esas palabras?', o: ['flores', 'plantas de interior', 'colores', 'semillas'], a: 0, why: 'Rosas, claveles y margaritas son hipónimos de “flores”.' },
  { q: '¿Cuál es un hipónimo de “mueble”?', o: ['silla', 'madera', 'casa', 'martillo'], a: 0, why: 'Una silla es un tipo de mueble; la madera es un material.' },
  { q: '“Sofía estaba feliz con su nota.” ¿Qué sinónimo mantiene el sentido?', o: ['contenta', 'nerviosa', 'cansada', 'triste'], a: 0, why: 'Feliz = contenta. “Triste” sería un antónimo.' }
];
const REW = ['Señor apoderado:<br>',
  { w: 'Comunico', o: ['Informo', 'Oculto', 'Pregunto'], why: 'comunicar = informar, dar a conocer.' }, ' a usted que la prueba de unidad N°3 ',
  { w: 'deberá', o: ['tendrá que', 'podría', 'querrá'], why: '“deberá” expresa obligación, igual que “tendrá que”.' }, ' ser ',
  { w: 'cambiada', o: ['reprogramada', 'eliminada', 'repetida'], why: 'la prueba no se elimina: se cambia de fecha, o sea, se reprograma.' }, ' ',
  { w: 'debido a', o: ['a causa de', 'a pesar de', 'en vez de'], why: '“debido a” y “a causa de” explican el motivo.' }, ' las ',
  { w: 'actividades', o: ['celebraciones', 'tareas', 'vacaciones'], why: 'las actividades de un aniversario son celebraciones.' }, ' del aniversario de nuestro colegio. Esta se ',
  { w: 'realizará', o: ['llevará a cabo', 'suspenderá', 'olvidará'], why: 'realizar = llevar a cabo, hacer.' }, ' el día lunes 05 de octubre. Sin otro particular, se despide<br>Elizabeth Viscay.'];
const INF = [
  { ctx: 'Sofía llegó a la casa con el paraguas goteando y las zapatillas llenas de barro.', q: '¿Qué se puede inferir?', o: ['Estaba lloviendo', 'Hacía mucho calor', 'Venía de la playa', 'Se le rompió el paraguas'], a: 0, why: 'Pistas: paraguas goteando + barro. Lo que sé: eso pasa cuando llueve.', hint: 'mira el paraguas y las zapatillas.' },
  { ctx: 'El profesor miró el reloj, guardó sus cosas y la sala comenzó a vaciarse rápidamente.', q: '¿Qué ocurrió?', o: ['Terminó la clase', 'Empezó una prueba', 'Llegó un nuevo estudiante', 'Se cortó la luz'], a: 0, why: 'Mirar el reloj y que todos salgan indica el fin de la clase.' },
  { ctx: 'Martín abrió el refrigerador, suspiró y lo cerró sin sacar nada.', q: '¿Qué se puede inferir?', o: ['No encontró lo que quería comer', 'Estaba muy satisfecho', 'Quería limpiar el refrigerador', 'Estaba feliz'], a: 0, why: 'El suspiro y no sacar nada muestran decepción: no había lo que buscaba.', hint: '¿qué significa un suspiro en esa situación?' },
  { ctx: 'Al ver su prueba, Ana saltó de alegría y corrió a llamar a su mamá.', q: '¿Qué se puede inferir sobre la prueba?', o: ['Obtuvo una buena nota', 'Se le perdió la prueba', 'Sacó mala nota', 'No alcanzó a terminarla'], a: 0, why: 'Saltar de alegría y contarle a su mamá: ¡le fue muy bien!' },
  { ctx: 'El perro movía la cola y corría hacia la puerta cada vez que escuchaba un auto.', q: '¿Qué se puede inferir?', o: ['Esperaba a su dueño', 'Le tenía miedo a los autos', 'Quería dormir', 'Estaba enfermo'], a: 0, why: 'La cola moviéndose = alegría; correr a la puerta = espera a alguien querido.' },
  { ctx: 'Un afiche de helados muestra un sol radiante, una piscina y niños en traje de baño.', q: '¿En qué época del año se publicaría probablemente?', o: ['En verano', 'En invierno', 'En Fiestas Patrias', 'En marzo, al entrar a clases'], a: 0, why: 'Sol, piscina y traje de baño: pistas visuales del verano.' }
];
const PRED = [
  { ctx: 'Las nubes negras cubrieron el cielo y comenzó a soplar un viento frío. Camila miró su bicicleta y luego el largo camino hacia su casa…', q: '¿Qué es más probable que ocurra?', o: ['Lloverá y Camila buscará refugio o pedirá ayuda', 'Saldrá un sol radiante y se irá a la playa', 'La bicicleta volará', 'Camila se dormirá en el camino'], a: 0, why: 'Nubes negras + viento frío = lluvia. Camila duda por el camino largo.', hint: '¿qué anuncian las nubes negras?' },
  { ctx: 'Diego practicó cada tarde su discurso para la elección del centro de alumnos, frente al espejo y frente a su abuela.', q: '¿Qué pasará probablemente el día de la elección?', o: ['Dará su discurso con más seguridad', 'Olvidará todo porque nunca practicó', 'No irá al colegio', 'Su abuela dará el discurso'], a: 0, why: 'La pista “practicó cada tarde” permite predecir que lo hará con seguridad.' },
  { ctx: 'La señora Rosa plantó semillas de tomate, las regó cada día y dejó el macetero al sol.', q: '¿Qué ocurrirá después de unas semanas?', o: ['Crecerán plantas de tomate', 'Nacerán manzanas', 'Las semillas desaparecerán', 'El macetero se transformará en árbol'], a: 0, why: 'Semillas + agua + sol = plantas. Las otras no tienen pistas o son imposibles.' },
  { ctx: 'En la fábula, el zorro miró el queso que tenía el cuervo en el pico y le dijo con voz dulce: “¡Qué hermosa voz debes tener! ¿Me cantarías algo?”', q: '¿Qué hará probablemente el cuervo?', o: ['Abrirá el pico para cantar y se le caerá el queso', 'Le regalará la mitad del queso', 'Se irá volando con el queso', 'Llamará a otros cuervos'], a: 0, why: 'El zorro usa halagos (¡como la publicidad!) para que el cuervo abra el pico.' }
];
const VOCAB = [
  { w: 'persuadir', e: '🗣️', d: 'Convencer a alguien para que piense o haga algo.', ej: 'El afiche busca persuadir a los jóvenes.', s: 'convencer' },
  { w: 'concientizar', e: '🌱', d: 'Hacer que las personas se den cuenta de un problema.', ej: 'La campaña quiere concientizar sobre el reciclaje.', s: 'sensibilizar' },
  { w: 'estereotipo', e: '🏷️', d: 'Idea simplificada y fija sobre cómo es o debe actuar un grupo.', ej: '“Las niñas no juegan fútbol” es un estereotipo.', s: 'cliché' },
  { w: 'prejuicio', e: '⚖️', d: 'Opinión, generalmente negativa, formada antes de conocer.', ej: 'Un afiche engañoso puede generar prejuicios.', s: 'juicio previo' },
  { w: 'inclusión', e: '🤝', d: 'Que todas las personas participen y sean aceptadas.', ej: 'El afiche del 6°B promueve la inclusión.', s: 'integración' },
  { w: 'implícito', e: '🫥', d: 'Que no está dicho directamente, pero se entiende.', ej: 'La idea implícita del texto era otra.', s: 'tácito' },
  { w: 'explícito', e: '📢', d: 'Que está dicho de forma clara y directa.', ej: 'El dato estaba explícito en el párrafo 1.', s: 'expreso' },
  { w: 'inferir', e: '💡', d: 'Deducir algo a partir de pistas y de lo que ya sabes.', ej: 'Pude inferir que llovía.', s: 'deducir' },
  { w: 'predecir', e: '🔮', d: 'Anticipar lo que probablemente ocurrirá.', ej: 'Predije el final del cuento.', s: 'anticipar' },
  { w: 'evidencia', e: '🔍', d: 'Prueba o pista que apoya una idea.', ej: 'Mi predicción se basa en evidencias del texto.', s: 'prueba' },
  { w: 'objetivo', e: '📏', d: 'Que se basa en hechos y no en gustos personales.', ej: 'Un hecho es objetivo.', s: 'imparcial' },
  { w: 'subjetivo', e: '💭', d: 'Que depende de lo que piensa o siente una persona.', ej: 'Una opinión es subjetiva.', s: 'personal' },
  { w: 'emisor', e: '📤', d: 'Quien crea y envía un mensaje.', ej: 'El emisor del afiche es una empresa.', s: 'remitente' },
  { w: 'destinatario', e: '📥', d: 'Persona o grupo a quien va dirigido el mensaje.', ej: 'El destinatario de mi carta es la directora.', s: 'receptor' },
  { w: 'eslogan', e: '🎵', d: 'Frase breve, pegajosa y fácil de recordar.', ej: '“Agua de verdad, energía de calidad”.', s: 'lema' },
  { w: 'coherencia', e: '🧩', d: 'Cuando las ideas de un texto tienen sentido y se relacionan.', ej: 'Revisé la coherencia de mi carta.', s: 'lógica' },
  { w: 'solicitar', e: '✋', d: 'Pedir algo de manera formal.', ej: 'Quisiera solicitarle un cambio del data.', s: 'pedir' },
  { w: 'comprobable', e: '✅', d: 'Que se puede verificar con datos o pruebas.', ej: 'Un hecho es comprobable.', s: 'verificable' },
  { w: 'propuesta', e: '📝', d: 'Idea que se ofrece para mejorar algo.', ej: 'Mi carta incluye una propuesta de mejora.', s: 'sugerencia' },
  { w: 'registro formal', e: '👔', d: 'Forma cuidada de hablar o escribir en situaciones serias.', ej: 'En una carta a la directora uso registro formal.', s: 'lenguaje formal' }
];
const CARTA = [
  { t: 'Chillán, 8 de septiembre de 2026', lab: '📍 Lugar y fecha' },
  { t: 'Estimada directora Blanca Romero:', lab: '👤 Destinatario' },
  { t: 'Junto con saludarla, espero que se encuentre muy bien.', lab: '👋 Saludo' },
  { t: 'Le escribo porque el proyector (data) de la sala del 6° básico B no permite ver bien los contenidos.', lab: '⚠️ Problema' },
  { t: 'Por esta razón, le solicito que el equipo sea revisado o reemplazado, para que todos podamos aprender mejor.', lab: '💡 Solicitud y propuesta' },
  { t: 'Sin otro particular, se despide atentamente,', lab: '🤝 Despedida' },
  { t: 'Sofía Vidal, 6° básico B', lab: '✍️ Firma' }
];
const MATCH = [
  { a: 'Emisor', b: 'Quien crea y envía el mensaje.' },
  { a: 'Público objetivo', b: 'Personas a quienes va dirigido el mensaje.' },
  { a: 'Intención', b: 'Lo que el emisor busca lograr: vender, convencer, informar o concientizar.' },
  { a: 'Eslogan', b: 'Frase breve y pegajosa que se recuerda fácilmente.' },
  { a: 'Estereotipo', b: 'Idea simplificada sobre cómo es o debe actuar un grupo.' },
  { a: 'Logotipo', b: 'Símbolo gráfico que identifica a una marca.' },
  { a: 'Inferencia', b: 'Información implícita que deduces con pistas y lo que sabes.' },
  { a: 'Hiperónimo', b: 'Palabra general que incluye a otras más específicas.' }
];
const CONTROL = [
  { sk: 'Localizar información', q: '¿Dónde apareció el afiche de Turbo-Cola?', o: ['Junto al quiosco del colegio', 'En la sala del 6° B', 'En la biblioteca', 'En la cancha de fútbol'], a: 0, why: 'Párrafo 1: “apareció pegado junto al quiosco del colegio”.' },
  { sk: 'Localizar información', q: '¿Cuántos gramos de azúcar contiene una lata de Turbo-Cola?', o: ['25 gramos', '35 gramos', '45 gramos', '15 gramos'], a: 1, why: 'Párrafo 1, en la letra pequeña: “Contiene 35 gramos de azúcar por lata”.' },
  { sk: 'Emisor', q: '¿Quién es el emisor del afiche de Turbo-Cola?', o: ['La profesora Elena', 'El curso 6° B', 'Una empresa de bebidas', 'La Asociación Americana del Corazón'], a: 2, why: 'Párrafo 4: encontraron el logotipo de una empresa de bebidas.' },
  { sk: 'Inferir', q: '¿Por qué el dato del azúcar aparecía en letras pequeñitas, “casi escondido”?', o: ['Porque se acabó el espacio por accidente', 'Porque a la empresa no le conviene destacar ese dato', 'Porque es un dato sin importancia', 'Porque los niños no saben leer'], a: 1, why: '“Toda imagen y frase tiene una intención planeada”: si el azúcar se notara, quizás menos personas comprarían.' },
  { sk: 'Hecho y opinión', q: '¿Cuál de estas oraciones es un HECHO?', o: ['«Esa bebida debe ser la mejor del mundo»', '«Una lata contiene 35 gramos de azúcar»', '«El eslogan es engañoso»', '«Acabamos de ganar algo más importante que un partido»'], a: 1, why: 'Es un dato que se puede comprobar leyendo la etiqueta. Las demás expresan lo que alguien piensa.' },
  { sk: 'Hecho y opinión', q: 'En «Creo que acabamos de ganar algo más importante que un partido», ¿qué palabra muestra que es una opinión?', o: ['acabamos', 'partido', 'Creo', 'algo'], a: 2, why: '“Creo” indica que Martina expresa una idea personal.' },
  { sk: 'Estereotipos', q: '¿Qué estereotipo mostraba el afiche de Turbo-Cola?', o: ['Que el agua es aburrida', 'Que solo los hombres musculosos son deportistas y ganadores', 'Que los niños no deben hacer deporte', 'Que las latas plateadas son caras'], a: 1, why: 'Párrafo 3: “todas las personas del afiche son hombres musculosos”.' },
  { sk: 'Inferir', q: 'Al final del párrafo 3, Tomás “se quedó pensando”. ¿Qué se puede inferir?', o: ['Que estaba enojado con Martina', 'Que comenzó a dudar de lo que creía sobre la bebida', 'Que quería comprar dos latas', 'Que no entendió nada'], a: 1, why: 'Antes estaba seguro (“la mejor del mundo”); después de las preguntas de Martina, empieza a dudar.' },
  { sk: 'Vocabulario en contexto', q: 'En “dijo Tomás, ahora indignado”, ¿qué palabra puede reemplazar a “indignado”?', o: ['aburrido', 'molesto', 'alegre', 'dormido'], a: 1, why: 'Indignado = muy molesto por algo que parece injusto (sinónimo).' },
  { sk: 'Hiperónimos', q: 'En el texto aparecen “agua” y “Turbo-Cola”. ¿Cuál es un hiperónimo de ambas?', o: ['botellas', 'bebidas', 'deportes', 'colores'], a: 1, why: 'Agua y Turbo-Cola son tipos de bebidas (hipónimos de “bebidas”).' },
  { sk: 'Público objetivo', q: '¿Cómo descubrió el grupo de Martina el público objetivo del afiche?', o: ['Por los colores llamativos y la pelota de fútbol', 'Por el precio de la bebida', 'Porque lo dijo la directora', 'Por la letra pequeña'], a: 0, why: 'Párrafo 4: “porque los colores eran llamativos y aparecía una pelota de fútbol”.' },
  { sk: 'Recursos persuasivos', q: '¿Qué recurso usa el eslogan «Agua de verdad, energía de calidad»?', o: ['Una pregunta', 'Un personaje famoso', 'Una rima', 'Un dato científico'], a: 2, why: 'verdad / calidad riman. ¡Como dice tu cuaderno, la rima lo hace memorable!' },
  { sk: 'Intención', q: '¿Cuál era la intención del afiche que creó el 6° B?', o: ['Vender botellas de agua', 'Concientizar sobre hábitos saludables', 'Anunciar un partido', 'Entretener con un chiste'], a: 1, why: 'No venden nada: buscan que la comunidad prefiera el agua (propaganda).' },
  { sk: 'Predecir', q: '¿Qué es más probable que haga la niña de 3° básico después de correr a la sala de su hermano?', o: ['Romper el afiche', 'Comprar tres latas de Turbo-Cola', 'Contarle sobre el afiche e invitarlo a verlo', 'Olvidarse para siempre del afiche'], a: 2, why: 'Pistas: lo leyó dos veces en voz alta y corrió a buscar a su hermano: quiere compartirlo.' },
  { sk: 'Tipos de texto', q: '¿Qué texto escribió el curso para pedir el bebedero?', o: ['Un aviso para los apoderados', 'Una carta formal a la directora', 'Un poema', 'Un correo a Turbo-Cola'], a: 1, why: 'Párrafo 7: “redactaron una carta formal a la directora”.' }
];
const OPEN = [
  { q: '¿Por qué Martina dice que “ganaron algo más importante que un partido”? Fundamenta con el texto.', m: 'Porque su afiche logró que otras personas pensaran críticamente sobre la publicidad y prefirieran hábitos saludables. La pista es que varios estudiantes se detuvieron a mirarlo y una niña de 3° lo leyó dos veces y fue a contárselo a su hermano. “Ganaron” conciencia, no un partido.' },
  { q: 'Escribe un HECHO y una OPINIÓN sobre la Turbo-Cola.', m: 'Hecho: una lata de Turbo-Cola contiene 35 gramos de azúcar. Opinión: creo que su eslogan es engañoso porque una bebida no te hace ganar.' },
  { q: 'Reescribe sin repetir “afiche”: “El curso hizo un afiche. El afiche tenía una botella con alas.”', m: 'El curso hizo un afiche. El cartel (o: el anuncio) tenía una botella con alas.' },
  { q: 'Crea tu propio eslogan con rima o pregunta para promover el agua en el colegio.', m: 'Ejemplos: “¿Tienes sed de ganar? ¡Agua para empezar!” · “Más agua, más energía, ¡todo el día!”' }
];

/* ============ INICIALIZAR ACTIVIDADES ============ */
function initActivities() {
  sorter($('#act-ho'), 'ho', { buckets: [{ k: 'h', label: '📏 HECHO (comprobable)', cls: 'h' }, { k: 'o', label: '💭 OPINIÓN (personal)', cls: 'o' }], items: HO, hint: 'Pregúntate: ¿se puede comprobar con datos?' });

  // Afiches
  const ac = $('#act-afi'), tabs = h('div', 'afiches-tabs'), panes = [];
  AFICHES.forEach((af, k) => {
    const b = h('button', k ? '' : 'on', af.name); tabs.append(b);
    const pane = h('div', 'afi-wrap'); pane.style.display = k ? 'none' : '';
    pane.innerHTML = `<div class="afiche" style="background:${af.bg}"><div class="pic">${af.pic}</div><div class="slog rd">${af.slog}</div><div class="small rd">${af.small}</div><div class="logo">${af.logo}</div></div><div class="grid2 qs"></div>`;
    mcq($('.qs', pane), 'afi', af.qs, 'a' + k + '-');
    panes.push(pane);
    b.onclick = () => { $$('button', tabs).forEach(x => x.classList.remove('on')); b.classList.add('on'); panes.forEach((p, j) => p.style.display = j === k ? '' : 'none'); };
  });
  ac.append(tabs, ...panes);

  sorter($('#act-arbol'), 'arbol', ARBOL);
  mcq($('#act-arbol2'), 'arbol', ARBOL2, 'q');

  // Reescritura
  const rc = $('#act-rewrite'), box = h('div', 'rewrite'); const selects = [];
  REW.forEach(p => {
    if (typeof p === 'string') { box.insertAdjacentHTML('beforeend', p); return; }
    const sp = h('span', null, `<span class="orig-w noread">${p.w}</span>`), s = h('select');
    s.innerHTML = '<option value="">— elige —</option>' + shuffle(p.o.map((t, k) => ({ t, k }))).map(o => `<option value="${o.k}">${o.t}</option>`).join('');
    s.onchange = () => s.classList.remove('ok', 'bad');
    sp.append(s); box.append(sp); selects.push({ s, p });
  });
  const bar = h('div', 'reveal-bar', '<button class="btn pink">✅ Revisar</button><button class="btn">🔊 Escuchar mi versión</button><button class="btn">💡 Ver una solución</button>');
  const fb = h('div', 'fb'); let first = true;
  const [bc, br, bs] = $$('button', bar);
  bc.onclick = () => {
    let good = 0, empty = 0; const errs = [];
    selects.forEach(({ s, p }, k) => { if (s.value === '') { empty++; return; } const ok = s.value === '0'; s.classList.add(ok ? 'ok' : 'bad'); if (ok) good++; else errs.push(`“${p.w}” ≠ “${p.o[+s.value]}”`); if (first) Score.mark('rew', k, ok); });
    if (empty) { feedback(fb, false, `Te faltan ${empty} palabra(s) por elegir.`, { head: 'Aún no terminas' }); return; }
    first = false;
    if (good === selects.length) feedback(fb, true, 'Tu aviso mantiene el mismo sentido, pero con un vocabulario más preciso. ¡Eso es enriquecer la capacidad expresiva!', { head: '¡Aviso perfecto! ✍️', big: true });
    else feedback(fb, false, `Tienes ${good} de ${selects.length}. Revisa: ${errs.join('; ')}. 💡 Un sinónimo debe mantener el sentido de la oración.`);
  };
  br.onclick = () => { const c = box.cloneNode(true); $$('.orig-w', c).forEach(n => n.remove()); $$('select', c).forEach((s, k) => { const o = selects[k].s; s.replaceWith(o.value === '' ? selects[k].p.w : o.options[o.selectedIndex].text); }); TTS.play([{ text: c.textContent, el: box }]); };
  bs.onclick = () => feedback(fb, true, selects.map(({ p }) => `<br>• <b>${p.w}</b> → ${p.o[0]}: ${p.why}`).join(''), { info: true, head: 'Una buena solución:', noConfetti: true });
  rc.append(box, bar, fb);
  Score.add('rew', selects.length);

  mcq($('#act-inf'), 'inf', INF);
  mcq($('#act-pred'), 'pred', PRED);

  // Flashcards
  const known = new Set(store.get('known', []));
  const fcBox = $('#act-fc');
  const renderFc = list => {
    fcBox.innerHTML = '';
    list.forEach(v => {
      const c = h('div', 'fc' + (known.has(v.w) ? ' known' : ''));
      c.innerHTML = `<div class="fc-in"><div class="fc-face fc-front"><div class="e">${v.e}</div><div class="w">${v.w}</div><small>toca para ver</small></div><div class="fc-face fc-back"><div class="row"><b>${v.w}</b>: ${v.d}</div><div class="row">📝 <i>${v.ej}</i></div><div class="row">🔁 Sinónimo: <b>${v.s}</b></div><div class="fc-tools"><button style="background:var(--violets)">🔊</button><button style="background:var(--oks)">✓ Me la sé</button><button style="background:#f2f0f8">↺</button></div></div></div>`;
      c.onclick = e => { if (e.target.closest('button')) return; c.classList.toggle('flipped'); if (c.classList.contains('flipped') && settings.clickRead) TTS.say(`${v.w}. ${v.d}`); };
      const [s, k, r] = $$('.fc-tools button', c);
      s.onclick = () => TTS.say(`${v.w}. ${v.d} Por ejemplo: ${v.ej} Sinónimo: ${v.s}.`);
      k.onclick = () => { known.add(v.w); c.classList.add('known'); c.classList.remove('flipped'); store.set('known', [...known]); updKnown(); FX.sound(true); FX.confetti(c); };
      r.onclick = () => { known.delete(v.w); c.classList.remove('known', 'flipped'); store.set('known', [...known]); updKnown(); };
      fcBox.append(c);
    });
  };
  const updKnown = () => $('#knownChip').innerHTML = `✓ Me las sé: <b>${known.size}</b>/${VOCAB.length}`;
  renderFc(VOCAB); updKnown();
  $('#fcShuffle').onclick = () => renderFc(shuffle(VOCAB));
  $('#fcFlipAll').onclick = () => $$('.fc', fcBox).forEach(c => c.classList.toggle('flipped'));
  const vq = shuffle(VOCAB).slice(0, 8).map(v => { const others = shuffle(VOCAB.filter(x => x !== v)).slice(0, 3).map(x => x.w); return { q: `¿Qué palabra significa: “${v.d}”?`, o: [v.w, ...others], a: 0, why: `<b>${v.w}</b> ${v.e} — ${v.ej}` }; });
  const vg = h('div', 'grid2'); $('#act-voc').append(vg); mcq(vg, 'voc', vq);

  orderer($('#act-carta'), 'carta', CARTA);
  matcher($('#act-match'), 'match', MATCH);
  initControl();
  initOpen();
}

/* ============ CONTROL DE LECTURA ============ */
function initControl() {
  const box = $('#control'); let i = 0; const res = CONTROL.map(() => null);
  Score.add('ctrl', CONTROL.length);
  const render = () => {
    if (i >= CONTROL.length) return renderResult();
    const it = CONTROL[i];
    box.innerHTML = `<div class="quiz-top"><b>Pregunta ${i + 1} de ${CONTROL.length}</b><div class="qbar"><i style="width:${i / CONTROL.length * 100}%"></i></div><div class="dots">${res.map((r, k) => `<span class="${r === true ? 'ok' : r === false ? 'bad' : ''} ${k === i ? 'cur' : ''}"></span>`).join('')}</div><button class="btn sm" data-goread>📖 Ver texto</button></div>
      <div class="q-card qbig"><div class="qskill">🎯 ${it.sk}</div><div class="q"><span class="qt rd">${it.q}</span><button class="spk" title="Escuchar">🔊</button></div><div class="opts"></div><div class="fb"></div><div class="reveal-bar" style="justify-content:flex-end"><button class="btn violet" data-nx style="display:none">${i === CONTROL.length - 1 ? 'Ver resultados 🏁' : 'Siguiente pregunta ➜'}</button></div></div>`;
    const opts = $('.opts', box), fb = $('.fb', box), nx = $('[data-nx]', box);
    it.o.forEach((t, k) => {
      const b = h('button', 'opt', `<span class="lt">${'abcd'[k]}</span><span>${t}</span>`);
      b.onclick = () => {
        if (res[i] !== null) return;
        const ok = k === it.a; res[i] = ok; Score.set('ctrl', i, ok);
        $$('.opt', opts).forEach((x, j) => { x.disabled = true; if (j === it.a) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        feedback(fb, ok, it.why, ok ? {} : { head: `Incorrecto. La respuesta era la ${'abcd'[it.a]}).` });
        nx.style.display = ''; $$('.dots span', box)[i].className = ok ? 'ok cur' : 'bad cur';
        $('.qbar i', box).style.width = ((i + 1) / CONTROL.length * 100) + '%';
      };
      opts.append(b);
    });
    $('.spk', box).onclick = () => TTS.say(it.q + '. ' + it.o.map((t, k) => `${'abcd'[k]}: ${t}`).join('. '));
    nx.onclick = () => { i++; render(); };
    $('[data-goread]', box).onclick = () => goto('Control de lectura · Texto');
  };
  const renderResult = () => {
    const got = res.filter(r => r === true).length, n = CONTROL.length, nota = notaChile(got, n);
    const msg = nota >= 6 ? '¡Rendimiento sobresaliente! Estás lista para la prueba 🏆' : nota >= 5 ? '¡Muy buen trabajo! Repasa las preguntas que fallaste y quedarás impecable 💪' : nota >= 4 ? 'Vas bien, pero conviene repasar las sugerencias y repetir las actividades 📚' : 'No te preocupes: repasa el cuaderno y las sugerencias, y vuelve a intentarlo. ¡Se aprende practicando! 🌱';
    const wrong = CONTROL.map((c, k) => res[k] === false ? `<li><b>${c.sk}:</b> ${c.q}<br><span class="hint">✔ ${c.o[c.a]} — ${c.why}</span></li>` : '').join('');
    box.innerHTML = `<div class="grid2"><div class="card violetc result"><div class="qskill">Tu nota en el control</div><div class="nota">${nota.toFixed(1).replace('.', ',')}</div><p style="font-size:20px;font-weight:900">${got} de ${n} correctas</p><p>${msg}</p><div class="reveal-bar" style="justify-content:center"><button class="btn violet" data-retry>↺ Repetir control</button><button class="btn" data-nx2>Preguntas de desarrollo ➜</button></div><p class="hint">Escala de 1,0 a 7,0 con 60% de exigencia.</p></div>
      <div class="card"><h3>${wrong ? '🔎 Para repasar' : '🌟 ¡Sin errores!'}</h3>${wrong ? `<ul>${wrong}</ul>` : '<p>Respondiste todas correctamente. ¡Impresionante!</p>'}</div></div>`;
    FX.sound(nota >= 4); if (nota >= 5) FX.confetti(box, true);
    if (settings.speakFeedback) TTS.say(`Tu nota es ${nota.toFixed(1).replace('.', ',')}. ${got} de ${n} correctas. ${msg}`);
    $('[data-retry]', box).onclick = () => { i = 0; res.fill(null); Score.data.ctrl = {}; Score.render('ctrl'); render(); };
    $('[data-nx2]', box).onclick = () => next();
  };
  render();
}
function notaChile(p, max, ex = 0.6) { const c = ex * max; const n = p < c ? 1 + 3 * p / c : 4 + 3 * (p - c) / (max - c); return Math.round(n * 10) / 10; }

function initOpen() {
  const box = $('#open'); Score.add('open', OPEN.length);
  OPEN.forEach((o, k) => {
    const c = h('div', 'q-card');
    c.innerHTML = `<div class="q"><span class="qt rd">${k + 1}. ${o.q}</span><button class="spk">🔊</button></div><textarea class="open" placeholder="Escribe aquí tu respuesta…"></textarea><div class="reveal-bar"><button class="btn violet sm">👀 Ver respuesta modelo</button></div><div class="fb"></div><div class="self" style="display:none"><b>¿Cómo te fue?</b><div class="reveal-bar"><button class="btn sm" style="background:var(--oks)">✅ Lo logré</button><button class="btn sm" style="background:var(--yellows)">🟡 A medias</button><button class="btn sm" style="background:var(--bads)">🔁 Debo mejorar</button></div></div>`;
    const ta = $('textarea', c), fb = $('.fb', c), self = $('.self', c);
    ta.value = store.get('open' + k, ''); ta.oninput = () => store.set('open' + k, ta.value);
    $('.spk', c).onclick = () => TTS.say(o.q);
    $('.btn.violet', c).onclick = () => { if (ta.value.trim().length < 5) { feedback(fb, false, 'Primero escribe tu respuesta; después compárala. ¡Así aprendes más!', { head: 'Un momento ✋' }); return; } feedback(fb, true, o.m, { info: true, head: 'Respuesta modelo:' }); self.style.display = ''; };
    $$('.self button', c).forEach((b, j) => b.onclick = () => { const v = [1, .5, 0][j]; Score.set('open', k, v); $$('.self button', c).forEach(x => x.style.outline = ''); b.style.outline = '3px solid var(--violet)'; if (v === 1) { FX.sound(true); FX.confetti(b); } toast(['¡Excelente autoevaluación! 🌟', 'Bien: compara y completa lo que faltó ✍️', 'Lee la respuesta modelo y vuelve a intentarlo 💪'][j]); });
    box.append(c);
  });
}

/* ============ SUGERENCIAS INTERACTIVAS ============ */
function initTips() {
  // semáforo
  const TOP = [
    ['Predecir', 'pistas + conocimientos = predicción', 'Sugerencia · Predecir'],
    ['Emisor, intención y público objetivo', 'las preguntas del detective', 'Sugerencia · Publicidad'],
    ['Partes del afiche y recursos persuasivos', 'imagen, eslogan, texto secundario', 'Sugerencia · Recursos'],
    ['Estereotipos e impacto', 'mirar con espíritu crítico', 'Pág. 3'],
    ['Inferir información', 'lo implícito', 'Sugerencia · Inferir'],
    ['Carta formal', 'estructura y registro', 'Sugerencia · Carta'],
    ['Hecho y opinión', '¿se puede comprobar?', 'Sugerencia · Hecho'],
    ['Sinónimos, hipónimos e hiperónimos', 'reescritura precisa', 'Sugerencia · Sinónimos']
  ];
  const sem = store.get('sema', {}), sb = $('#semaforo');
  const upd = () => {
    const r = TOP.filter((t, k) => sem[k] === 'r').map(t => t[0]), y = TOP.filter((t, k) => sem[k] === 'y').map(t => t[0]), done = Object.keys(sem).length;
    const fb = $('#semaFb');
    if (!done) { fb.className = 'fb'; return; }
    fb.className = 'fb show info';
    fb.innerHTML = r.length ? `🔴 <b>Empieza por:</b> ${r.join(', ')}.${y.length ? `<br>🟡 <b>Luego refuerza:</b> ${y.join(', ')}.` : ''}` : y.length ? `🟡 <b>Refuerza:</b> ${y.join(', ')}. ¡Vas muy bien!` : '🟢 ¡Te sientes segura en todo! Comprueba con el control de lectura al final 💪';
  };
  TOP.forEach((t, k) => {
    const row = h('div', 'sema-row', `<div class="t">${t[0]}<small>${t[1]}</small></div><div class="lights"><button class="g" title="Lo domino">🟢</button><button class="y" title="Más o menos">🟡</button><button class="r" title="Necesito repasar">🔴</button></div><button class="goto">Repasar ➜</button>`);
    const ls = $$('.lights button', row);
    const paint = () => ls.forEach(b => b.classList.toggle('on', b.classList.contains(sem[k])));
    ls.forEach(b => b.onclick = () => { sem[k] = b.className.split(' ')[0]; store.set('sema', sem); paint(); upd(); });
    $('.goto', row).onclick = () => goto(t[2]);
    paint(); sb.append(row);
  });
  upd();

  // palabras clave
  ['creo', 'pienso', 'me parece', 'en mi opinión', 'opino que', 'siento que', 'mejor', 'peor', 'hermoso', 'maravilloso', 'interesante', 'aburrido', 'muy grave', 'excelente', 'debería', 'ojalá'].forEach(w => { const s = h('span', 'kw o', w); s.onclick = () => { s.classList.toggle('flip'); TTS.say(w); }; $('#kwO').append(s); });
  ['fechas (1945)', 'cifras (18 parejas)', 'lugares (Valdivia)', 'nombres propios', 'estudios científicos', 'medidas (35 gramos)', 'según la Universidad…', 'acontecimientos reales'].forEach(w => { const s = h('span', 'kw h', w); s.onclick = () => { s.classList.toggle('flip'); TTS.say(w); }; $('#kwH').append(s); });

  // carta
  const ORIG = `<p style="text-align:center" class="rd">Chillán, 08/09/2026</p><p class="rd">Estimada directora Blanca Romero Vitón:</p><p class="rd" style="text-indent:2em">Junto con saludarle, esperando que se sienta bien. Quisiera solicitarle un cambio del data del 6° básico B, porque cuando un profesor o profesora necesita proyectar contenido para los estudiantes, la proyección no logra verse bien.</p><p class="rd">Espero tenga una buena tarde.</p><p class="rd">Atentamente; Sofía Vidal, 6°B</p><div class="tip" style="font-family:Nunito;font-size:.75em">👍 Lo bueno: saludo formal, usa “usted”, explica el problema.<br>🔧 Para mejorar: agregar una <b>propuesta</b> y su beneficio, separar destinatario y saludo, coma en “Atentamente,” y firma con curso completo.</div>`;
  const BEST = `<p style="text-align:right" class="rd">Chillán, 8 de septiembre de 2026 <span class="tag noread">📍 lugar y fecha</span></p><p class="rd">Señora Blanca Romero Vitón<br>Directora<br>Presente <span class="tag noread">👤 destinatario</span></p><p class="rd">Estimada directora: <span class="tag noread">👋 saludo</span></p><p class="rd" style="text-indent:2em">Junto con saludarla y esperando que se encuentre muy bien, me dirijo a usted para solicitarle el cambio del proyector (data) de la sala del 6° básico B. <span class="tag noread">🎯 propósito</span></p><p class="rd" style="text-indent:2em">Actualmente, cuando un profesor o una profesora necesita proyectar contenido, la imagen no se ve con claridad, lo que dificulta que los estudiantes sigamos la clase. <span class="tag noread">⚠️ problema</span></p><p class="rd" style="text-indent:2em">Por esta razón, proponemos revisar o reemplazar el equipo. Estamos seguros de que esta mejora nos ayudará a aprender mejor. <span class="tag noread">💡 propuesta + razón</span></p><p class="rd">Agradeciendo de antemano su atención, se despide atentamente, <span class="tag noread">🤝 despedida</span></p><p class="rd">Sofía Vidal<br>Estudiante 6° básico B <span class="tag noread">✍️ firma</span></p>`;
  const lb = $('#letterBox');
  const setL = (html, b) => { lb.innerHTML = html; lb.style.animation = 'none'; void lb.offsetWidth; lb.style.animation = 'pop .4s'; $('#letterOrig').classList.toggle('pink', !b); $('#letterBest').classList.toggle('pink', b); };
  $('#letterOrig').onclick = () => setL(ORIG, false);
  $('#letterBest').onclick = () => setL(BEST, true);
  setL(BEST, true);

  // checklist
  const CK = ['Leo cada pregunta dos veces', 'Subrayo palabras clave: NO, EXCEPTO, PRINCIPAL, SEGÚN EL TEXTO', 'Leo TODAS las alternativas antes de elegir', 'Descarto las alternativas exageradas o sin pistas', 'Vuelvo al texto para buscar la evidencia', 'En inferencias, busco lo implícito (no lo copiado)', 'En hecho/opinión me pregunto: ¿se puede comprobar?', 'En respuestas abiertas: mayúscula, punto y “porque…”', 'Administro el tiempo: no me quedo pegada en una', 'Reviso todo antes de entregar, ¡sin dejar nada en blanco!'];
  const ck = store.get('ck', {});
  CK.forEach((t, k) => { const l = h('label', null, `<input type="checkbox" ${ck[k] ? 'checked' : ''}> <span class="rd">${t}</span>`); $('input', l).onchange = e => { ck[k] = e.target.checked; store.set('ck', ck); if (e.target.checked) FX.sound(true); }; $('#checklist').append(l); });

  // menú de actividades
  [['⚖️', 'Hecho u opinión', 'Actividad 1'], ['🕵️‍♀️', 'Detective de afiches', 'Actividad 2'], ['🌳', 'Árbol de palabras', 'Actividad 3'], ['✍️', 'Reescribe el aviso', 'Actividad 4'], ['🔍', 'Inferencias', 'Actividad 5'], ['🔮', '¿Qué pasará?', 'Actividad 6'], ['🃏', 'Vocabulario', 'Actividad 7'], ['✉️', 'Arma la carta', 'Actividad 8'], ['🔗', 'Une conceptos', 'Actividad 9']].forEach(([e, t, ref], k) => {
    const c = h('button', 'card', `<span class="big-emoji">${e}</span><b>${k + 1}. ${t}</b>`); c.style.cssText = 'text-align:left;cursor:pointer;font-size:15px'; c.onclick = () => goto(ref); $('#actMenu').append(c);
  });
}

/* ============ CUENTA REGRESIVA Y RESUMEN ============ */
function countdown() {
  const ms = new Date(2026, 9, 5, 8, 0, 0) - new Date(), el = $('#countdown');
  if (ms <= 0) { el.innerHTML = '<div style="min-width:240px"><b>¡Hoy!</b><small>¡Mucho éxito, Sofía! 🍀</small></div>'; return; }
  $('[data-cd="d"]', el).textContent = Math.floor(ms / 864e5); $('[data-cd="h"]', el).textContent = Math.floor(ms / 36e5) % 24; $('[data-cd="m"]', el).textContent = Math.floor(ms / 6e4) % 60;
}
function renderSummary() {
  const sm = $('#summary'); sm.innerHTML = '<h3>📊 Tus actividades</h3>';
  let tg = 0, tt = 0;
  Object.entries(ACTS).forEach(([k, name]) => {
    const g = Score.got(k), t = Score.totals[k] || 0; if (k !== 'ctrl' && k !== 'open') { tg += g; tt += t; }
    const row = h('div', 'sum-row', `<b style="font-size:14px">${name}</b><div class="bar"><i></i></div><b>${Number.isInteger(g) ? g : g.toFixed(1)}/${t}</b>`); sm.append(row);
    requestAnimationFrame(() => setTimeout(() => $('i', row).style.width = (t ? g / t * 100 : 0) + '%', 80));
  });
  const ctrlDone = Object.keys(Score.data.ctrl || {}).length, cg = Score.got('ctrl'), n = CONTROL.length;
  const nota = ctrlDone ? notaChile(cg, n) : null, pct = tt ? Math.round(tg / tt * 100) : 0;
  const known = store.get('known', []).length;
  $('#finalCard').innerHTML = `<div class="qskill">Nota del control de lectura</div><div class="nota">${nota ? nota.toFixed(1).replace('.', ',') : '—'}</div><p style="font-weight:800">${ctrlDone ? `${cg} de ${n} correctas (${ctrlDone < n ? 'aún sin terminar' : 'completo'})` : 'Aún no respondes el control'}</p>
    <div class="grid2" style="margin:14px 0"><div class="card"><b style="font-size:28px;color:var(--teal)">${pct}%</b><br>aciertos en actividades al primer intento</div><div class="card"><b style="font-size:28px;color:var(--pink)">${known}/${VOCAB.length}</b><br>palabras nuevas que ya sabes</div></div>
    <p style="font-size:18px;font-weight:800">${pct >= 80 && (nota || 0) >= 6 ? '🏆 ¡Estás lista para brillar el lunes!' : '💪 Cada actividad te acerca al 7,0. ¡Sigue así, Sofía!'}</p>
    <p class="hint">“Distinguir hechos y opiniones nos ayuda a comprender mejor lo que leemos.”</p>`;
  if (nota && nota >= 6) FX.confetti($('#finalCard'), true);
}

/* ============ EVENTOS ============ */
function bind() {
  $('#next').onclick = next; $('#prev').onclick = prev;
  $('#showAll').onclick = showAllFrags;
  $('#progress').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); show(Math.floor((e.clientX - r.left) / r.width * slides.length)); };
  $('#btnToc').onclick = () => togglePanel('toc');
  $('#btnSettings').onclick = () => togglePanel('settings');
  $('#btnRead').onclick = () => { if (TTS.cur) TTS.stop(); else readSlide(); };
  $('#btnStop').onclick = () => TTS.stop();
  $('#btnPdf').onclick = () => openPdf();
  $('#btnFull').onclick = toggleFull;
  $$('[data-close]').forEach(b => b.onclick = () => { closePanels(); });
  $$('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) closePanels(); }));
  const pp = $('#pdfPages'); for (let n = 1; n <= 12; n++) { const b = h('button', null, n); b.onclick = () => openPdf(n); pp.append(b); }
  $('#zoomHost').onclick = () => $('#zoomHost').classList.toggle('z');

  document.addEventListener('click', e => {
    const t = e.target;
    const pdf = t.closest('[data-pdf]'); if (pdf) { openPdf(+pdf.dataset.pdf); return; }
    const z = t.closest('[data-zoom]'); if (z) { $('#zoomImg').src = z.dataset.zoom; $('#zoomHost').classList.remove('z'); closePanels(); $('#zoomModal').classList.add('show'); return; }
    const g = t.closest('[data-goto]'); if (g) { goto(g.dataset.goto); return; }
    if (t.closest('[data-next]')) { next(); return; }
    const ta = t.closest('[data-toggle-ans]');
    if (ta) { const s = ta.closest('.slide'); showAllFrags(); const on = s.classList.toggle('show-ans'); if (on) { FX.sound(true); FX.confetti(ta); toast('✨ Respuestas a la vista'); } return; }
    // cerrar paneles laterales al tocar fuera
    if (!t.closest('.side') && !t.closest('.tbtn')) $$('.side.show').forEach(p => p.classList.remove('show'));
    // tocar para escuchar
    if (settings.clickRead) { const rd = t.closest('.stage .rd'); if (rd && !t.closest('button,select,input,textarea,.chip,.opt,a,label')) TTS.play([{ text: textOf(rd), el: rd }]); }
  });

  document.addEventListener('keydown', e => {
    if (!$('#splash').classList.contains('hide')) { if (['Enter', ' ', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); start(); } return; }
    const tag = e.target.tagName, typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable;
    const bo = $('#blackout');
    if (bo.classList.contains('show')) { e.preventDefault(); bo.classList.remove('show'); return; }
    if (e.key === 'Escape') { closePanels(); return; }
    if (typing && !['PageDown', 'PageUp'].includes(e.key)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = slides[cur];
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case 'n': case 'N': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': case 'Backspace': case 'p': case 'P':
        if (e.key.toLowerCase() === 'p') { e.preventDefault(); openPdf(); break; }
        e.preventDefault(); prev(); break;
      case 'ArrowDown': e.preventDefault(); if (s.scrollTop + s.clientHeight < s.scrollHeight - 4 && !(settings.steps && frag < fragsOf(s).length)) s.scrollBy({ top: s.clientHeight * .6, behavior: 'smooth' }); else next(); break;
      case 'ArrowUp': e.preventDefault(); if (s.scrollTop > 4) s.scrollBy({ top: -s.clientHeight * .6, behavior: 'smooth' }); else prev(); break;
      case ' ': if (tag === 'BUTTON') return; e.preventDefault(); e.shiftKey ? prev() : next(); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(slides.length - 1, { fromBack: true }); break;
      case 'f': case 'F': case 'F5': e.preventDefault(); toggleFull(); break;
      case 'b': case 'B': case '.': e.preventDefault(); blackout(false); break;
      case 'w': case 'W': case ',': e.preventDefault(); blackout(true); break;
      case 'l': case 'L': e.preventDefault(); TTS.cur ? TTS.stop() : readSlide(); break;
      case 's': case 'S': TTS.stop(); break;
      case 'i': case 'I': case 'g': case 'G': togglePanel('toc'); break;
    }
  });
  $('#blackout').onclick = () => $('#blackout').classList.remove('show');

  // gestos táctiles
  let tx = null, ty = null;
  $('#stage').addEventListener('touchstart', e => { if (e.target.closest('.no-swipe,textarea,select,input')) { tx = null; return; } tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  $('#stage').addEventListener('touchend', e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) dx < 0 ? next() : prev(); tx = null; });

  // ajustes
  const sw = { speakFb: 'speakFeedback', autoRead: 'autoRead', clickRead: 'clickRead', steps: 'steps', sound: 'sound', allVoices: 'allVoices' };
  Object.entries(sw).forEach(([id, k]) => { const el = $('#' + id); el.checked = settings[k]; el.onchange = () => { settings[k] = el.checked; saveSettings(); if (k === 'allVoices') fillVoices(); if (k === 'clickRead') document.body.classList.toggle('clickread', el.checked); if (k === 'steps') show(cur, { fromBack: true, silent: true }); }; });
  document.body.classList.toggle('clickread', settings.clickRead);
  const rate = $('#rate'), pitch = $('#pitch');
  rate.value = settings.rate; pitch.value = settings.pitch; $('#rateV').textContent = settings.rate; $('#pitchV').textContent = settings.pitch;
  rate.oninput = () => { settings.rate = +rate.value; $('#rateV').textContent = rate.value; saveSettings(); };
  pitch.oninput = () => { settings.pitch = +pitch.value; $('#pitchV').textContent = pitch.value; saveSettings(); };
  $('#voiceSel').onchange = e => { settings.voiceURI = e.target.value; saveSettings(); TTS.say('¡Hola, Sofía! Esta es mi voz. Vamos a estudiar juntas.'); };
  $('#testVoice').onclick = () => TTS.say('¡Hola, Sofía! Así sueno yo. Vamos a prepararnos para la evaluación número tres. ¡Tú puedes!');

  // eventos al entrar a diapositivas
  const cdSlide = $('#countdown').closest('.slide'); let cdT;
  cdSlide.addEventListener('enter', () => { countdown(); clearInterval(cdT); cdT = setInterval(countdown, 20000); });
  $('#summary').closest('.slide').addEventListener('enter', renderSummary);
  $('#resetAll').onclick = () => { if (!confirm('¿Reiniciar los puntajes de todas las actividades? (Se recargará la página)')) return; try { localStorage.removeItem('sofia_known'); } catch (e) {} location.reload(); };
  addEventListener('resize', () => { const cv = $('#confetti'); cv.width = innerWidth; cv.height = innerHeight; });
}
const startAt = parseInt((location.hash || '').slice(1), 10) || 1;
function start() {
  $('#splash').classList.add('hide');
  show(startAt - 1, { force: true });
}

/* ============ ARRANQUE ============ */
buildToc(); initTips(); initActivities(); bind(); TTS.init(); countdown();
$('#startBtn').onclick = start;
$('#startVoice').onclick = () => { start(); setTimeout(() => togglePanel('settings'), 300); };
show(startAt - 1, { silent: true });
if (startAt > 1) start();
})();
