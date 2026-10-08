/* Synchronisation des repas de groupe via Firebase Realtime Database.
 * Chaque repas partagé vit sous /meals/{CODE} ; tous les téléphones qui connaissent
 * le code lisent et écrivent au même endroit, en temps réel. */
window.BuffetSync = (() => {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I/L, pour éviter les confusions
  const DB_KEY = 'buffet-tracker-db';
  const DB_URL_RE = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:firebaseio\.com|firebasedatabase\.app)/i;
  // Règles de sécurité à coller dans Firebase (identiques à database.rules.json).
  const RULES = JSON.stringify({
    rules: {
      '.read': false,
      '.write': false,
      meals: { $code: { '.read': '$code.matches(/^[A-HJKMNP-Z2-9]{6}$/)', '.write': '$code.matches(/^[A-HJKMNP-Z2-9]{6}$/)' } },
      photos: {
        $code: {
          '.read': '$code.matches(/^[A-HJKMNP-Z2-9]{6}$/)',
          '.write': '$code.matches(/^[A-HJKMNP-Z2-9]{6}$/)',
          $id: { '.validate': "newData.child('data').isString() && newData.child('data').val().length < 2000000" },
        },
      },
    },
  }, null, 2);
  let db = null;

  // La base peut venir de firebase-config.js, ou avoir été collée dans l'application / reçue par un lien d'invitation.
  function storedUrl() {
    try { return localStorage.getItem(DB_KEY) || ''; } catch (e) { return ''; }
  }
  function config() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) return window.FIREBASE_CONFIG;
    const url = storedUrl();
    return url ? { databaseURL: url } : null;
  }
  const configured = () => !!config();
  const ready = () => !!db;
  const dbUrl = () => (config() ? config().databaseURL.replace(/\/+$/, '') : '');
  const parseDbUrl = (text) => { const m = String(text || '').match(DB_URL_RE); return m ? m[0].toLowerCase() : ''; };
  const fromFile = () => !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  function setDbUrl(url) {
    try { localStorage.setItem(DB_KEY, url); } catch (e) { /* stockage indisponible */ }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (!configured()) return false;
    try {
      if (!window.firebase) {
        await loadScript(SDK + 'firebase-app-compat.js');
        await loadScript(SDK + 'firebase-database-compat.js');
      }
      if (!window.firebase.apps.length) window.firebase.initializeApp(config());
      db = window.firebase.database();
      return true;
    } catch (e) {
      console.warn('Synchronisation indisponible', e);
      return false;
    }
  }

  function newCode() {
    const buf = new Uint32Array(6);
    crypto.getRandomValues(buf);
    return Array.from(buf, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
  }

  const normalizeCode = (raw) => String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const validCode = (code) => new RegExp(`^[${CODE_CHARS}]{6}$`).test(code);
  const ref = (path) => db.ref(path);

  return {
    RULES,
    configured,
    ready,
    dbUrl,
    parseDbUrl,
    setDbUrl,
    fromFile,
    init,
    newCode,
    normalizeCode,
    validCode,

    // Écrit le repas complet (création).
    create(code, data) { return ref('meals/' + code).set(data); },

    // Écritures multiples relatives au repas : { 'people/abc': {...}, end: 123 }.
    update(code, patch) { return ref('meals/' + code).update(patch); },

    // +1 / −1 sans conflit même si plusieurs téléphones tapent en même temps.
    increment(code, personId, itemId, delta) {
      return ref(`meals/${code}/counts/${personId}/${itemId}`)
        .transaction((n) => Math.max(0, (n || 0) + delta) || null);
    },

    // Écoute le repas en temps réel. Renvoie la fonction pour arrêter l'écoute.
    watch(code, cb) {
      const r = ref('meals/' + code);
      const handler = (snap) => cb(snap.val());
      r.on('value', handler);
      return () => r.off('value', handler);
    },

    async fetch(code) {
      const snap = await ref('meals/' + code).once('value');
      return snap.val();
    },

    // Photos : stockées à part (photos/{CODE}/{id}) pour ne pas alourdir l'écoute des compteurs.
    watchPhotos(code, cb, onError) {
      const r = ref('photos/' + code);
      const handler = (snap) => {
        const v = snap.val() || {};
        cb(Object.entries(v).map(([id, x]) => ({ ...x, id })).sort((a, b) => b.t - a.t));
      };
      r.on('value', handler, onError);
      return () => r.off('value', handler);
    },
    addPhoto(code, photo) {
      const { id, ...data } = photo;
      return ref(`photos/${code}/${id}`).set(data);
    },
    removePhoto(code, id) { return ref(`photos/${code}/${id}`).set(null); },

    onConnection(cb) {
      ref('.info/connected').on('value', (snap) => cb(snap.val() === true));
    },
  };
})();
