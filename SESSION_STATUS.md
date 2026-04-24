# Session Status

Derniere mise a jour: 2026-04-24

## Etat actuel

Le projet n'est pas encore en phase de finalisation / mise en production.

Le front et le backend local fonctionnent, mais il reste encore beaucoup de travail produit, technique et UX avant mise en ligne.

## Ce qui est deja fait

- Branche de travail actuelle: `codex-tva-audit-branding-cleanup`
- Chat equipe dans le widget:
  - canal `Projet`
  - conversations `Prive`
  - badges `non lus`
- Chat IA branche sur `backend-node`
- Base d'administration globale commencee:
  - route frontend globale `/admin`
  - page [frontend/src/pages/AdminPage.jsx](frontend/src/pages/AdminPage.jsx)
  - bouton `Admin` depuis l'ecran des dossiers pour les comptes `admin`
  - backend admin users dans [backend-node/server.js](backend-node/server.js)
- Roles decides:
  - `admin`
  - `collab`
  - `invite`
- Nouveau login redesign en cours dans [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)

## Decision produit importante

Stack IA retenue en principe:

- `Google Document AI` pour l'extraction documentaire
- `OpenAI / ChatGPT` pour le chat
- `Claude` a retirer progressivement si possible

Modules Google a garder:

- `Invoice Parser`
- `Bank Statement Parser`
- `Form Parser` seulement en fallback sur documents mal lus / atypiques

## Decision UX importante

Pour les factures mal lues, l'idee retenue est:

- extraction normale par defaut
- bouton manuel dans l'interface: `Lecture avancee`
- usage:
  - si la facture est mal lue
  - si elle est incomplete
  - si le format est atypique

Texte produit retenu:

- bouton: `Lecture avancee`
- aide: `A utiliser si la facture est incomplete, mal lue ou au format atypique.`

## Ce qui reste a faire en priorite

### 1. Admin global

Objectif:
- rendre l'admin vraiment accessible sans entrer dans un dossier

Etat:
- la base existe
- il faut encore verifier / polir tout le flow

Reste:
- tester la page `/admin`
- verifier les permissions
- verifier les creations / updates utilisateurs
- harmoniser le design

### 2. Gestion des acces

Roles retenus:
- `admin`
- `collab`
- `invite`

Reste:
- definir clairement ce que chaque role peut faire
- limiter les vues / actions selon le role
- ajouter plus tard permissions par dossier si necessaire

### 3. Extraction Google

Reste:
- brancher vraiment `Google Document AI`
- mettre `Invoice Parser` en extraction par defaut
- mettre `Form Parser` uniquement en fallback ou via bouton `Lecture avancee`
- brancher `Bank Statement Parser` pour les releves

### 4. Simplification IA

Reste:
- enlever la dependance Claude progressivement
- centraliser le chat sur OpenAI
- eviter d'utiliser trop de providers pour le meme besoin

### 5. Login / interface

Reste:
- continuer a simplifier l'ecran de connexion
- corriger les accents visibles dans l'UI
- alleger les interfaces encore trop chargees

## Fichiers les plus importants a reprendre en premier

- [backend-node/server.js](backend-node/server.js)
- [frontend/src/pages/AdminPage.jsx](frontend/src/pages/AdminPage.jsx)
- [frontend/src/pages/Dossiers.jsx](frontend/src/pages/Dossiers.jsx)
- [frontend/src/pages/Login.jsx](frontend/src/pages/Login.jsx)
- [frontend/src/pages/SettingsPage.jsx](frontend/src/pages/SettingsPage.jsx)
- [frontend/src/components/ChatBot.jsx](frontend/src/components/ChatBot.jsx)
- [frontend/src/api/index.js](frontend/src/api/index.js)

## Point de reprise conseille pour la prochaine session

1. Ouvrir `/admin`
2. verifier que l'acces global admin marche bien
3. tester les roles `admin / collab / invite`
4. commencer l'integration `Google Document AI`
5. ajouter le bouton `Lecture avancee` dans le flow d'extraction facture

## Note importante

Il y a encore des modifications locales non poussees apres le dernier push GitHub.

Avant de finir une prochaine session:
- verifier `git status`
- commit proprement
- push sur `codex-tva-audit-branding-cleanup`
