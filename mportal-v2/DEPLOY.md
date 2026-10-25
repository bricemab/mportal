# Mise en production — MPortal V2 sur Infomaniak

Cible : **https://mportal.mdevelopment.ch**, site Node.js sur l'Hébergement Web Infomaniak, base MariaDB Infomaniak.
L'application (interface + API) tourne dans **un seul processus Node** ; l'ancien sous-domaine `mportal-api.mdevelopment.ch` n'est plus utilisé.

> Durée estimée de la bascule : 30 à 45 minutes, dont ~5 minutes d'interruption.

---

## 1. Préparer l'hébergement (sans toucher à la prod actuelle)

1. **Base de données** : dans le Manager Infomaniak, créer une **nouvelle base MariaDB** (ex. `xz0qs_mportal_v2`) et un utilisateur dédié qui n'a les droits que sur cette base. Noter hôte, utilisateur, mot de passe.
2. **Site Node.js** : créer un site Node.js (Manager → Hébergement → Ajouter un site → Node.js), d'abord sur un sous-domaine de test, par ex. `mportal-v2.mdevelopment.ch`.
   - Version de Node : **20 LTS ou plus récente** (22 recommandée).
   - Dossier d'exécution : le dossier qui contient `package.json` de `mportal-v2`.
   - Commande de build : `npm ci && npm run build`
   - Commande de démarrage : `npm start`
   - Port : celui proposé par Infomaniak (transmis à l'application par la variable `PORT`, géré automatiquement).
   - Activer le certificat SSL (Let's Encrypt).
3. **Code** : en SSH, cloner le dépôt puis se placer sur la branche `v2` :
   ```bash
   git clone https://github.com/bricemab/mportal.git && cd mportal && git checkout v2 && cd mportal-v2
   ```
4. **Configuration** : créer `mportal-v2/.env` à partir de `.env.example` (`chmod 600 .env`) :
   - `NUXT_DATABASE_URL=mysql://UTILISATEUR:MOT_DE_PASSE@HOTE:3306/BASE` (encoder les caractères spéciaux du mot de passe, ex. `@` → `%40`)
   - `NUXT_SESSION_PASSWORD` et `NUXT_CRON_SECRET` : valeurs aléatoires **différentes**, générées avec
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   - `NUXT_STORAGE_DIR=/home/clients/…/mportal-storage` : dossier **hors** du dossier de l'application (sinon les PDF archivés et contrats seraient perdus au prochain déploiement). Le créer avec `mkdir -p … && chmod 700 …`.
5. Lancer le build et démarrer le site depuis le tableau de bord Infomaniak. Au premier démarrage, l'application crée toutes les tables (migrations automatiques). Vérifier : `https://mportal-v2.mdevelopment.ch/api/health` → `{"status":"ok"}`.

> Le serveur **refuse de démarrer** si `NUXT_DATABASE_URL`, `NUXT_SESSION_PASSWORD` (≥ 32 caractères) ou `NUXT_CRON_SECRET` (≥ 24 caractères) manquent : consulter les logs du site.

## 2. Répétition de la migration (recommandé, sans interruption)

Depuis le serveur (SSH) ou un poste qui a accès aux deux bases :

```bash
cd mportal-v2
LEGACY_DATABASE_URL="mysql://…/xz0qs_mportal" npm run legacy:migrate -- --dry-run
```

Le script lit l'ancienne base (lecture seule), simule tout l'import dans une transaction et **affiche les contrôles** :
- nombre de clients, factures, lignes et heures identiques ;
- chiffre d'affaires et coûts **par année identiques au centime** ;
- unicité des références QR, numérotation reprise.

En cas d'échec d'un contrôle, rien n'est écrit. Les « points à vérifier » listés sont informatifs.

Pour tester l'application avec les vraies données sur le sous-domaine de test, lancer ensuite la migration réelle (sans `--dry-run`) ; elle pourra être refaite le jour J avec `--reset`.

## 3. Jour J : bascule

1. **Geler l'ancienne app** : prévenir Théo, puis arrêter l'ancien site Node (API) dans le Manager.
2. **Sauvegarde** de l'ancienne base : Manager → Bases de données → Sauvegarde/Export (ou `mysqldump`). Conserver le fichier en lieu sûr, **jamais dans Git**.
3. **Migration réelle** (les données de test éventuelles sont effacées) :
   ```bash
   LEGACY_DATABASE_URL="mysql://…/xz0qs_mportal" npm run legacy:migrate -- --reset
   ```
   Vérifier que tous les contrôles sont marqués ✔.
4. **Redémarrer** le site V2.
5. **Domaine** : dans le Manager, rattacher `mportal.mdevelopment.ch` au site Node.js V2 (et retirer l'ancien site front), activer le SSL sur ce domaine.
6. **Vérifications manuelles** :
   - connexion de Brice et Théo (les mots de passe actuels restent valables) ;
   - tableau de bord : chiffres cohérents ;
   - 3 factures au hasard : montant, référence QR, PDF ;
   - Banque : importer le dernier relevé PDF BCVS → les paiements récents se rapprochent automatiquement ;
   - Abonnements : vérifier la liste déduite (voir ci-dessous).
7. **Garder l'ancienne base et l'ancien code** quelques semaines, puis les supprimer.

## 4. Tâche quotidienne

L'application génère elle-même les factures d'abonnement (au démarrage puis toutes les heures, opération idempotente).
En complément, créer une **tâche planifiée** Infomaniak quotidienne (Manager → Hébergement → Tâches planifiées) qui appelle :

```
https://mportal.mdevelopment.ch/api/cron/daily?token=VALEUR_DE_NUXT_CRON_SECRET
```

(ou en POST avec l'en-tête `Authorization: Bearer VALEUR_DE_NUXT_CRON_SECRET`).

## 5. Comptes utilisateurs

Les comptes de l'ancienne application sont repris avec leurs mots de passe. Pour créer un compte ou réinitialiser un mot de passe (en SSH) :

```bash
npm run user:create -- email@exemple.ch Prénom Nom
```

Le mot de passe est demandé de façon interactive (12 caractères min., majuscule, minuscule, chiffre). Toutes les sessions de l'utilisateur sont invalidées.

## 6. Mises à jour ultérieures

```bash
git pull && npm ci && npm run build
```
puis redémarrer le site. Les nouvelles migrations de base sont appliquées automatiquement au démarrage.

## 7. Sauvegardes

À sauvegarder régulièrement : la base MariaDB **et** le dossier `NUXT_STORAGE_DIR` (PDF des factures envoyées, contrats).
