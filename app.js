/* Buffet Tracker — suivi de ce qui est mangé au buffet à volonté.
 * Application 100 % locale : toutes les données restent dans le téléphone (localStorage). */
(() => {
  'use strict';

  const STORAGE_KEY = 'buffet-tracker-v1';

  const CATEGORIES = [
    { id: 'sushi', name: 'Sushis & makis', emoji: '🍣' },
    { id: 'entree', name: 'Entrées', emoji: '🥟' },
    { id: 'plat', name: 'Plats chauds', emoji: '🍜' },
    { id: 'grill', name: 'Grillades', emoji: '🍢' },
    { id: 'mer', name: 'Fruits de mer', emoji: '🦐' },
    { id: 'dessert', name: 'Desserts', emoji: '🍰' },
    { id: 'boisson', name: 'Boissons', emoji: '🥤' },
  ];

  // kcal : estimation moyenne par pièce / portion servie au buffet.
  const DEFAULT_CATALOG = [
    ['Sushi saumon', '🍣', 'sushi', 60],
    ['Maki', '🍥', 'sushi', 35],
    ['California', '🥑', 'sushi', 45],
    ['Sashimi', '🐟', 'sushi', 40],
    ['Onigiri', '🍙', 'sushi', 180],
    ['Bento', '🍱', 'sushi', 120],
    ['Nem', '🌯', 'entree', 110],
    ['Ravioli vapeur', '🥟', 'entree', 45],
    ['Beignet crevette', '🍤', 'entree', 70],
    ['Soupe miso', '🥣', 'entree', 40],
    ['Salade', '🥗', 'entree', 80],
    ['Edamame', '🫛', 'entree', 120],
    ['Riz cantonais', '🍚', 'plat', 250],
    ['Nouilles sautées', '🍜', 'plat', 300],
    ['Poulet aigre-doux', '🍗', 'plat', 230],
    ['Bœuf aux oignons', '🥘', 'plat', 220],
    ['Canard laqué', '🦆', 'plat', 250],
    ['Pizza', '🍕', 'plat', 270],
    ['Frites', '🍟', 'plat', 300],
    ['Yakitori', '🍢', 'grill', 90],
    ['Bœuf fromage', '🧀', 'grill', 110],
    ['Steak', '🥩', 'grill', 250],
    ['Saucisse', '🌭', 'grill', 200],
    ['Crevettes', '🦐', 'mer', 60],
    ['Huîtres', '🦪', 'mer', 15],
    ['Crabe', '🦀', 'mer', 90],
    ['Calamars', '🦑', 'mer', 150],
    ['Glace', '🍨', 'dessert', 140],
    ['Fruits frais', '🍉', 'dessert', 50],
    ['Gâteau', '🍰', 'dessert', 300],
    ['Mochi', '🍡', 'dessert', 100],
    ['Crème brûlée', '🍮', 'dessert', 250],
    ['Chocolat', '🍫', 'dessert', 60],
    ['Soda', '🥤', 'boisson', 140],
    ['Eau', '💧', 'boisson', 0],
    ['Bière', '🍺', 'boisson', 150],
    ['Vin', '🍷', 'boisson', 120],
    ['Thé', '🍵', 'boisson', 0],
    ['Café', '☕', 'boisson', 5],
  ].map(([name, emoji, cat, kcal], i) => ({ id: 'd' + i, name, emoji, cat, kcal }));

  const PERSON_COLORS = ['#ff6b4a', '#2ec4b6', '#7b61ff', '#ffb703', '#ef476f', '#118ab2', '#06d6a0', '#8d6e63'];

  const EMOJI_CHOICES = ['🍣', '🍥', '🍙', '🍱', '🍤', '🥟', '🌯', '🥗', '🥣', '🍚', '🍜', '🍝', '🍛', '🍗', '🍖', '🥩',
    '🍢', '🌭', '🍔', '🍕', '🍟', '🧀', '🥚', '🦐', '🦀', '🦞', '🦑', '🦪', '🐟', '🥦', '🌽', '🥔',
    '🍨', '🍦', '🍰', '🧁', '🍮', '🍡', '🍫', '🍪', '🍩', '🍉', '🍓', '🍍', '🥤', '🍺', '🍷', '🍵'];

  // ---------- État & persistance ----------
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.catalog) && Array.isArray(data.sessions)) return data;
      }
    } catch (e) { /* données illisibles : on repart de zéro */ }
    return { catalog: DEFAULT_CATALOG.map((x) => ({ ...x })), sessions: [], currentId: null };
  }

  const state = load();
  const ui = { tab: 'track', cat: 'all', person: null, viewSession: null };
  let undoAction = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* stockage plein */ }
  }

  const current = () => state.sessions.find((s) => s.id === state.currentId) || null;
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, name: 'Autre', emoji: '🍽️' };

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

  function fmtDuration(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
  }

  function vibrate(ms = 12) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  // Item d'une session : on garde une copie de chaque plat utilisé pour que l'historique
  // reste lisible même si le plat est ensuite supprimé de la carte.
  function sessionItem(session, id) {
    return state.catalog.find((x) => x.id === id) || (session.items && session.items[id]) || { id, name: 'Plat supprimé', emoji: '🍽️', cat: 'autre', kcal: 0 };
  }

  function countFor(session, itemId, personId) {
    if (personId) return (session.counts[personId] || {})[itemId] || 0;
    return session.people.reduce((sum, p) => sum + ((session.counts[p.id] || {})[itemId] || 0), 0);
  }

  function totals(session, personId) {
    const byItem = {};
    const people = personId ? session.people.filter((p) => p.id === personId) : session.people;
    for (const p of people) {
      for (const [itemId, n] of Object.entries(session.counts[p.id] || {})) {
        if (n > 0) byItem[itemId] = (byItem[itemId] || 0) + n;
      }
    }
    let total = 0, kcal = 0;
    const byCat = {};
    for (const [itemId, n] of Object.entries(byItem)) {
      const it = sessionItem(session, itemId);
      total += n;
      kcal += n * (it.kcal || 0);
      byCat[it.cat] = (byCat[it.cat] || 0) + n;
    }
    return { byItem, byCat, total, kcal };
  }

  // ---------- Actions ----------
  function startSession(name, peopleNames) {
    const names = peopleNames.length ? peopleNames : ['Moi'];
    const session = {
      id: uid(),
      name: name || 'Buffet à volonté',
      start: Date.now(),
      end: null,
      people: names.map((n, i) => ({ id: uid(), name: n, color: PERSON_COLORS[i % PERSON_COLORS.length] })),
      counts: {},
      items: {},
    };
    state.sessions.unshift(session);
    state.currentId = session.id;
    ui.person = session.people[0].id;
    ui.cat = 'all';
    save();
  }

  function change(itemId, delta, { silent = false } = {}) {
    const s = current();
    if (!s) return;
    const pid = ui.person || s.people[0].id;
    s.counts[pid] = s.counts[pid] || {};
    const before = s.counts[pid][itemId] || 0;
    const after = Math.max(0, before + delta);
    if (after === before) return;
    s.counts[pid][itemId] = after;
    const it = state.catalog.find((x) => x.id === itemId);
    if (it) s.items[itemId] = { ...it };
    save();
    if (!silent) {
      undoAction = () => { s.counts[pid][itemId] = before; save(); render(); };
      const person = s.people.length > 1 ? ' · ' + s.people.find((p) => p.id === pid).name : '';
      toast(`${it ? it.emoji : ''} ${delta > 0 ? '+1' : '−1'} ${it ? it.name : ''}${person}`, true);
    }
  }

  function endSession() {
    const s = current();
    if (!s) return;
    s.end = Date.now();
    state.currentId = null;
    save();
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, withUndo = false) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>${withUndo ? '<button data-act="undo">Annuler</button>' : ''}`;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; undoAction = null; }, 2600);
  }

  function floater(x, y, text) {
    const f = document.createElement('div');
    f.className = 'floater';
    f.textContent = text;
    f.style.left = x - 10 + 'px';
    f.style.top = y - 20 + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 700);
  }

  // ---------- Rendu ----------
  function render() {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === ui.tab));
    const s = current();
    $('#title').textContent = s ? s.name : 'Buffet Tracker';
    $('#subtitle').textContent = s
      ? `Commencé à ${new Date(s.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Mangez, tapez, comptez 😋';

    const view = $('#view');
    if (ui.tab === 'track') view.innerHTML = s ? renderTracker(s) : renderWelcome();
    else if (ui.tab === 'stats') view.innerHTML = renderStats(ui.viewSession ? state.sessions.find((x) => x.id === ui.viewSession) : s);
    else view.innerHTML = renderHistory();
  }

  function renderWelcome() {
    return `
      <div class="welcome">
        <div class="welcome-plate">🍣</div>
        <h2>Prêt pour le buffet ?</h2>
        <p class="muted">Tapez sur chaque plat que vous prenez. À la fin, découvrez exactement ce que vous avez mangé.</p>
        <button class="btn btn-primary" data-act="new">🍽️ Commencer un repas</button>
        <div class="welcome-steps">
          <div class="card"><span class="n">👆</span><div><b>Un tap = une pièce</b><small>Le bouton − corrige une erreur.</small></div></div>
          <div class="card"><span class="n">👨‍👩‍👧</span><div><b>Entre amis</b><small>Ajoutez chaque convive et comparez.</small></div></div>
          <div class="card"><span class="n">📊</span><div><b>Le bilan</b><small>Quantités, catégories, calories estimées.</small></div></div>
        </div>
      </div>`;
  }

  function renderTracker(s) {
    if (!s.people.some((p) => p.id === ui.person)) ui.person = s.people[0].id;
    const t = totals(s, ui.person);
    const all = totals(s);
    const person = s.people.find((p) => p.id === ui.person);

    const peopleChips = s.people.length > 1 ? `
      <div class="label-row"><span>Qui mange ?</span></div>
      <div class="chips">
        ${s.people.map((p) => `
          <button class="chip ${p.id === ui.person ? 'active' : ''}" data-person="${p.id}">
            <span class="dot" style="background:${p.color}"></span>${esc(p.name)}
            <span class="chip-count">${totals(s, p.id).total}</span>
          </button>`).join('')}
      </div>` : '';

    const cats = CATEGORIES.filter((c) => state.catalog.some((x) => x.cat === c.id));
    const catChips = `
      <div class="chips" style="margin-top:12px">
        <button class="chip ${ui.cat === 'all' ? 'active' : ''}" data-cat="all">✨ Tout</button>
        ${cats.map((c) => `
          <button class="chip ${ui.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}
            ${t.byCat[c.id] ? `<span class="chip-count">${t.byCat[c.id]}</span>` : ''}
          </button>`).join('')}
      </div>`;

    const items = state.catalog.filter((x) => ui.cat === 'all' || x.cat === ui.cat);
    const grid = items.map((it) => {
      const n = countFor(s, it.id, ui.person);
      return `
        <div class="food ${n ? 'has' : ''}" data-item="${it.id}" role="button" aria-label="Ajouter ${esc(it.name)}">
          ${n ? `<button class="food-minus" data-minus="${it.id}" aria-label="Retirer ${esc(it.name)}">−</button><span class="food-badge">${n}</span>` : ''}
          <span class="food-emoji">${it.emoji}</span>
          <span class="food-name">${esc(it.name)}</span>
        </div>`;
    }).join('');

    return `
      <div class="hero">
        <div>
          <div class="hero-num" id="hero-num">${t.total}</div>
          <div class="hero-label">${s.people.length > 1 ? 'pièces pour ' + esc(person.name) : 'pièces mangées'}</div>
        </div>
        <div class="hero-side">
          🔥 ≈ ${fmtNum(t.kcal)} kcal<br/>
          ⏱️ ${fmtDuration(Date.now() - s.start)}
          ${s.people.length > 1 ? `<br/>👥 ${all.total} au total` : ''}
        </div>
      </div>
      ${peopleChips}
      ${catChips}
      <div class="grid">
        ${grid}
        <button class="food food-add" data-act="add-item">
          <span class="food-emoji">＋</span><span class="food-name">Ajouter un plat</span>
        </button>
      </div>
      <p class="hint muted">Astuce : appuyez longuement sur un plat pour le retirer.</p>`;
  }

  function renderStats(s) {
    if (!s) {
      return `
        <div class="empty">
          <div class="big">📊</div>
          <h2>Pas encore de bilan</h2>
          <p class="muted">Commencez un repas pour voir vos statistiques ici.</p>
          <button class="btn btn-primary" data-act="new">Commencer un repas</button>
        </div>`;
    }
    const t = totals(s);
    const isLive = s.id === state.currentId;
    const duration = (s.end || Date.now()) - s.start;
    const header = ui.viewSession ? `
      <div class="label-row"><button class="btn btn-ghost" data-act="back" style="padding:6px 0">‹ Historique</button>
      <span>${new Date(s.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <h2 style="margin:0 4px 14px">${esc(s.name)}</h2>` : '';

    if (!t.total) {
      return `${header}
        <div class="empty">
          <div class="big">🥢</div>
          <h2>L'assiette est vide</h2>
          <p class="muted">Retournez à l'onglet Buffet et tapez sur ce que vous mangez.</p>
          ${isLive ? '<button class="btn btn-primary" data-tab-go="track">Aller au buffet</button>' : ''}
        </div>
        ${isLive ? '' : `<div class="actions"><button class="btn btn-danger btn-block" data-del="${s.id}">Supprimer ce repas</button></div>`}`;
    }

    const perMin = duration > 60000 ? (t.total / (duration / 60000)) : 0;
    const kpis = `
      <div class="kpis">
        <div class="card kpi"><div class="kpi-ico">🍽️</div><div class="kpi-val">${t.total}</div><div class="kpi-lbl">pièces au total</div></div>
        <div class="card kpi"><div class="kpi-ico">🔥</div><div class="kpi-val">${fmtNum(t.kcal)}</div><div class="kpi-lbl">kcal estimées</div></div>
        <div class="card kpi"><div class="kpi-ico">⏱️</div><div class="kpi-val">${fmtDuration(duration)}</div><div class="kpi-lbl">durée du repas</div></div>
        <div class="card kpi"><div class="kpi-ico">⚡</div><div class="kpi-val">${perMin ? perMin.toFixed(1).replace('.', ',') : '—'}</div><div class="kpi-lbl">pièces / minute</div></div>
      </div>`;

    const catRows = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(...catRows.map((r) => r[1]));
    const catBars = catRows.map(([cid, n]) => {
      const c = catById(cid);
      return barRow(c.emoji, c.name, n, maxCat, Math.round((n / t.total) * 100) + ' %');
    }).join('');

    const itemRows = Object.entries(t.byItem).sort((a, b) => b[1] - a[1]);
    const maxItem = itemRows[0][1];
    const itemBars = itemRows.map(([id, n]) => {
      const it = sessionItem(s, id);
      return barRow(it.emoji, it.name, n, maxItem, it.kcal ? '≈ ' + fmtNum(n * it.kcal) + ' kcal' : '');
    }).join('');

    let podium = '';
    if (s.people.length > 1) {
      const medals = ['🥇', '🥈', '🥉'];
      const ranked = s.people.map((p) => ({ p, t: totals(s, p.id) })).sort((a, b) => b.t.total - a.t.total);
      const max = Math.max(1, ranked[0].t.total);
      podium = `
        <div class="section-title">🏆 Classement des gourmands</div>
        <div class="card podium">
          ${ranked.map(({ p, t: pt }, i) => {
            const fav = Object.entries(pt.byItem).sort((a, b) => b[1] - a[1])[0];
            const favIt = fav ? sessionItem(s, fav[0]) : null;
            return `
              <div class="person-row">
                <div class="avatar" style="background:${p.color}">${esc(p.name.slice(0, 1).toUpperCase())}</div>
                <div class="grow">
                  <div class="bar-name"><span>${esc(p.name)}</span><small>${favIt ? 'fan de ' + favIt.emoji : ''} ≈ ${fmtNum(pt.kcal)} kcal</small></div>
                  <div class="bar-track"><div class="bar-fill" style="width:${(pt.total / max) * 100}%;background:${p.color}"></div></div>
                </div>
                <div class="bar-val">${pt.total}</div>
                <div class="medal">${pt.total ? medals[ranked.filter((r) => r.t.total > pt.total).length] || '' : ''}</div>
              </div>`;
          }).join('')}
        </div>`;
    }

    const actions = isLive ? `
      <div class="actions">
        <button class="btn btn-ghost btn-block" data-act="share">📤 Partager le bilan</button>
        <button class="btn btn-primary btn-block" data-act="end">✅ Terminer le repas</button>
      </div>` : `
      <div class="actions">
        <button class="btn btn-ghost btn-block" data-act="share" data-sid="${s.id}">📤 Partager le bilan</button>
        <button class="btn btn-danger btn-block" data-del="${s.id}">Supprimer ce repas</button>
      </div>`;

    return `${header}
      ${kpis}
      ${podium}
      <div class="section-title">🍱 Par catégorie</div>
      <div class="card bars">${catBars}</div>
      <div class="section-title">🥇 Plat par plat</div>
      <div class="card bars">${itemBars}</div>
      <p class="hint muted">Les calories sont des estimations moyennes, à titre indicatif.</p>
      ${actions}`;
  }

  function barRow(emoji, name, n, max, side) {
    return `
      <div class="bar-row">
        <span class="e">${emoji}</span>
        <div>
          <div class="bar-name"><span>${esc(name)}</span><small>${esc(side)}</small></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div>
        </div>
        <span class="bar-val">${n}</span>
      </div>`;
  }

  function renderHistory() {
    const past = state.sessions.filter((s) => s.id !== state.currentId);
    const cur = current();
    const curCard = cur ? `
      <div class="section-title">🔴 En cours</div>
      <button class="card hist-item" data-tab-go="track">${histInner(cur)}</button>` : '';
    if (!past.length) {
      return `${curCard}
        <div class="empty">
          <div class="big">🗓️</div>
          <h2>Aucun repas terminé</h2>
          <p class="muted">Vos buffets passés apparaîtront ici avec leur bilan.</p>
          ${cur ? '' : '<button class="btn btn-primary" data-act="new">Commencer un repas</button>'}
        </div>`;
    }
    const all = past.reduce((acc, s) => acc + totals(s).total, 0);
    return `${curCard}
      <div class="kpis" style="margin-top:${cur ? 0 : 4}px">
        <div class="card kpi"><div class="kpi-ico">🍽️</div><div class="kpi-val">${past.length}</div><div class="kpi-lbl">repas terminés</div></div>
        <div class="card kpi"><div class="kpi-ico">🍣</div><div class="kpi-val">${fmtNum(all)}</div><div class="kpi-lbl">pièces au total</div></div>
      </div>
      <div class="section-title">Repas passés</div>
      <div class="hist">
        ${past.map((s) => `<button class="card hist-item" data-open="${s.id}">${histInner(s)}</button>`).join('')}
      </div>`;
  }

  function histInner(s) {
    const t = totals(s);
    const d = new Date(s.start);
    const top = Object.entries(t.byItem).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => sessionItem(s, id).emoji).join('');
    return `
      <div class="hist-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>
      <div class="hist-main">
        <b>${esc(s.name)}</b>
        <small>${s.people.length > 1 ? s.people.length + ' convives · ' : ''}≈ ${fmtNum(t.kcal)} kcal</small>
        <div class="hist-emojis">${top || '—'}</div>
      </div>
      <div class="hist-total">${t.total}</div>`;
  }

  // ---------- Feuilles (bottom sheets) ----------
  function openSheet(html, onMount) {
    const sheet = $('#sheet');
    sheet.innerHTML = '<div class="sheet-grip"></div>' + html;
    sheet.hidden = false;
    $('#sheet-backdrop').hidden = false;
    if (onMount) onMount(sheet);
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#sheet-backdrop').hidden = true;
    $('#sheet').innerHTML = '';
  }

  function sheetNewSession() {
    const people = [];
    openSheet(`
      <h3>Nouveau repas 🍽️</h3>
      <p class="lead">Quelques secondes et c'est parti.</p>
      <label class="field"><span>Restaurant</span>
        <input class="input" id="f-name" placeholder="Ex : Sushi Wok Paradise" maxlength="40" autocomplete="off" />
      </label>
      <div class="field"><span>Convives (optionnel)</span>
        <div class="inline">
          <input class="input" id="f-person" placeholder="Prénom" maxlength="20" autocomplete="off" enterkeyhint="done" />
          <button class="btn" id="f-add-person" type="button">Ajouter</button>
        </div>
        <div class="people-edit" id="f-people"><small class="muted">Seul ? Laissez vide, on vous appellera « Moi ».</small></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-act="close">Annuler</button>
        <button class="btn btn-primary" id="f-start">C'est parti !</button>
      </div>`, (root) => {
      const list = $('#f-people', root);
      const input = $('#f-person', root);
      const draw = () => {
        list.innerHTML = people.length
          ? people.map((p, i) => `<span class="chip"><span class="dot" style="background:${PERSON_COLORS[i % PERSON_COLORS.length]}"></span>${esc(p)}<button data-rm="${i}" aria-label="Retirer">✕</button></span>`).join('')
          : '<small class="muted">Seul ? Laissez vide, on vous appellera « Moi ».</small>';
      };
      const add = () => {
        const v = input.value.trim();
        if (v && people.length < 12) { people.push(v); input.value = ''; draw(); }
        input.focus();
      };
      $('#f-add-person', root).onclick = add;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]');
        if (b) { people.splice(+b.dataset.rm, 1); draw(); }
      });
      $('#f-start', root).onclick = () => {
        const pending = input.value.trim();
        if (pending) people.push(pending);
        startSession($('#f-name', root).value.trim(), people);
        closeSheet();
        ui.tab = 'track';
        ui.viewSession = null;
        render();
        toast('Bon appétit ! 🥢');
      };
    });
  }

  function sheetItemForm(existing) {
    const draft = existing ? { ...existing } : { name: '', emoji: '🍣', cat: ui.cat !== 'all' ? ui.cat : 'sushi', kcal: 100 };
    openSheet(`
      <h3>${existing ? 'Modifier le plat' : 'Nouveau plat'}</h3>
      <p class="lead">${existing ? 'Ajustez le nom, l’icône ou la catégorie.' : 'Ajoutez ce que propose votre buffet.'}</p>
      <label class="field"><span>Nom</span>
        <input class="input" id="i-name" maxlength="24" placeholder="Ex : Maki cheese" value="${esc(draft.name)}" autocomplete="off" />
      </label>
      <div class="field"><span>Icône</span>
        <div class="emoji-pick" id="i-emoji">
          ${EMOJI_CHOICES.map((e) => `<button type="button" class="${e === draft.emoji ? 'sel' : ''}" data-e="${e}">${e}</button>`).join('')}
        </div>
      </div>
      <div class="field"><span>Catégorie</span>
        <div class="seg" id="i-cat">
          ${CATEGORIES.map((c) => `<button type="button" class="${c.id === draft.cat ? 'sel' : ''}" data-c="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
        </div>
      </div>
      <label class="field"><span>Calories estimées par pièce / portion</span>
        <input class="input" id="i-kcal" type="number" inputmode="numeric" min="0" max="2000" value="${draft.kcal}" />
      </label>
      <div class="btn-row">
        ${existing ? `<button class="btn btn-danger" id="i-del">Supprimer</button>` : '<button class="btn btn-ghost" data-act="close">Annuler</button>'}
        <button class="btn btn-primary" id="i-save">${existing ? 'Enregistrer' : 'Ajouter'}</button>
      </div>`, (root) => {
      $('#i-emoji', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-e]');
        if (!b) return;
        draft.emoji = b.dataset.e;
        root.querySelectorAll('#i-emoji button').forEach((x) => x.classList.toggle('sel', x === b));
      });
      $('#i-cat', root).addEventListener('click', (e) => {
        const b = e.target.closest('[data-c]');
        if (!b) return;
        draft.cat = b.dataset.c;
        root.querySelectorAll('#i-cat button').forEach((x) => x.classList.toggle('sel', x === b));
      });
      $('#i-save', root).onclick = () => {
        const name = $('#i-name', root).value.trim();
        if (!name) { $('#i-name', root).focus(); return; }
        const kcal = Math.max(0, Math.min(2000, parseInt($('#i-kcal', root).value, 10) || 0));
        if (existing) {
          Object.assign(state.catalog.find((x) => x.id === existing.id), { name, emoji: draft.emoji, cat: draft.cat, kcal });
        } else {
          state.catalog.push({ id: uid(), name, emoji: draft.emoji, cat: draft.cat, kcal });
        }
        save();
        closeSheet();
        render();
        toast(existing ? 'Plat modifié ✏️' : `${draft.emoji} ${name} ajouté`);
      };
      const del = $('#i-del', root);
      if (del) del.onclick = () => {
        if (!confirm(`Supprimer « ${existing.name} » de la carte ?`)) return;
        state.catalog = state.catalog.filter((x) => x.id !== existing.id);
        save();
        closeSheet();
        render();
        toast('Plat supprimé');
      };
    });
  }

  function sheetMenu() {
    const s = current();
    openSheet(`
      <h3>La carte du buffet</h3>
      <p class="lead">Touchez un plat pour le modifier.</p>
      <button class="btn btn-primary btn-block" data-act="add-item" style="margin-bottom:16px">＋ Ajouter un plat</button>
      ${CATEGORIES.map((c) => {
        const items = state.catalog.filter((x) => x.cat === c.id);
        if (!items.length) return '';
        return `<div class="section-title" style="margin-top:14px">${c.emoji} ${esc(c.name)}</div>
          <div class="list">${items.map((it) => `
            <button class="list-item" data-edit="${it.id}">
              <span class="e">${it.emoji}</span>
              <span class="grow"><b>${esc(it.name)}</b><br/><small>≈ ${it.kcal} kcal</small></span>
              <span class="muted">›</span>
            </button>`).join('')}</div>`;
      }).join('')}
      <div class="section-title">Réglages</div>
      <div class="actions" style="margin-top:0">
        ${s ? '<button class="btn btn-block" data-act="end">✅ Terminer le repas en cours</button>' : ''}
        <button class="btn btn-ghost btn-block" data-act="reset-catalog">↺ Restaurer la carte par défaut</button>
        <button class="btn btn-danger btn-block" data-act="wipe">Effacer toutes les données</button>
      </div>`);
  }

  // ---------- Partage ----------
  function shareSession(s) {
    const t = totals(s);
    const lines = [`🍽️ ${s.name} — ${new Date(s.start).toLocaleDateString('fr-FR')}`, `Total : ${t.total} pièces (≈ ${fmtNum(t.kcal)} kcal)`, ''];
    Object.entries(t.byItem).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
      const it = sessionItem(s, id);
      lines.push(`${it.emoji} ${it.name} × ${n}`);
    });
    if (s.people.length > 1) {
      lines.push('', '🏆 Classement :');
      s.people.map((p) => [p.name, totals(s, p.id).total]).sort((a, b) => b[1] - a[1])
        .forEach(([n, v], i, arr) => lines.push(`${['🥇', '🥈', '🥉'][arr.filter((x) => x[1] > v).length] || '•'} ${n} : ${v}`));
    }
    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: 'Mon bilan buffet', text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Bilan copié 📋'), () => toast('Partage indisponible'));
    } else {
      toast('Partage indisponible');
    }
  }

  // ---------- Événements ----------
  // Appui long sur un plat = retirer une pièce.
  let pressTimer = null, longPressed = false;
  const view = $('#view');

  view.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('[data-item]');
    if (!card || e.target.closest('[data-minus]')) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (countFor(current(), card.dataset.item, ui.person) > 0) {
        vibrate(30);
        change(card.dataset.item, -1);
        render();
      }
    }, 550);
  });
  ['pointerup', 'pointerleave', 'pointercancel', 'scroll'].forEach((ev) =>
    view.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true }));
  window.addEventListener('scroll', () => clearTimeout(pressTimer), { passive: true });
  view.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-item]')) e.preventDefault(); });

  document.addEventListener('click', (e) => {
    const t = e.target;

    const minus = t.closest('[data-minus]');
    if (minus) { vibrate(20); change(minus.dataset.minus, -1); render(); return; }

    const card = t.closest('[data-item]');
    if (card) {
      if (longPressed) { longPressed = false; return; }
      const id = card.dataset.item;
      vibrate();
      change(id, +1);
      floater(e.clientX || card.getBoundingClientRect().left + 40, e.clientY || card.getBoundingClientRect().top + 30, '+1');
      render();
      const again = view.querySelector(`[data-item="${id}"]`);
      if (again) again.classList.add('pop');
      const hero = $('#hero-num');
      if (hero) hero.classList.add('bump');
      return;
    }

    const tab = t.closest('.tab');
    if (tab) { ui.tab = tab.dataset.tab; ui.viewSession = null; render(); window.scrollTo(0, 0); return; }

    const go = t.closest('[data-tab-go]');
    if (go) { ui.tab = go.dataset.tabGo; ui.viewSession = null; render(); window.scrollTo(0, 0); return; }

    const person = t.closest('[data-person]');
    if (person) { ui.person = person.dataset.person; vibrate(8); render(); return; }

    const cat = t.closest('[data-cat]');
    if (cat) { ui.cat = cat.dataset.cat; render(); return; }

    const open = t.closest('[data-open]');
    if (open) { ui.viewSession = open.dataset.open; ui.tab = 'stats'; render(); window.scrollTo(0, 0); return; }

    const edit = t.closest('[data-edit]');
    if (edit) { sheetItemForm(state.catalog.find((x) => x.id === edit.dataset.edit)); return; }

    const del = t.closest('[data-del]');
    if (del) {
      if (!confirm('Supprimer définitivement ce repas ?')) return;
      state.sessions = state.sessions.filter((s) => s.id !== del.dataset.del);
      save();
      ui.viewSession = null;
      ui.tab = 'history';
      render();
      toast('Repas supprimé');
      return;
    }

    const act = t.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'new':
        if (current() && !confirm('Un repas est déjà en cours. Le terminer et en commencer un nouveau ?')) return;
        if (current()) endSession();
        sheetNewSession();
        break;
      case 'close': closeSheet(); break;
      case 'add-item': sheetItemForm(null); break;
      case 'undo':
        if (undoAction) { undoAction(); undoAction = null; }
        $('#toast').hidden = true;
        break;
      case 'back': ui.viewSession = null; ui.tab = 'history'; render(); break;
      case 'share': {
        const s = act.dataset.sid ? state.sessions.find((x) => x.id === act.dataset.sid) : current();
        if (s) shareSession(s);
        break;
      }
      case 'end': {
        const s = current();
        if (!s) break;
        if (!confirm('Terminer ce repas ? Il sera rangé dans l’historique.')) return;
        const id = s.id;
        endSession();
        closeSheet();
        ui.tab = 'stats';
        ui.viewSession = id;
        render();
        window.scrollTo(0, 0);
        toast('Repas terminé, bravo ! 🎉');
        break;
      }
      case 'reset-catalog':
        if (!confirm('Remplacer la carte actuelle par la carte par défaut ? Vos plats personnalisés seront retirés.')) return;
        state.catalog = DEFAULT_CATALOG.map((x) => ({ ...x }));
        save(); closeSheet(); render(); toast('Carte restaurée');
        break;
      case 'wipe':
        if (!confirm('Effacer tous les repas et la carte ? Cette action est irréversible.')) return;
        localStorage.removeItem(STORAGE_KEY);
        Object.assign(state, load());
        ui.tab = 'track'; ui.viewSession = null;
        closeSheet(); render(); toast('Données effacées');
        break;
    }
  });

  $('#btn-menu').addEventListener('click', sheetMenu);
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Rafraîchit la durée du repas en cours chaque minute.
  setInterval(() => { if (current() && ui.tab !== 'history' && $('#sheet').hidden) render(); }, 60000);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  render();
})();
