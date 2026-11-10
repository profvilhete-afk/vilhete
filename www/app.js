/* Game Collection — versão offline para Android
 * Os dados ficam no próprio aparelho (IndexedDB). Sem servidor, sem PHP, sem MySQL.
 */
'use strict';

/* ---------------- Ícones ---------------- */
const ICONS = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3"/>',
  gamepad: '<path d="M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="12" r=".6"/><circle cx="18" cy="13.5" r=".6"/>',
  headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.6-.6-3-1.6M12 6v2M12 16v2"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
}

/* ---------------- Utilidades ---------------- */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '');
const nowIso = () => new Date().toISOString();
const $ = (sel, root = document) => root.querySelector(sel);

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function confirmBox(text, okLabel = 'Confirmar') {
  return new Promise((resolve) => {
    const m = $('#modal');
    $('#modalText').textContent = text;
    $('#modalOk').textContent = okLabel;
    m.hidden = false;
    const done = (v) => { m.hidden = true; $('#modalOk').onclick = $('#modalCancel').onclick = null; resolve(v); };
    $('#modalOk').onclick = () => done(true);
    $('#modalCancel').onclick = () => done(false);
  });
}

/* ---------------- Banco de dados (IndexedDB) ---------------- */
const STORES = ['consoles', 'games', 'accessories'];
const DB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('gamecollection', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id', autoIncrement: true }); });
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },
  async tx(stores, mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(t)).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  },
  req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async all(store) {
    const rows = await this.tx([store], 'readonly', (t) => this.req(t.objectStore(store).getAll()));
    return rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },
  async get(store, id) { return this.tx([store], 'readonly', (t) => this.req(t.objectStore(store).get(Number(id)))); },
  async save(store, obj) {
    const o = { ...obj };
    if (!o.id) { delete o.id; o.created_at = nowIso(); }
    return this.tx([store], 'readwrite', (t) => this.req(t.objectStore(store).put(o)));
  },
  async remove(store, id) {
    id = Number(id);
    if (store === 'consoles') {
      // Igual ao ON DELETE SET NULL do MySQL: jogos/acessórios ficam sem console
      return this.tx(STORES, 'readwrite', async (t) => {
        for (const s of ['games', 'accessories']) {
          const os = t.objectStore(s);
          const rows = await this.req(os.getAll());
          rows.filter((r) => Number(r.console_id) === id).forEach((r) => { r.console_id = null; os.put(r); });
        }
        t.objectStore('consoles').delete(id);
      });
    }
    return this.tx([store], 'readwrite', (t) => { t.objectStore(store).delete(id); });
  },
  async exportAll() {
    const out = { app: 'gamecollection', version: 1, exported_at: nowIso() };
    for (const s of STORES) out[s] = await this.all(s);
    return out;
  },
  async replaceAll(data) {
    return this.tx(STORES, 'readwrite', (t) => {
      STORES.forEach((s) => {
        const os = t.objectStore(s);
        os.clear();
        (data[s] || []).forEach((row) => { const r = { ...row }; r.id = Number(r.id); os.put(r); });
      });
    });
  },
};

