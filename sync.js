/* Synchronisation des repas de groupe via Firebase Realtime Database.
 * Chaque repas partagé vit sous /meals/{CODE} ; tous les téléphones qui connaissent
 * le code lisent et écrivent au même endroit, en temps réel. */
window.BuffetSync = (() => {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I/L, pour éviter les confusions
  let db = null;

  const configured = () => !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  const ready = () => !!db;

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
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
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
    configured,
    ready,
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

    onConnection(cb) {
      ref('.info/connected').on('value', (snap) => cb(snap.val() === true));
    },
  };
})();
