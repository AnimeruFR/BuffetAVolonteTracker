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
    ['Gyoza', '🥟', 'entree', 45],
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
        if (data && Array.isArray(data.catalog) && Array.isArray(data.sessions)) return migrate(data);
      }
    } catch (e) { /* données illisibles : on repart de zéro */ }
    return { catalog: DEFAULT_CATALOG.map((x) => ({ ...x })), sessions: [], currentId: null };
  }

  // Renomme les plats par défaut déjà enregistrés sur le téléphone (sauf s'ils ont été modifiés).
  const RENAMED = { d7: ['Ravioli vapeur', 'Gyoza'] };
  function migrate(data) {
    const fix = (it) => { const r = it && RENAMED[it.id]; if (r && it.name === r[0]) it.name = r[1]; };
    data.catalog.forEach(fix);
    data.sessions.filter((x) => !x.shared).forEach((x) => {
      (x.catalog || []).forEach(fix);
      Object.values(x.items || {}).forEach(fix);
    });
    return data;
  }

  const state = load();
  const ui = { tab: 'track', cat: 'all', person: null, viewSession: null, statsPerson: null, syncReady: false, online: false };
  let undoAction = null;

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* stockage plein */ }
  }
  save(); // enregistre tout de suite les éventuels renommages de migrate()

  const current = () => state.sessions.find((s) => s.id === state.currentId) || null;
  const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, name: 'Autre', emoji: '🍽️' };
  // Chaque repas a sa propre carte (partagée avec le groupe) ; la carte de l'appareil sert de modèle.
  const catalogOf = (s) => (s && s.catalog) || state.catalog;
  const sync = window.BuffetSync;

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
    return catalogOf(session).find((x) => x.id === id) || (session.items && session.items[id])
      || state.catalog.find((x) => x.id === id) || { id, name: 'Plat supprimé', emoji: '🍽️', cat: 'autre', kcal: 0 };
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
  const syncError = (e) => { console.warn(e); toast('⚠️ Synchronisation impossible pour le moment'); };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  // Le lien transmet aussi l'adresse de la base : les invités n'ont rien à configurer.
  const inviteLink = (code) => location.origin + location.pathname + '?repas=' + code
    + (sync.fromFile() ? '' : '&db=' + encodeURIComponent(sync.dbUrl()));

  function startSession(name, myName, others, shared) {
    const names = [myName || 'Moi', ...others];
    const session = {
      id: uid(),
      name: name || 'Buffet à volonté',
      start: Date.now(),
      end: null,
      people: names.map((n, i) => ({ id: uid(), name: n, color: PERSON_COLORS[i % PERSON_COLORS.length] })),
      counts: {},
      items: {},
      catalog: state.catalog.map((x) => ({ ...x })),
    };
    session.me = session.people[0].id;
    if (shared) {
      session.id = session.code = sync.newCode();
      session.shared = true;
      sync.create(session.code, toRemote(session)).catch(syncError);
    }
    leaveCurrent();
    state.sessions.unshift(session);
    state.currentId = session.id;
    ui.person = session.me;
    ui.cat = 'all';
    save();
    if (shared) listen(session.code);
    return session;
  }

  // ----- Repas partagés -----
  function toRemote(s) {
    const keyed = (arr) => Object.fromEntries(arr.map((x, i) => {
      const { id, ...rest } = x;
      return [id, { ...rest, o: i }];
    }));
    return { v: 1, name: s.name, start: s.start, end: s.end || null, people: keyed(s.people), catalog: keyed(s.catalog), counts: s.counts, items: s.items };
  }

  function fromRemote(code, v, prev) {
    const list = (o) => Object.entries(o || {})
      .map(([id, x]) => ({ ...x, id }))
      .sort((a, b) => (a.o || 0) - (b.o || 0))
      .map(({ o, ...x }) => x);
    return {
      id: code, code, shared: true, me: prev ? prev.me : null,
      name: v.name || 'Buffet à volonté', start: v.start || Date.now(), end: v.end || null,
      people: list(v.people), catalog: list(v.catalog), counts: v.counts || {}, items: v.items || {},
    };
  }

  function storeRemote(code, v) {
    if (!v) return null;
    const i = state.sessions.findIndex((x) => x.id === code);
    const s = fromRemote(code, v, i >= 0 ? state.sessions[i] : null);
    if (i >= 0) state.sessions[i] = s; else state.sessions.unshift(s);
    save();
    return s;
  }

  let liveCode = null, stopLive = null;
  function listen(code) {
    if (liveCode === code && stopLive) return;
    stopListening();
    liveCode = code;
    if (!sync.ready()) return; // l'écoute démarrera quand Firebase sera chargé
    stopLive = sync.watch(code, (v) => {
      const s = storeRemote(code, v);
      if (!s) return;
      if (!s.end) renameInSharedMeal(s);
      if (s.end && state.currentId === code) {
        state.currentId = null;
        save();
        stopListening();
        ui.tab = 'stats'; ui.viewSession = code; ui.statsPerson = null;
        toast('Repas terminé, bravo ! 🎉');
      }
      render();
    });
  }
  // Applique les renommages de la carte par défaut à un repas partagé déjà commencé (pour tout le groupe).
  function renameInSharedMeal(s) {
    const patch = {};
    for (const [id, [from, to]] of Object.entries(RENAMED)) {
      const it = s.catalog.find((x) => x.id === id);
      if (it && it.name === from) { it.name = to; patch[`catalog/${id}/name`] = to; }
      if (s.items[id] && s.items[id].name === from) { s.items[id].name = to; patch[`items/${id}/name`] = to; }
    }
    if (Object.keys(patch).length) { save(); sync.update(s.code, patch).catch(syncError); }
  }

  function stopListening() {
    if (stopLive) stopLive();
    stopLive = null;
    liveCode = null;
  }

  // Quitte le repas en cours : un repas partagé continue pour les autres, un repas solo est terminé.
  function leaveCurrent() {
    const s = current();
    if (!s) return;
    if (s.shared) { state.currentId = null; stopListening(); save(); } else endSession();
  }

  function joinMeal(code, v, personId) {
    if (state.currentId !== code) leaveCurrent();
    const s = storeRemote(code, v);
    s.me = personId;
    if (s.end) {
      save();
      ui.tab = 'stats'; ui.viewSession = code; ui.statsPerson = null;
      closeSheet(); render();
      toast('Ce repas est déjà terminé, voici son bilan');
      return;
    }
    state.currentId = code;
    ui.person = personId;
    ui.tab = 'track'; ui.viewSession = null; ui.cat = 'all';
    save();
    listen(code);
    closeSheet();
    render();
    toast(`Vous avez rejoint « ${s.name} » 🥢`);
  }

  function addPerson(s, name) {
    const p = { id: uid(), name, color: PERSON_COLORS[s.people.length % PERSON_COLORS.length] };
    s.people.push(p);
    save();
    if (s.shared) sync.update(s.code, { ['people/' + p.id]: { name: p.name, color: p.color, o: Date.now() } }).catch(syncError);
    return p;
  }

  // Efface les pièces comptées d'un plat, pour toutes les personnes (et tout le groupe si partagé).
  function clearItemCounts(s, itemId) {
    const patch = {};
    for (const p of s.people) {
      if (s.counts[p.id] && s.counts[p.id][itemId]) {
        delete s.counts[p.id][itemId];
        patch[`counts/${p.id}/${itemId}`] = null;
      }
    }
    save();
    if (s.shared && Object.keys(patch).length) sync.update(s.code, patch).catch(syncError);
  }

  // Plats retirés de la carte du repas mais qui ont encore des pièces comptées.
  function orphanItems(s) {
    if (!s) return [];
    const ids = Object.keys(totals(s).byItem).filter((id) => !catalogOf(s).some((x) => x.id === id));
    return ids.map((id) => ({ it: sessionItem(s, id), n: countFor(s, id) }));
  }

  function restoreItem(s, itemId) {
    if (!s.catalog) s.catalog = state.catalog.map((x) => ({ ...x }));
    const { id, name, emoji, cat, kcal } = sessionItem(s, itemId);
    s.catalog.push({ id, name, emoji, cat, kcal });
    save();
    if (s.shared) sync.update(s.code, { ['catalog/' + id]: { name, emoji, cat, kcal, o: Date.now() } }).catch(syncError);
  }

  function change(itemId, delta, { silent = false, pid = null } = {}) {
    const s = current();
    if (!s) return;
    pid = pid || ui.person || s.people[0].id;
    s.counts[pid] = s.counts[pid] || {};
    const before = s.counts[pid][itemId] || 0;
    const after = Math.max(0, before + delta);
    if (after === before) return;
    s.counts[pid][itemId] = after;
    const it = catalogOf(s).find((x) => x.id === itemId);
    // Copie du plat pour que l'historique reste lisible s'il est retiré de la carte.
    if (it && !s.items[itemId]) {
      s.items[itemId] = { ...it };
      if (s.shared) sync.update(s.code, { ['items/' + itemId]: { ...it } }).catch(syncError);
    }
    save();
    if (s.shared) sync.increment(s.code, pid, itemId, after - before).catch(syncError);
    if (!silent) {
      undoAction = () => { change(itemId, before - after, { silent: true, pid }); render(); };
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
    if (s.shared) {
      sync.update(s.code, { end: s.end }).catch(syncError);
      stopListening();
    }
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
    const since = s ? `Commencé à ${new Date(s.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';
    $('#subtitle').innerHTML = !s ? 'Mangez, tapez, comptez 😋'
      : s.shared ? `<span class="sync-dot ${ui.online ? 'on' : ''}"></span>${ui.online ? 'Synchronisé' : 'Hors ligne'} · ${since}`
      : since;

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
        <div class="welcome-actions">
          <button class="btn btn-primary" data-act="new">🍽️ Commencer un repas</button>
          <button class="btn" data-act="join">🔗 Rejoindre un repas</button>
        </div>
        <div class="welcome-steps">
          <div class="card"><span class="n">👆</span><div><b>Un tap = une pièce</b><small>Le bouton − corrige une erreur.</small></div></div>
          <div class="card"><span class="n">👨‍👩‍👧</span><div><b>En groupe</b><small>Chacun suit sur son téléphone, tout est partagé.</small></div></div>
          <div class="card"><span class="n">📊</span><div><b>Le bilan</b><small>Quantités, catégories, calories estimées.</small></div></div>
        </div>
      </div>`;
  }

  function renderTracker(s) {
    if (!s.people.length) return '<div class="empty"><div class="big">⏳</div><h2>Chargement du repas…</h2></div>';
    if (!s.people.some((p) => p.id === ui.person)) ui.person = s.people.some((p) => p.id === s.me) ? s.me : s.people[0].id;
    const t = totals(s, ui.person);
    const all = totals(s);
    const person = s.people.find((p) => p.id === ui.person);

    const invite = s.shared ? `
      <button class="card invite-bar" data-act="invite">
        <span class="invite-ico">🔗</span>
        <span class="grow"><b>Code du repas : <span class="code">${s.code}</span></b><small>Touchez pour inviter le groupe</small></span>
        <span class="muted">›</span>
      </button>` : '';

    const peopleChips = s.people.length > 1 || s.shared ? `
      <div class="label-row"><span>Qui mange ?</span></div>
      <div class="chips">
        ${s.people.map((p) => `
          <button class="chip ${p.id === ui.person ? 'active' : ''}" data-person="${p.id}">
            <span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === s.me && s.people.length > 1 ? ' <small>(moi)</small>' : ''}
            <span class="chip-count">${totals(s, p.id).total}</span>
          </button>`).join('')}
        <button class="chip chip-add" data-act="add-person" aria-label="Ajouter une personne">＋</button>
      </div>` : '';

    const cats = CATEGORIES.filter((c) => catalogOf(s).some((x) => x.cat === c.id));
    const catChips = `
      <div class="chips" style="margin-top:12px">
        <button class="chip ${ui.cat === 'all' ? 'active' : ''}" data-cat="all">✨ Tout</button>
        ${cats.map((c) => `
          <button class="chip ${ui.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}
            ${t.byCat[c.id] ? `<span class="chip-count">${t.byCat[c.id]}</span>` : ''}
          </button>`).join('')}
      </div>`;

    const items = catalogOf(s).filter((x) => ui.cat === 'all' || x.cat === ui.cat);
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
      ${invite}
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
    const isGroup = s.people.length > 1;
    if (!s.people.some((p) => p.id === ui.statsPerson)) ui.statsPerson = null;
    const person = isGroup ? s.people.find((p) => p.id === ui.statsPerson) || null : null;
    const t = totals(s, person ? person.id : null);
    const group = totals(s);
    const isLive = s.id === state.currentId;
    const duration = (s.end || Date.now()) - s.start;

    const header = ui.viewSession ? `
      <div class="label-row"><button class="btn btn-ghost" data-act="back" style="padding:6px 0">‹ Historique</button>
      <span>${new Date(s.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
      <h2 style="margin:0 4px 14px">${esc(s.name)}</h2>` : '';

    // Sélecteur : résumé du groupe ou d'une personne.
    const switcher = isGroup ? `
      <div class="chips stats-switch">
        <button class="chip ${person ? '' : 'active'}" data-stats-person="">👥 Groupe <span class="chip-count">${group.total}</span></button>
        ${s.people.map((p) => `
          <button class="chip ${person && person.id === p.id ? 'active' : ''}" data-stats-person="${p.id}">
            <span class="dot" style="background:${p.color}"></span>${esc(p.name)}
            <span class="chip-count">${totals(s, p.id).total}</span>
          </button>`).join('')}
      </div>` : '';

    const canRejoin = !isLive && s.shared && !s.end;
    const actions = `
      <div class="actions">
        ${canRejoin ? `<button class="btn btn-primary btn-block" data-act="rejoin" data-sid="${s.id}">↩️ Reprendre ce repas</button>` : ''}
        <button class="btn btn-ghost btn-block" data-act="share" data-sid="${s.id}">📤 Partager ${person ? 'le bilan de ' + esc(person.name) : isGroup ? 'le bilan du groupe' : 'le bilan'}</button>
        ${isLive ? `<button class="btn btn-primary btn-block" data-act="end">✅ Terminer le repas${s.shared ? ' pour tout le groupe' : ''}</button>`
          : `<button class="btn btn-danger btn-block" data-del="${s.id}">${s.shared ? 'Retirer de mon historique' : 'Supprimer ce repas'}</button>`}
      </div>`;

    if (!t.total) {
      return `${header}${switcher}
        <div class="empty">
          <div class="big">🥢</div>
          <h2>${person ? esc(person.name) + ' n’a encore rien mangé' : 'L’assiette est vide'}</h2>
          <p class="muted">Retournez à l'onglet Buffet et tapez sur ce qui est mangé.</p>
          ${isLive ? `<button class="btn btn-primary" data-tab-go="track"${person ? ` data-track-person="${person.id}"` : ''}>Aller au buffet</button>` : ''}
        </div>
        ${!isLive && !group.total ? actions : ''}`;
    }

    const minutes = duration / 60000;
    const perMin = minutes >= 1 ? (t.total / minutes).toFixed(1).replace('.', ',') : '—';
    const kpi = (ico, val, lbl) => `<div class="card kpi"><div class="kpi-ico">${ico}</div><div class="kpi-val">${val}</div><div class="kpi-lbl">${lbl}</div></div>`;

    let intro = '';
    let kpis;
    if (person) {
      const ranked = rankPeople(s);
      const me = ranked.find((r) => r.p.id === person.id);
      const share = Math.round((t.total / group.total) * 100);
      const avg = group.total / s.people.length;
      const diff = Math.round(((t.total - avg) / avg) * 100);
      const fav = Object.entries(t.byItem).sort((a, b) => b[1] - a[1])[0];
      const favIt = sessionItem(s, fav[0]);
      intro = `
        <div class="card person-hero" style="--pc:${person.color}">
          <div class="avatar avatar-lg" style="background:${person.color}">${esc(initial(person.name))}</div>
          <div class="grow">
            <div class="person-hero-name">${esc(person.name)} ${me.medal}</div>
            <div class="muted">${me.rank === 1 ? '1er' : me.rank + 'e'} sur ${s.people.length} · ${share} % du groupe</div>
            <div class="muted">${diff === 0 ? 'Pile dans la moyenne du groupe' : (diff > 0 ? '+' : '') + diff + ' % vs la moyenne du groupe'}</div>
          </div>
        </div>
        <div class="card fav-card"><span class="fav-emoji">${favIt.emoji}</span><div><small class="muted">Plat préféré</small><b>${esc(favIt.name)} × ${fav[1]}</b></div></div>`;
      kpis = `<div class="kpis">
        ${kpi('🍽️', t.total, 'pièces mangées')}
        ${kpi('🔥', fmtNum(t.kcal), 'kcal estimées')}
        ${kpi('🧾', Object.keys(t.byItem).length, 'plats différents')}
        ${kpi('⚡', perMin, 'pièces / minute')}
      </div>`;
    } else {
      kpis = `<div class="kpis">
        ${kpi('🍽️', t.total, isGroup ? 'pièces pour le groupe' : 'pièces au total')}
        ${kpi('🔥', fmtNum(t.kcal), 'kcal estimées')}
        ${kpi('⏱️', fmtDuration(duration), 'durée du repas')}
        ${isGroup ? kpi('👤', (t.total / s.people.length).toFixed(1).replace('.', ','), 'pièces / personne') : kpi('⚡', perMin, 'pièces / minute')}
      </div>`;
    }

    // Résumé de chaque membre (vue groupe uniquement).
    let members = '';
    if (isGroup && !person) {
      const max = Math.max(1, ...rankPeople(s).map((r) => r.t.total));
      members = `
        <div class="section-title">👥 Résumé par personne</div>
        <div class="members">
          ${rankPeople(s).map(({ p, t: pt, medal }) => {
            const top = Object.entries(pt.byItem).sort((a, b) => b[1] - a[1]).slice(0, 4);
            const topCat = Object.entries(pt.byCat).sort((a, b) => b[1] - a[1])[0];
            return `
              <button class="card member" data-stats-person="${p.id}">
                <div class="person-row">
                  <div class="avatar" style="background:${p.color}">${esc(initial(p.name))}</div>
                  <div class="grow">
                    <div class="bar-name"><span>${esc(p.name)} ${medal}</span><small>≈ ${fmtNum(pt.kcal)} kcal</small></div>
                    <div class="bar-track"><div class="bar-fill" style="width:${(pt.total / max) * 100}%;background:${p.color}"></div></div>
                  </div>
                  <div class="bar-val">${pt.total}</div>
                </div>
                <div class="member-foot">
                  <span class="member-top">${top.length ? top.map(([id, n]) => `<span>${sessionItem(s, id).emoji}<small>×${n}</small></span>`).join('') : '<small class="muted">Rien pour l’instant</small>'}</span>
                  <small class="muted">${topCat ? catById(topCat[0]).emoji + ' ' + esc(catById(topCat[0]).name) : ''} ›</small>
                </div>
              </button>`;
          }).join('')}
        </div>`;
    }

    const catRows = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(...catRows.map((r) => r[1]));
    const catBars = catRows.map(([cid, n]) => {
      const c = catById(cid);
      return barRow(c.emoji, c.name, n, maxCat, Math.round((n / t.total) * 100) + ' %', splitBy(s, person, (pt) => pt.byCat[cid]));
    }).join('');

    const itemRows = Object.entries(t.byItem).sort((a, b) => b[1] - a[1]);
    const maxItem = itemRows[0][1];
    const itemBars = itemRows.map(([id, n]) => {
      const it = sessionItem(s, id);
      return barRow(it.emoji, it.name, n, maxItem, it.kcal ? '≈ ' + fmtNum(n * it.kcal) + ' kcal' : '', splitBy(s, person, (pt) => pt.byItem[id]));
    }).join('');

    const legend = isGroup && !person ? `<div class="legend">${s.people.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join('')}</div>` : '';

    return `${header}
      ${switcher}
      ${intro}
      ${kpis}
      ${members}
      <div class="section-title">🍱 Par catégorie</div>
      <div class="card bars">${legend}${catBars}</div>
      <div class="section-title">🥇 Plat par plat</div>
      <div class="card bars">${legend}${itemBars}</div>
      <p class="hint muted">Les calories sont des estimations moyennes, à titre indicatif.</p>
      ${actions}`;
  }

  const initial = (name) => (Array.from(name.trim())[0] || '?').toUpperCase();

  // Classement du groupe ; les ex æquo partagent le même rang et la même médaille.
  function rankPeople(s) {
    const rows = s.people.map((p) => ({ p, t: totals(s, p.id) })).sort((a, b) => b.t.total - a.t.total);
    return rows.map((r) => {
      const rank = rows.filter((x) => x.t.total > r.t.total).length + 1;
      return { ...r, rank, medal: r.t.total ? ['🥇', '🥈', '🥉'][rank - 1] || '' : '' };
    });
  }

  // Répartition d'une barre entre les membres (vue groupe uniquement).
  function splitBy(s, person, pick) {
    if (person || s.people.length < 2) return null;
    return s.people.map((p) => ({ name: p.name, color: p.color, n: pick(totals(s, p.id)) || 0 })).filter((x) => x.n);
  }

  function barRow(emoji, name, n, max, side, segments) {
    const fill = segments && segments.length
      ? `<div class="bar-stack" style="width:${(n / max) * 100}%">${segments.map((g) => `<div style="flex:${g.n};background:${g.color}"></div>`).join('')}</div>`
      : `<div class="bar-fill" style="width:${(n / max) * 100}%"></div>`;
    const who = segments && segments.length ? `<div class="bar-who">${segments.map((g) => `${esc(g.name)} ${g.n}`).join(' · ')}</div>` : '';
    return `
      <div class="bar-row">
        <span class="e">${emoji}</span>
        <div>
          <div class="bar-name"><span>${esc(name)}</span><small>${esc(side)}</small></div>
          <div class="bar-track">${fill}</div>
          ${who}
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
        <small>${s.shared ? '👥 ' : ''}${s.people.length > 1 ? s.people.length + ' personnes · ' : ''}≈ ${fmtNum(t.kcal)} kcal${s.shared && !s.end && s.id !== state.currentId ? ' · en cours' : ''}</small>
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
    const canShare = sync.ready();
    const hint = canShare
      ? 'Les autres rejoindront avec le code. Ajoutez ici ceux qui n’ont pas de téléphone.'
      : 'Ajoutez les membres du groupe pour suivre chacun.';
    openSheet(`
      <h3>Nouveau repas 🍽️</h3>
      <p class="lead">Quelques secondes et c'est parti.</p>
      <label class="field"><span>Restaurant</span>
        <input class="input" id="f-name" placeholder="Ex : Sushi Wok Paradise" maxlength="40" autocomplete="off" />
      </label>
      <label class="field"><span>Votre prénom</span>
        <input class="input" id="f-me" placeholder="Ex : Emma" maxlength="20" autocomplete="given-name" value="${esc(state.myName || '')}" />
      </label>
      ${canShare ? `
      <label class="switch-row">
        <span><b>👥 Partager avec le groupe</b><small>Chacun suit sur son téléphone, en temps réel.</small></span>
        <input type="checkbox" id="f-shared" checked /><span class="switch"></span>
      </label>` : `<button class="note note-btn" data-act="setup">👥 Pour partager le repas entre les téléphones du groupe, <u>activez le partage</u> (une seule fois).</button>`}
      <div class="field"><span>Autres membres (optionnel)</span>
        <div class="inline">
          <input class="input" id="f-person" placeholder="Prénom" maxlength="20" autocomplete="off" enterkeyhint="done" />
          <button class="btn" id="f-add-person" type="button">Ajouter</button>
        </div>
        <div class="people-edit" id="f-people"><small class="muted">${hint}</small></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-act="close">Annuler</button>
        <button class="btn btn-primary" id="f-start">C'est parti !</button>
      </div>`, (root) => {
      const list = $('#f-people', root);
      const input = $('#f-person', root);
      const draw = () => {
        list.innerHTML = people.length
          ? people.map((p, i) => `<span class="chip"><span class="dot" style="background:${PERSON_COLORS[(i + 1) % PERSON_COLORS.length]}"></span>${esc(p)}<button data-rm="${i}" aria-label="Retirer">✕</button></span>`).join('')
          : `<small class="muted">${hint}</small>`;
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
        const shared = canShare && $('#f-shared', root).checked;
        const me = $('#f-me', root).value.trim();
        if (shared && !me) { $('#f-me', root).focus(); toast('Indiquez votre prénom pour le groupe'); return; }
        const pending = input.value.trim();
        if (pending) people.push(pending);
        if (me) state.myName = me;
        const session = startSession($('#f-name', root).value.trim(), me, people, shared);
        ui.tab = 'track';
        ui.viewSession = null;
        render();
        if (shared) sheetInvite(session);
        else { closeSheet(); toast('Bon appétit ! 🥢'); }
      };
    });
  }

  function sheetInvite(s) {
    const link = inviteLink(s.code);
    openSheet(`
      <h3>Inviter le groupe 🔗</h3>
      <p class="lead">Envoyez le lien, ou donnez le code : chacun l’entre dans « Rejoindre un repas ».</p>
      <div class="code-box" aria-label="Code du repas">${s.code.split('').map((c) => `<span>${c}</span>`).join('')}</div>
      <div class="actions" style="margin-top:18px">
        <button class="btn btn-primary btn-block" data-act="send-invite" data-code="${s.code}">📤 Envoyer le lien</button>
        <button class="btn btn-block" data-act="copy-invite" data-code="${s.code}">📋 Copier le lien</button>
        <button class="btn btn-ghost btn-block" data-act="close">C'est bon, on mange !</button>
      </div>
      <p class="hint muted" style="word-break:break-all">${esc(link)}</p>`);
  }

  function sheetJoin(prefill = '') {
    openSheet(`
      <h3>Rejoindre un repas 🔗</h3>
      <p class="lead">Entrez le code à 6 caractères reçu du groupe.</p>
      <label class="field"><span>Code du repas</span>
        <input class="input code-input" id="j-code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7P2QX" value="${esc(prefill)}" />
      </label>
      <p class="note" id="j-msg" hidden></p>
      <div class="btn-row">
        <button class="btn btn-ghost" data-act="close">Annuler</button>
        <button class="btn btn-primary" id="j-go">Continuer</button>
      </div>`, (root) => {
      const input = $('#j-code', root);
      const msg = $('#j-msg', root);
      const fail = (text) => { msg.textContent = text; msg.hidden = false; };
      input.addEventListener('input', () => { input.value = sync.normalizeCode(input.value); msg.hidden = true; });
      const go = async () => {
        const code = sync.normalizeCode(input.value);
        if (!sync.validCode(code)) { fail('Le code contient 6 lettres ou chiffres, par exemple K7P2QX.'); return; }
        if (!sync.ready()) { fail('Le partage n’est pas disponible : vérifiez votre connexion ou la configuration (README).'); return; }
        const btn = $('#j-go', root);
        btn.disabled = true; btn.textContent = 'Recherche…';
        try {
          const v = await withTimeout(sync.fetch(code), 10000);
          if (!v) { fail('Aucun repas avec ce code. Vérifiez-le auprès du groupe.'); return; }
          sheetWhoAmI(code, v);
        } catch (e) {
          fail('Impossible de joindre le serveur. Vérifiez votre connexion internet.');
        } finally {
          btn.disabled = false; btn.textContent = 'Continuer';
        }
      };
      $('#j-go', root).onclick = go;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      if (prefill) go(); else input.focus();
    });
  }

  function sheetWhoAmI(code, v) {
    const meal = fromRemote(code, v, null);
    const known = state.sessions.find((x) => x.id === code);
    openSheet(`
      <h3>${esc(meal.name)}</h3>
      <p class="lead">Qui êtes-vous ? Touchez votre prénom, ou ajoutez-vous.</p>
      <div class="list">
        ${meal.people.map((p) => `
          <button class="list-item" data-me="${p.id}">
            <span class="avatar" style="background:${p.color}">${esc(initial(p.name))}</span>
            <span class="grow"><b>${esc(p.name)}</b>${known && known.me === p.id ? '<br/><small>c’est vous sur ce téléphone</small>' : ''}</span>
            <span class="muted">›</span>
          </button>`).join('')}
      </div>
      <div class="field" style="margin-top:18px"><span>Je ne suis pas dans la liste</span>
        <div class="inline">
          <input class="input" id="w-name" placeholder="Votre prénom" maxlength="20" autocomplete="given-name" value="${esc(state.myName || '')}" />
          <button class="btn btn-primary" id="w-add">Rejoindre</button>
        </div>
      </div>`, (root) => {
      root.querySelector('.list').addEventListener('click', (e) => {
        const b = e.target.closest('[data-me]');
        if (b) joinMeal(code, v, b.dataset.me);
      });
      const add = () => {
        const name = $('#w-name', root).value.trim();
        if (!name) { $('#w-name', root).focus(); return; }
        state.myName = name;
        const p = { id: uid(), name, color: PERSON_COLORS[meal.people.length % PERSON_COLORS.length], o: Date.now() };
        const { id, ...rest } = p;
        v.people = { ...(v.people || {}), [id]: rest };
        sync.update(code, { ['people/' + id]: rest }).catch(syncError);
        joinMeal(code, v, id);
      };
      $('#w-add', root).onclick = add;
      $('#w-name', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    });
  }

  function sheetSetup() {
    const existingUrl = sync.configured() ? sync.dbUrl() : '';
    openSheet(`
      <h3>Activer le partage 👥</h3>
      <p class="lead">Une seule personne le fait, une seule fois (5 min). Les autres n’ont rien à configurer : le lien d’invitation suffit.</p>
      <ol class="steps">
        <li><b>Créez un projet Firebase</b> (gratuit, avec votre compte Google) :
          <a class="btn btn-block" href="https://console.firebase.google.com/" target="_blank" rel="noopener">🔥 Ouvrir Firebase</a>
          Touchez « Créer un projet », donnez un nom, et désactivez Google Analytics.</li>
        <li><b>Créez la base</b> : menu ☰ → <b>Créer</b> (ou <i>Build</i>) → <b>Realtime Database</b> → « Créer une base de données ». Emplacement : <b>Belgique (europe-west1)</b>, puis <b>mode verrouillé</b>.</li>
        <li><b>Onglet Règles</b> : effacez tout le texte, collez les règles ci-dessous, puis « Publier ».
          <button class="btn btn-block" data-act="copy-rules">📋 Copier les règles</button></li>
        <li><b>Onglet Données</b> : copiez l’adresse affichée en haut (elle commence par <i>https://</i>) et collez-la ici :</li>
      </ol>
      <input class="input" id="db-url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://…firebasedatabase.app" value="${esc(existingUrl)}" />
      <p class="note" id="db-msg" hidden></p>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn btn-ghost" data-act="close">Plus tard</button>
        <button class="btn btn-primary" id="db-save">Activer</button>
      </div>`, (root) => {
      const msg = $('#db-msg', root);
      const say = (text) => { msg.textContent = text; msg.hidden = false; };
      $('#db-save', root).onclick = async () => {
        const url = sync.parseDbUrl($('#db-url', root).value);
        if (!url) { say('Adresse non reconnue. Elle ressemble à https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app'); return; }
        if (sync.ready() && url !== sync.dbUrl()) { sync.setDbUrl(url); location.reload(); return; }
        sync.setDbUrl(url);
        const btn = $('#db-save', root);
        btn.disabled = true; btn.textContent = 'Vérification…';
        try {
          if (!sync.ready() && !(await sync.init())) throw new Error('sdk');
          await withTimeout(sync.fetch('AAAAAA'), 10000);
          ui.syncReady = true;
          sync.onConnection((online) => { ui.online = online; if (current() && current().shared) render(); });
          closeSheet();
          render();
          toast('Partage activé ✅ Commencez un repas !');
        } catch (e) {
          const denied = /permission/i.test(String((e && (e.code || e.message)) || ''));
          say(denied ? 'La base répond, mais les règles ne sont pas publiées : refaites l’étape 3.'
            : e.message === 'sdk' ? 'Impossible de charger Firebase : vérifiez votre connexion internet.'
              : 'La base ne répond pas : vérifiez l’adresse et votre connexion.');
        } finally {
          btn.disabled = false; btn.textContent = 'Activer';
        }
      };
    });
  }

  function sheetAddPerson() {
    const s = current();
    if (!s) return;
    openSheet(`
      <h3>Ajouter une personne</h3>
      <p class="lead">${s.shared ? 'Pour quelqu’un sans téléphone. Les autres peuvent rejoindre avec le code.' : 'Elle aura ses propres compteurs.'}</p>
      <div class="inline">
        <input class="input" id="p-name" placeholder="Prénom" maxlength="20" autocomplete="off" />
        <button class="btn btn-primary" id="p-add">Ajouter</button>
      </div>
      ${s.shared ? `<button class="btn btn-ghost btn-block" data-act="invite" style="margin-top:12px">🔗 Inviter avec le code</button>` : ''}`, (root) => {
      const add = () => {
        const name = $('#p-name', root).value.trim();
        if (!name) { $('#p-name', root).focus(); return; }
        const p = addPerson(s, name);
        ui.person = p.id;
        closeSheet();
        render();
        toast(`${name} a rejoint la table 👋`);
      };
      $('#p-add', root).onclick = add;
      $('#p-name', root).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      $('#p-name', root).focus();
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
        const fields = { name, emoji: draft.emoji, cat: draft.cat, kcal };
        const s = current();
        if (s && !s.catalog) s.catalog = state.catalog.map((x) => ({ ...x }));
        if (existing) {
          Object.assign(catalogOf(s).find((x) => x.id === existing.id), fields);
          if (s && s.shared) {
            sync.update(s.code, Object.fromEntries(Object.entries(fields).map(([k, val]) => [`catalog/${existing.id}/${k}`, val]))).catch(syncError);
          }
        } else {
          const id = uid();
          catalogOf(s).push({ id, ...fields });
          // Un plat ajouté pendant un repas rejoint aussi la carte par défaut de ce téléphone.
          if (s && !state.catalog.some((x) => x.name.toLowerCase() === name.toLowerCase())) state.catalog.push({ id, ...fields });
          if (s && s.shared) sync.update(s.code, { ['catalog/' + id]: { ...fields, o: Date.now() } }).catch(syncError);
        }
        save();
        closeSheet();
        render();
        toast(existing ? 'Plat modifié ✏️' : `${draft.emoji} ${name} ajouté`);
      };
      const del = $('#i-del', root);
      if (del) del.onclick = () => {
        if (!confirm(`Supprimer « ${existing.name} » de la carte ?`)) return;
        const s = current();
        const counted = s ? countFor(s, existing.id) : 0;
        if (counted && confirm(`${counted} « ${existing.name} » déjà compté${counted > 1 ? 's' : ''}${s.shared ? ' dans le groupe' : ''}. Les effacer aussi du bilan ?\n\nOK = effacer · Annuler = les garder`)) {
          clearItemCounts(s, existing.id);
        }
        if (s) {
          if (!s.catalog) s.catalog = state.catalog.map((x) => ({ ...x }));
          s.catalog = s.catalog.filter((x) => x.id !== existing.id);
          if (s.shared) sync.update(s.code, { ['catalog/' + existing.id]: null }).catch(syncError);
        } else {
          state.catalog = state.catalog.filter((x) => x.id !== existing.id);
        }
        save();
        closeSheet();
        render();
        toast('Plat supprimé');
      };
    });
  }

  function sheetMenu() {
    const s = current();
    const lead = !s ? 'Votre carte par défaut, utilisée pour les prochains repas.'
      : s.shared ? 'La carte de ce repas, partagée avec tout le groupe.' : 'La carte de ce repas.';
    openSheet(`
      <h3>La carte du buffet</h3>
      <p class="lead">${lead} Touchez un plat pour le modifier.</p>
      <button class="btn btn-primary btn-block" data-act="add-item" style="margin-bottom:16px">＋ Ajouter un plat</button>
      ${CATEGORIES.map((c) => {
        const items = catalogOf(s).filter((x) => x.cat === c.id);
        if (!items.length) return '';
        return `<div class="section-title" style="margin-top:14px">${c.emoji} ${esc(c.name)}</div>
          <div class="list">${items.map((it) => `
            <button class="list-item" data-edit="${it.id}">
              <span class="e">${it.emoji}</span>
              <span class="grow"><b>${esc(it.name)}</b><br/><small>≈ ${it.kcal} kcal</small></span>
              <span class="muted">›</span>
            </button>`).join('')}</div>`;
      }).join('')}
      ${orphanItems(s).length ? `
        <div class="section-title">🗑️ Retirés de la carte, mais encore comptés</div>
        <div class="list">${orphanItems(s).map(({ it, n }) => `
          <div class="list-item">
            <span class="e">${it.emoji}</span>
            <span class="grow"><b>${esc(it.name)}</b><br/><small>${n} compté${n > 1 ? 's' : ''}${s.shared ? ' dans le groupe' : ''}</small></span>
            <button class="btn btn-danger btn-sm" data-clear-item="${it.id}">Effacer</button>
            <button class="btn btn-sm" data-restore-item="${it.id}">Remettre</button>
          </div>`).join('')}</div>` : ''}
      <div class="section-title">Partage en groupe</div>
      ${sync.configured()
        ? `<div class="note">✅ Activé${ui.syncReady ? '' : ' (connexion en attente)'}<br/><small class="muted" style="word-break:break-all">${esc(sync.dbUrl())}</small></div>
           ${sync.fromFile() ? '' : '<button class="btn btn-ghost btn-block" data-act="setup">Changer de base</button>'}`
        : '<button class="btn btn-primary btn-block" data-act="setup">👥 Activer le partage en groupe</button>'}
      <div class="section-title">Réglages</div>
      <div class="actions" style="margin-top:0">
        ${s && s.shared ? '<button class="btn btn-block" data-act="invite">🔗 Inviter le groupe</button>' : ''}
        ${s ? `<button class="btn btn-block" data-act="end">✅ Terminer le repas${s.shared ? ' pour tout le groupe' : ''}</button>` : ''}
        ${s && s.shared ? '<button class="btn btn-ghost btn-block" data-act="leave">🚪 Quitter ce repas (il continue pour les autres)</button>' : ''}
        ${s ? '' : '<button class="btn btn-ghost btn-block" data-act="reset-catalog">↺ Restaurer la carte par défaut</button>'}
        <button class="btn btn-danger btn-block" data-act="wipe">Effacer toutes les données</button>
      </div>`);
  }

  // ---------- Partage ----------
  function shareSession(s, personId) {
    const person = s.people.find((p) => p.id === personId);
    const t = totals(s, person ? person.id : null);
    const lines = [`🍽️ ${s.name} — ${new Date(s.start).toLocaleDateString('fr-FR')}`];
    if (person) lines.push(`👤 Bilan de ${person.name}`);
    else if (s.people.length > 1) lines.push(`👥 Bilan du groupe (${s.people.length} personnes)`);
    lines.push(`Total : ${t.total} pièces (≈ ${fmtNum(t.kcal)} kcal)`, '');
    Object.entries(t.byItem).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
      const it = sessionItem(s, id);
      lines.push(`${it.emoji} ${it.name} × ${n}`);
    });
    if (s.people.length > 1 && !person) {
      lines.push('', '🏆 Par personne :');
      rankPeople(s).forEach(({ p, t: pt, medal }) => {
        const top = Object.entries(pt.byItem).sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([id, n]) => `${sessionItem(s, id).emoji}×${n}`).join(' ');
        lines.push(`${medal || '•'} ${p.name} : ${pt.total}${top ? ' — ' + top : ''}`);
      });
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

  function copyText(text, okMsg) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(okMsg), () => toast(text));
    else toast(text);
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

    const sp = t.closest('[data-stats-person]');
    if (sp) { ui.statsPerson = sp.dataset.statsPerson || null; vibrate(8); render(); window.scrollTo(0, 0); return; }

    const go = t.closest('[data-tab-go]');
    if (go && go.dataset.trackPerson) ui.person = go.dataset.trackPerson;
    if (go) { ui.tab = go.dataset.tabGo; ui.viewSession = null; render(); window.scrollTo(0, 0); return; }

    const person = t.closest('[data-person]');
    if (person) { ui.person = person.dataset.person; vibrate(8); render(); return; }

    const cat = t.closest('[data-cat]');
    if (cat) { ui.cat = cat.dataset.cat; render(); return; }

    const open = t.closest('[data-open]');
    if (open) {
      const id = open.dataset.open;
      ui.viewSession = id; ui.statsPerson = null; ui.tab = 'stats';
      render(); window.scrollTo(0, 0);
      // Un repas partagé a pu être complété par les autres depuis : on rafraîchit.
      const sess = state.sessions.find((x) => x.id === id);
      if (sess && sess.shared && sync.ready()) {
        withTimeout(sync.fetch(sess.code), 8000).then((v) => { if (storeRemote(sess.code, v) && ui.viewSession === id) render(); }).catch(() => {});
      }
      return;
    }

    const clr = t.closest('[data-clear-item]');
    if (clr) {
      const s = current();
      const id = clr.dataset.clearItem;
      const it = sessionItem(s, id);
      if (!confirm(`Effacer les ${countFor(s, id)} « ${it.name} » comptés${s.shared ? ' pour tout le groupe' : ''} ?`)) return;
      clearItemCounts(s, id);
      sheetMenu(); render();
      toast(`${it.emoji} ${it.name} effacé du bilan`);
      return;
    }
    const rst = t.closest('[data-restore-item]');
    if (rst) {
      const s = current();
      restoreItem(s, rst.dataset.restoreItem);
      sheetMenu(); render();
      toast('Plat remis sur la carte');
      return;
    }

    const edit = t.closest('[data-edit]');
    if (edit) { sheetItemForm(catalogOf(current()).find((x) => x.id === edit.dataset.edit)); return; }

    const del = t.closest('[data-del]');
    if (del) {
      const target = state.sessions.find((x) => x.id === del.dataset.del);
      if (!confirm(target && target.shared ? 'Retirer ce repas de votre historique ? Il reste visible pour les autres membres.' : 'Supprimer définitivement ce repas ?')) return;
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
        if (current() && !confirm(current().shared ? 'Un repas partagé est en cours. Le quitter pour en commencer un nouveau ?' : 'Un repas est déjà en cours. Le terminer et en commencer un nouveau ?')) return;
        leaveCurrent();
        sheetNewSession();
        break;
      case 'join': sheetJoin(); break;
      case 'setup': sheetSetup(); break;
      case 'copy-rules': copyText(sync.RULES, 'Règles copiées 📋 Collez-les dans Firebase'); break;
      case 'invite': if (current() && current().shared) sheetInvite(current()); break;
      case 'add-person': sheetAddPerson(); break;
      case 'send-invite': {
        const link = inviteLink(act.dataset.code);
        const text = `Rejoins-moi sur Buffet Tracker pour compter ce qu'on mange 🍣 Code : ${act.dataset.code}`;
        if (navigator.share) navigator.share({ title: 'Buffet Tracker', text, url: link }).catch(() => {});
        else copyText(link, 'Lien copié 📋');
        break;
      }
      case 'copy-invite': copyText(inviteLink(act.dataset.code), 'Lien copié 📋'); break;
      case 'rejoin': {
        const sess = state.sessions.find((x) => x.id === act.dataset.sid);
        if (sess) sheetJoin(sess.code);
        break;
      }
      case 'leave':
        if (!confirm('Quitter ce repas ? Il continue pour les autres et vous pourrez le reprendre depuis l’historique.')) return;
        leaveCurrent();
        closeSheet(); ui.tab = 'track'; render();
        toast('Vous avez quitté le repas');
        break;
      case 'close': closeSheet(); break;
      case 'add-item': sheetItemForm(null); break;
      case 'undo':
        if (undoAction) { undoAction(); undoAction = null; }
        $('#toast').hidden = true;
        break;
      case 'back': ui.viewSession = null; ui.tab = 'history'; render(); break;
      case 'share': {
        const s = state.sessions.find((x) => x.id === act.dataset.sid);
        if (s) shareSession(s, ui.statsPerson);
        break;
      }
      case 'end': {
        const s = current();
        if (!s) break;
        if (!confirm(s.shared ? 'Terminer ce repas pour tout le groupe ? Il sera rangé dans l’historique de chacun.' : 'Terminer ce repas ? Il sera rangé dans l’historique.')) return;
        const id = s.id;
        endSession();
        closeSheet();
        ui.tab = 'stats';
        ui.viewSession = id;
        ui.statsPerson = null;
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
        stopListening();
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

  // Mises à jour automatiques : on vérifie à chaque retour sur l'application, et on recharge
  // dès qu'une nouvelle version est installée (les données sont déjà enregistrées).
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
        setInterval(() => reg.update().catch(() => {}), 5 * 60000);
      }).catch(() => {});
    });
  }

  // Lien d'invitation : ?repas=CODE
  const params = new URLSearchParams(location.search);
  const invitedCode = sync.normalizeCode(params.get('repas'));
  const invitedDb = sync.parseDbUrl(params.get('db'));
  if (invitedDb && !sync.fromFile()) sync.setDbUrl(invitedDb);
  if (params.has('repas') || params.has('db')) history.replaceState(null, '', location.pathname);

  render();

  sync.init().then((ok) => {
    ui.syncReady = ok;
    if (ok) {
      sync.onConnection((online) => { ui.online = online; if (current() && current().shared) render(); });
      const s = current();
      if (s && s.shared) listen(s.code);
    }
    if (invitedCode) {
      if (ok) sheetJoin(invitedCode);
      else toast('Impossible de rejoindre : vérifiez votre connexion internet');
    }
    render();
  });
})();