/* ---------------- Imagens ---------------- */
function readAsDataURL(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
async function resizeImage(file, max = 1200) {
  const url = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/* ---------------- Definição das telas ---------------- */
const STATUS = [['usado', 'Usado'], ['novo', 'Novo'], ['lacrado', 'Lacrado']];
const ACC_TYPES = [['', 'Selecione o tipo'], ['controle', 'Controle'], ['fone', 'Fone de Ouvido'], ['cabo', 'Cabo'], ['carregador', 'Carregador'], ['case', 'Case / Capa'], ['outro', 'Outro']];

const ENTITIES = {
  consoles: {
    singular: 'Console', plural: 'Consoles', icon: 'tv', titleField: 'name',
    fields: [
      { name: 'name', label: 'Nome do console *', required: true },
      [{ name: 'brand', label: 'Marca' }, { name: 'model', label: 'Modelo' }],
      [{ name: 'color', label: 'Cor' }, { name: 'price', label: 'Preço (R$)', type: 'number' }],
      { name: 'purchase_date', label: 'Data da compra', type: 'date' },
      { name: 'notes', label: 'Observações', type: 'textarea' },
    ],
    sub: (r) => [r.brand, r.model].filter(Boolean).join(' • ') || 'Marca não informada',
  },
  games: {
    singular: 'Jogo', plural: 'Jogos', icon: 'gamepad', titleField: 'title',
    fields: [
      { name: 'title', label: 'Título *', required: true },
      { name: 'console_id', label: 'Console', type: 'console' },
      [{ name: 'genre', label: 'Gênero' }, { name: 'year', label: 'Ano', type: 'number', step: '1' }],
      [{ name: 'price', label: 'Preço (R$)', type: 'number' }, { name: 'status', label: 'Estado', type: 'select', options: STATUS }],
      { name: 'notes', label: 'Observações', type: 'textarea' },
    ],
    defaults: { status: 'usado' },
    sub: (r, cmap) => [cmap[r.console_id], r.genre, r.year].filter(Boolean).join(' • ') || 'Sem detalhes',
  },
  accessories: {
    singular: 'Acessório', plural: 'Acessórios', icon: 'headset', titleField: 'name',
    fields: [
      { name: 'name', label: 'Nome *', required: true },
      { name: 'console_id', label: 'Console', type: 'console' },
      [{ name: 'type', label: 'Tipo', type: 'select', options: ACC_TYPES }, { name: 'brand', label: 'Marca' }],
      { name: 'price', label: 'Preço (R$)', type: 'number' },
      { name: 'notes', label: 'Observações', type: 'textarea' },
    ],
    sub: (r, cmap) => [cmap[r.console_id], (ACC_TYPES.find((t) => t[0] === r.type) || [])[1], r.brand].filter(Boolean).join(' • ') || 'Sem detalhes',
  },
};
const NUMERIC = new Set(['price', 'year', 'console_id']);

/* ---------------- Shell / navegação ---------------- */
const view = $('#view');
function setShell({ title, tab, back = false, fab = null }) {
  $('#pageTitle').textContent = title;
  document.title = title;
  const bb = $('#backBtn');
  bb.hidden = !back;
  bb.innerHTML = icon('back');
  bb.onclick = () => history.back();
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  const f = $('#fab');
  f.hidden = !fab;
  f.innerHTML = icon('plus');
  f.onclick = fab ? () => { location.hash = fab; } : null;
  window.scrollTo(0, 0);
}

const listState = { q: {}, console: '' };

async function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [section, action, id] = parts;
  try {
    if (!section) return await renderHome();
    if (section === 'backup') return await renderBackup();
    if (ENTITIES[section]) {
      if (action === 'new') return await renderForm(section, null);
      if (action === 'edit' && id) return await renderForm(section, id);
      return await renderList(section);
    }
    location.hash = '#/';
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty">Algo deu errado: ${esc(e.message || e)}</div>`;
  }
}

/* ---------------- Início ---------------- */
async function renderHome() {
  setShell({ title: 'Game Collection', tab: 'home' });
  const [consoles, games, accessories] = await Promise.all(STORES.map((s) => DB.all(s)));
  const sum = (rows) => rows.reduce((a, r) => a + (Number(r.price) || 0), 0);
  const tc = sum(consoles), tg = sum(games), ta = sum(accessories);
  const cmap = Object.fromEntries(consoles.map((c) => [c.id, c.name]));
  const recent = [
    ...games.map((r) => ({ ...r, _s: 'games' })),
    ...consoles.map((r) => ({ ...r, _s: 'consoles' })),
    ...accessories.map((r) => ({ ...r, _s: 'accessories' })),
  ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

  view.innerHTML = `
    <p class="hello">Sua coleção, sempre no bolso.</p>
    <div class="stats">
      <a class="stat c1" href="#/consoles"><span class="label">${icon('tv')} Consoles</span><span class="value">${consoles.length}</span></a>
      <a class="stat c2" href="#/games"><span class="label">${icon('gamepad')} Jogos</span><span class="value">${games.length}</span></a>
      <a class="stat c3" href="#/accessories"><span class="label">${icon('headset')} Acessórios</span><span class="value">${accessories.length}</span></a>
      <div class="stat c1"><span class="label">${icon('database')} Itens</span><span class="value">${consoles.length + games.length + accessories.length}</span></div>
      <div class="stat money">
        <span class="label">${icon('money')} Total investido</span>
        <span class="value">${money(tc + tg + ta)}</span>
        <div class="breakdown"><span>Consoles ${money(tc)}</span><span>Jogos ${money(tg)}</span><span>Acessórios ${money(ta)}</span></div>
      </div>
    </div>

    <div class="section-title">Adicionar</div>
    <div class="quick">
      <a href="#/games/new">${icon('gamepad')}Jogo</a>
      <a href="#/consoles/new">${icon('tv')}Console</a>
      <a href="#/accessories/new">${icon('headset')}Acessório</a>
    </div>

    <div class="section-title">Adicionados recentemente</div>
    ${recent.length ? `<div class="row-list">${recent.map((r) => rowItem(r._s, r, cmap)).join('')}</div>`
      : `<div class="empty">${icon('gamepad')}<div>Nada cadastrado ainda.<br><a href="#/backup">Importe um backup</a> ou adicione seu primeiro item.</div></div>`}
  `;
}
function rowItem(store, r, cmap) {
  const e = ENTITIES[store];
  const img = r.image ? `<img src="${r.image}" alt="" loading="lazy">` : `<div class="ph"></div>`;
  return `<a class="row-item" href="#/${store}/edit/${r.id}">${img}<div class="meta"><div class="t">${esc(r[e.titleField])}</div><div class="s">${e.singular} • ${esc(e.sub(r, cmap))}</div></div>${r.price ? `<span class="price">${money(r.price)}</span>` : ''}</a>`;
}

/* ---------------- Listas ---------------- */
async function renderList(store) {
  const e = ENTITIES[store];
  setShell({ title: e.plural, tab: store, fab: `#/${store}/new` });
  const [rows, consoles] = await Promise.all([DB.all(store), store === 'consoles' ? Promise.resolve([]) : DB.all('consoles')]);
  const cmap = Object.fromEntries(consoles.map((c) => [c.id, c.name]));
  const hasConsoleFilter = store !== 'consoles' && consoles.length > 0;

  view.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<input type="search" id="q" placeholder="Buscar ${e.plural.toLowerCase()}..." value="${esc(listState.q[store] || '')}"></label>
      ${hasConsoleFilter ? `<div class="chips" id="chips">
        <button class="chip" data-c="">Todos</button>
        ${consoles.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<button class="chip" data-c="${c.id}">${esc(c.name)}</button>`).join('')}
      </div>` : ''}
    </div>
    <div id="results"></div>`;

  const draw = () => {
    const q = (listState.q[store] || '').trim().toLowerCase();
    const cf = hasConsoleFilter ? listState.console : '';
    const filtered = rows.filter((r) => {
      if (cf && String(r.console_id) !== cf) return false;
      if (!q) return true;
      return [r[e.titleField], r.brand, r.genre, r.model, r.notes, cmap[r.console_id]].some((v) => String(v || '').toLowerCase().includes(q));
    });
    document.querySelectorAll('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.c === cf));
    const res = $('#results');
    if (!rows.length) {
      res.innerHTML = `<div class="empty">${icon(e.icon)}<div>Nenhum ${e.singular.toLowerCase()} cadastrado.<br><a href="#/${store}/new">Adicionar o primeiro</a></div></div>`;
      return;
    }
    if (!filtered.length) { res.innerHTML = `<div class="empty">Nada encontrado.</div>`; return; }
    const total = filtered.reduce((a, r) => a + (Number(r.price) || 0), 0);
    res.innerHTML = `<div class="count">${filtered.length} ${filtered.length === 1 ? e.singular.toLowerCase() : e.plural.toLowerCase()} • ${money(total)}</div>
      <div class="grid">${filtered.map((r) => card(store, r, cmap)).join('')}</div>`;
  };
  $('#q').addEventListener('input', (ev) => { listState.q[store] = ev.target.value; draw(); });
  $('#chips')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b) return;
    listState.console = b.dataset.c; draw();
  });
  draw();
}
function card(store, r, cmap) {
  const e = ENTITIES[store];
  const img = r.image ? `<img src="${r.image}" alt="" loading="lazy">` : icon(e.icon);
  const badge = store === 'games' && r.status ? `<span class="badge ${esc(r.status)}">${esc(r.status)}</span>` : '';
  return `<a class="card" href="#/${store}/edit/${r.id}">
    <div class="img">${img}</div>
    <div class="body">
      <div class="t">${esc(r[e.titleField])}</div>
      <div class="s">${esc(e.sub(r, cmap))}</div>
      <div class="foot">${r.price ? `<span class="price">${money(r.price)}</span>` : '<span></span>'}${badge}</div>
    </div></a>`;
}

