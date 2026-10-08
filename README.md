# 🍽️ Buffet Tracker

Une application pour téléphone qui suit **ce que vous mangez au buffet à volonté** : un tap par pièce, et à la fin un bilan clair de ce qui a été consommé, en quelle quantité.

## Fonctionnalités

- **Un tap = une pièce** : grosses cartes avec emoji, compteur sur chaque plat, petite animation et vibration.
- **Corriger facilement** : bouton `−` sur le plat, appui long, ou « Annuler » dans la notification.
- **Partagé entre les téléphones du groupe** 👥 : chacun installe l'application, rejoint le repas avec un **code à 6 caractères** ou un **lien d'invitation**, et suit ce qu'il mange. Tous les compteurs, la carte et les bilans se mettent à jour en temps réel chez tout le monde. On peut aussi ajouter quelqu'un qui n'a pas de téléphone et taper pour lui.
- **Bilan du groupe** 👥 : total des pièces, calories estimées, durée, moyenne par personne, résumé de chaque membre (rang, plats favoris) et répartition par catégorie et plat par plat, avec la part de chacun en couleur.
- **Bilan par personne** 👤 : touchez un membre (ou son prénom en haut du Bilan) pour voir son résumé : rang, part du groupe, comparaison à la moyenne, plat préféré, plats différents, catégories et détail plat par plat.
- **Historique** de tous vos buffets passés.
- **Carte personnalisable** (⚙️) : environ 40 plats par défaut (sushis, entrées, plats chauds, grillades, fruits de mer, desserts, boissons), et vous pouvez ajouter, modifier ou supprimer des plats.
- **Partage** du bilan du groupe ou d'une personne (SMS, WhatsApp…).
- **Fonctionne hors-ligne**, mode sombre automatique. Sans partage, les données restent sur le téléphone ; les repas partagés sont stockés dans votre propre base Firebase.

## Installer sur son téléphone

C'est une *Progressive Web App* : elle n'a pas besoin de store.

1. Hébergez le dossier sur un serveur HTTPS. Le plus simple : **GitHub Pages** (Settings → Pages → *Deploy from a branch* → choisir la branche et `/ (root)`).
2. Ouvrez l'adresse sur le téléphone :
   - **iPhone (Safari)** : bouton Partager → *Sur l'écran d'accueil*.
   - **Android (Chrome)** : menu ⋮ → *Installer l'application*.
3. L'icône apparaît sur l'écran d'accueil et l'application s'ouvre en plein écran, même sans réseau.

## Activer le partage en groupe (une seule fois, ~5 minutes, depuis le téléphone)

Pour que les téléphones du groupe partagent les mêmes données, l'application a besoin d'une petite base de données en ligne. On utilise **Firebase Realtime Database** de Google, gratuite pour cet usage. **Une seule personne** le fait ; les autres reçoivent automatiquement la configuration avec le lien d'invitation.

Dans l'application : ⚙️ → **Activer le partage en groupe**, puis suivez les 4 étapes affichées :

1. **Ouvrir Firebase** (https://console.firebase.google.com) → « Créer un projet ». Google Analytics n'est pas nécessaire.
2. Menu ☰ → **Créer → Realtime Database → Créer une base de données**. Emplacement en Europe (`europe-west1`), puis **mode verrouillé**.
3. Onglet **Règles** : effacez tout, collez les règles (bouton **Copier les règles** dans l'application), puis **Publier**.
4. Onglet **Données** : copiez l'adresse affichée en haut (`https://…firebasedatabase.app`), collez-la dans l'application et touchez **Activer**.

L'application vérifie que la base répond et que les règles sont bien publiées.

> Alternative pour un usage public : remplir `firebase-config.js` avec la configuration du projet. Tous les utilisateurs utilisent alors cette base sans rien activer.

### Utilisation en groupe

1. Une personne **commence le repas**, entre son prénom et laisse « Partager avec le groupe » activé.
2. Elle **envoie le lien** (WhatsApp, SMS…) ou donne le **code** affiché.
3. Les autres ouvrent le lien (rien à configurer) puis choisissent leur prénom ou s'ajoutent. Une fois le lien utilisé une première fois, ils peuvent aussi rejoindre les repas suivants avec le seul code.
4. Chacun tape sur ce qu'il mange. L'onglet **Bilan** montre le résumé du groupe et celui de chaque personne, en direct.
5. **Terminer le repas** le termine pour tout le monde ; il apparaît dans l'historique de chacun.

Le point vert « Synchronisé » en haut indique que le téléphone est connecté. Hors connexion, on peut continuer à taper : tout est envoyé au retour du réseau, tant que l'application reste ouverte.

> **Confidentialité** : toute personne qui connaît le code d'un repas peut le voir et le modifier. Les codes sont aléatoires et la liste des repas n'est pas consultable, mais n'y mettez rien de sensible. La clé `apiKey` de Firebase n'est pas un secret : elle est faite pour être publique.

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
| `sync.js` | Synchronisation des repas partagés (Firebase Realtime Database) |
| `firebase-config.js` | Configuration Firebase optionnelle (sinon, activation dans l'application) |
| `database.rules.json` | Règles de sécurité à coller dans Firebase |
| `sw.js` | Service worker pour le mode hors-ligne |
| `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil |

> Les calories sont des estimations moyennes par pièce/portion, à titre indicatif.
