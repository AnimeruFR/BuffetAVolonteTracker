# 🍽️ Buffet Tracker

Une application pour téléphone qui suit **ce que vous mangez au buffet à volonté** : un tap par pièce, et à la fin un bilan clair de ce qui a été consommé, en quelle quantité.

## Fonctionnalités

- **Un tap = une pièce** : grosses cartes avec emoji, compteur sur chaque plat, petite animation et vibration.
- **Corriger facilement** : bouton `−` sur le plat, appui long, ou « Annuler » dans la notification.
- **En groupe** : ajoutez les membres du groupe au début du repas, puis choisissez « Qui mange ? » avant de taper sur les plats.
- **Bilan du groupe** 👥 : total des pièces, calories estimées, durée, moyenne par personne, résumé de chaque membre (rang, plats favoris) et répartition par catégorie et plat par plat, avec la part de chacun en couleur.
- **Bilan par personne** 👤 : touchez un membre (ou son prénom en haut du Bilan) pour voir son résumé : rang, part du groupe, comparaison à la moyenne, plat préféré, plats différents, catégories et détail plat par plat.
- **Historique** de tous vos buffets passés.
- **Carte personnalisable** (⚙️) : environ 40 plats par défaut (sushis, entrées, plats chauds, grillades, fruits de mer, desserts, boissons), et vous pouvez ajouter, modifier ou supprimer des plats.
- **Partage** du bilan du groupe ou d'une personne (SMS, WhatsApp…).
- **Fonctionne hors-ligne**, mode sombre automatique, et **aucune donnée ne quitte le téléphone** (stockage local).

## Installer sur son téléphone

C'est une *Progressive Web App* : elle n'a pas besoin de store.

1. Hébergez le dossier sur un serveur HTTPS. Le plus simple : **GitHub Pages** (Settings → Pages → *Deploy from a branch* → choisir la branche et `/ (root)`).
2. Ouvrez l'adresse sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*.
   - **Android (Chrome)** : menu ⋮ → *Installer l'application*.
3. L'icône apparaît sur l'écran d'accueil et l'application s'ouvre en plein écran, même sans réseau.

## Lancer en local

```bash
npx http-server -c-1 .
# puis ouvrir http://localhost:8080
```

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Squelette de l'application |
| `styles.css` | Design (thème clair/sombre, animations) |
| `app.js` | Logique : repas, compteurs, bilan, historique, carte |
| `sw.js` | Service worker pour le mode hors-ligne |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil |

> Les calories sont des estimations moyennes par pièce/portion, à titre indicatif.