/* ---------------- Formulários ---------------- */
async function renderForm(store, id) {
  const e = ENTITIES[store];
  const isNew = !id;
  let rec = isNew ? { ...(e.defaults || {}) } : await DB.get(store, id);
  if (!rec) { location.hash = `#/${store}`; return; }
  setShell({ title: isNew ? `Novo ${e.singular.toLowerCase()}` : `Editar ${e.singular.toLowerCase()}`, tab: store, back: true });
  const consoles = e.fields.flat().some((f) => f.type === 'console') ? (await DB.all('consoles')).sort((a, b) => a.name.localeCompare(b.name)) : [];
  let image = rec.image || null;

  const fieldHtml = (f) => {
    const v = rec[f.name] ?? '';
    const common = `id="f_${f.name}" name="${f.name}" ${f.required ? 'required' : ''}`;
    let input;
    if (f.type === 'textarea') input = `<textarea ${common}>${esc(v)}</textarea>`;
    else if (f.type === 'select') input = `<select ${common}>${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(v) === val ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
    else if (f.type === 'console') input = `<select ${common}><option value="">Sem console</option>${consoles.map((c) => `<option value="${c.id}" ${Number(v) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`;
    else if (f.type === 'number') input = `<input type="number" inputmode="decimal" step="${f.step || '0.01'}" ${common} value="${esc(v)}">`;
    else input = `<input type="${f.type || 'text'}" ${common} value="${esc(v)}" autocomplete="off">`;
    return `<div class="field"><label for="f_${f.name}">${f.label}</label>${input}</div>`;
  };

  view.innerHTML = `
    <form id="form" novalidate>
      <div class="photo">
        <div class="preview" id="preview"></div>
        <div class="actions">
          <label class="btn small">${icon('camera')} Câmera<input type="file" accept="image/*" capture="environment" id="camInput"></label>
          <label class="btn small">${icon('image')} Galeria<input type="file" accept="image/*" id="galInput"></label>
          <button type="button" class="btn small ghost" id="rmImg" aria-label="Remover foto">${icon('x')}</button>
        </div>
      </div>
      ${e.fields.map((f) => (Array.isArray(f) ? `<div class="two">${f.map(fieldHtml).join('')}</div>` : fieldHtml(f))).join('')}
      <div class="form-actions">
        <button type="submit" class="btn primary block">${icon('save')} Salvar</button>
        ${isNew ? '' : `<button type="button" class="btn ghost block" id="delBtn" style="color:var(--danger)">${icon('trash')} Excluir</button>`}
      </div>
    </form>`;

  const drawPreview = () => {
    $('#preview').innerHTML = image ? `<img src="${image}" alt="">` : icon('image');
    $('#rmImg').hidden = !image;
  };
  drawPreview();
  const onPick = async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try { image = await resizeImage(file); drawPreview(); } catch (err) { toast('Não foi possível ler a imagem', true); }
    ev.target.value = '';
  };
  $('#camInput').addEventListener('change', onPick);
  $('#galInput').addEventListener('change', onPick);
  $('#rmImg').addEventListener('click', () => { image = null; drawPreview(); });

  $('#form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const out = { ...rec };
    for (const f of e.fields.flat()) {
      const raw = (fd.get(f.name) ?? '').toString().trim();
      out[f.name] = NUMERIC.has(f.name) ? num(raw) : raw;
    }
    const req = e.fields.flat().find((f) => f.required && !out[f.name]);
    if (req) { toast(`Preencha: ${req.label.replace(' *', '')}`, true); $(`#f_${req.name}`).focus(); return; }
    out.image = image;
    try {
      await DB.save(store, out);
      toast(`${e.singular} ${isNew ? 'cadastrado' : 'atualizado'}!`);
      history.back();
    } catch (err) {
      console.error(err);
      toast('Erro ao salvar: ' + (err.message || err), true);
    }
  });

  $('#delBtn')?.addEventListener('click', async () => {
    const extra = store === 'consoles' ? ' Jogos e acessórios ligados a ele ficarão sem console.' : '';
    if (!(await confirmBox(`Excluir "${rec[e.titleField]}"?${extra}`, 'Excluir'))) return;
    await DB.remove(store, rec.id);
    toast(`${e.singular} excluído`);
    history.back();
  });
}

/* ---------------- Backup ---------------- */
function nativePlugin(name) {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable(name)) return null;
  if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
  if (cap.registerPlugin) return cap.registerPlugin(name);
  if (cap.nativePromise) return new Proxy({}, { get: (_, m) => (opts) => cap.nativePromise(name, m, opts) });
  return null;
}

async function saveFile(filename, text) {
  const Filesystem = nativePlugin('Filesystem');
  const Share = nativePlugin('Share');
  if (Filesystem && Share) {
    // No app Android: grava no cache e abre o "Compartilhar" (Drive, WhatsApp, e-mail, Arquivos...)
    const res = await Filesystem.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
    await Share.share({ title: 'Backup Game Collection', files: [res.uri], dialogTitle: 'Salvar ou enviar backup' });
    return 'shared';
  }
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return 'downloaded';
}

async function renderBackup() {
  setShell({ title: 'Backup', tab: 'backup' });
  const data = await DB.exportAll();
  const n = STORES.reduce((a, s) => a + data[s].length, 0);
  view.innerHTML = `
    <div class="panel">
      <h2>${icon('download')} Fazer backup</h2>
      <p>Gera um arquivo com toda a coleção (${n} ${n === 1 ? 'item' : 'itens'}, incluindo as fotos). Guarde no Google Drive, e-mail ou WhatsApp.</p>
      <button class="btn primary block" id="expBtn">${icon('download')} Exportar backup</button>
    </div>
    <div class="panel warn">
      <h2>${icon('upload')} Restaurar backup</h2>
      <p>Escolha um arquivo .json de backup deste app. <strong>Isso substitui tudo</strong> o que está no aparelho agora.</p>
      <label class="btn block">${icon('upload')} Escolher arquivo<input type="file" id="impInput" accept=".json,application/json,text/plain,*/*" hidden></label>
    </div>
    <div class="panel">
      <h2>${icon('database')} Onde ficam os dados?</h2>
      <p style="margin:0">Tudo fica salvo só neste aparelho, sem internet. Se você desinstalar o app ou limpar os dados dele, a coleção é apagada — por isso faça backups de vez em quando.</p>
    </div>`;

  $('#expBtn').addEventListener('click', async () => {
    try {
      const d = new Date();
      const p = (x) => String(x).padStart(2, '0');
      const name = `backup_gamecollection_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
      const r = await saveFile(name, JSON.stringify(await DB.exportAll()));
      if (r === 'downloaded') toast('Backup salvo em Downloads');
    } catch (err) {
      if (String(err && err.message).toLowerCase().includes('cancel')) return;
      console.error(err); toast('Erro ao exportar: ' + (err.message || err), true);
    }
  });

  $('#impInput').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== 'gamecollection' || !STORES.every((s) => Array.isArray(parsed[s]))) throw new Error('Arquivo não é um backup do Game Collection');
      const total = STORES.reduce((a, s) => a + parsed[s].length, 0);
      if (!(await confirmBox(`Restaurar ${total} itens deste backup? O que está no aparelho será substituído.`, 'Restaurar'))) return;
      await DB.replaceAll(parsed);
      toast('Backup restaurado!');
      location.hash = '#/';
    } catch (err) {
      console.error(err); toast(err.message || 'Arquivo inválido', true);
    }
  });
}

/* ---------------- Botão "voltar" do Android ---------------- */
// Sem isso o Android fecha o app ao apertar "voltar".
// Agora: fecha a caixa aberta > sai do formulário > volta ao Início > pergunta se quer sair.
let exitAsking = false;
function setupBackButton() {
  const App = nativePlugin('App');
  if (!App || !App.addListener) return;
  App.addListener('backButton', async () => {
    if (!$('#modal').hidden) { $('#modalCancel').click(); return; }
    const [section, action] = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    if (section && (action === 'new' || action === 'edit')) { history.back(); return; }
    if (section) { location.hash = '#/'; return; }
    if (exitAsking) return;
    exitAsking = true;
    const sair = await confirmBox('Deseja sair do Game Collection?', 'Sair');
    exitAsking = false;
    if (sair) App.exitApp();
  });
}

/* ---------------- Início do app ---------------- */
hydrateIcons();
setupBackButton();
window.addEventListener('hashchange', route);
// Pede ao navegador para não apagar os dados por falta de espaço
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
route();
