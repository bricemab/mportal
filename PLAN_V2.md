# MPortal V2 — Plan de refonte

> Statut : **brouillon à valider**. Rien n'est codé tant que ce document n'est pas validé.
> Date : 25.10.2026

## 1. Objectif et contraintes

Remplacer l'application actuelle (Express + TypeORM / Vue 3) par une V2 propre, en gardant les données de production et les idées qui fonctionnent.

| Contrainte | Valeur |
|---|---|
| Base de données | MariaDB chez Infomaniak (actuellement 10.6) |
| Hébergement Node | Hébergement Web Infomaniak, site Node.js |
| Utilisateurs | 2 (Brice, Théo), mêmes droits |
| Hors périmètre V1 | Envoi d'emails, TVA, devis |
| Numérotation | On **continue la suite actuelle** (`INVOICE_NUMBER`), références QR inchangées |
| Remplacement | La V2 remplace la prod actuelle (bascule avec migration des données) |

## 2. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3 + serveur Nitro) | Un seul process Node à déployer, front et API dans le même projet, types partagés |
| ORM | **Drizzle ORM** + driver `mysql2` | Schéma typé en TS, **migrations SQL versionnées** (fin de `synchronize: true`) |
| Validation | **Zod** | Mêmes schémas côté formulaire et côté API |
| UI | Tailwind CSS 4 + composants maison (thème sombre actuel conservé) | Continuité visuelle |
| Graphiques | Chart.js (vue-chartjs) | Déjà utilisé |
| Auth | Session en **cookie httpOnly** chiffré (`nuxt-auth-utils`), bcrypt | Plus de JWT en localStorage, plus de HMAC côté client |
| PDF | `pdfkit` + `swissqrbill` | Déjà maîtrisé, rendu actuel conservé |
| Import bancaire | `fast-xml-parser` (camt.053) | Format ISO 20022 standard |
| Tests | Vitest | Calculs critiques : montants, référence QR, abonnements, rapprochement |

Règles : TypeScript strict, **aucun `any`**, montants en **centimes (entiers)**, dates métier en `DATE`, horodatages en UTC.

## 3. Modèle de données

### 3.1 Référentiel

**`user`** — id, firstname, lastname, email (unique), password_hash, last_login_at, created_at, updated_at

**`login_attempt`** — email, ip, user_agent, success, created_at
→ Blocage 30 min après 5 échecs sur 15 min (même règle qu'aujourd'hui, mais historisée).

**`client`** — id, name, firstname, lastname, email, phone, street, street_number (texte : « 12a »), postal_code (texte), city, country (défaut `CH`), remark, archived_at
→ Le client « MDevelopment » (id 1) **disparaît** : ses factures deviennent des dépenses (voir migration).

**`service`** (catalogue) — id, name, description, kind (`ONE_SHOT` | `RECURRING`), default_price_cents (optionnel), default_cost_cents (optionnel), archived_at
→ Les prix réels sont négociés par client et vivent dans l'abonnement ou la ligne de facture. Pas de grille tarifaire.

**`setting`** — key, value : `INVOICE_NUMBER`, `COMPANY_NAME`, `COMPANY_ADDRESS…`, `QR_IBAN` (pour les PDF), `IBAN` (pour vérifier les relevés), `SUBSCRIPTION_LEAD_DAYS`, `INVOICE_DUE_DAYS` (30).

### 3.2 Abonnements (nouveau)

Un abonnement = **un client + une échéance commune + plusieurs lignes**, facturées ensemble sur **une seule facture** (ex. hébergement + nom de domaine + pack mails + maintenance).

**`subscription`** — id, client_id, name (« Hébergement & domaine »), period (`YEARLY` | `MONTHLY`), start_date, next_billing_date, end_date (nullable), status (`ACTIVE` | `ENDED`), notes, created_at, updated_at

**`subscription_line`** — id, subscription_id, service_id, label (ex. « hdnl.ch »), quantity, unit_price_cents (prix client), unit_cost_cents (coût fournisseur, optionnel), position, created_at, ended_at (nullable)

Règles :
- **Génération** : chaque jour, pour chaque abonnement actif dont `next_billing_date - SUBSCRIPTION_LEAD_DAYS <= aujourd'hui`, création d'une **facture brouillon** avec les lignes actives, puis `next_billing_date += 1 an / 1 mois`. Jamais d'envoi automatique.
- **Modification** (ex. ajout d'une adresse mail) : on modifie quantité/prix de la ligne, l'effet s'applique **au prochain renouvellement**. Pas de prorata.
- **Terminer** : bouton « Terminer l'abonnement » → `end_date` + `status = ENDED`, plus aucune génération après la date de fin.
- **Marge** : chaque ligne connaît son prix et son coût → marge par abonnement et globale.
- Toute modification est tracée dans l'audit log.

### 3.3 Contrats de maintenance

Le contrat de maintenance est une **ligne d'abonnement annuel** (service « Contrat de maintenance ») + un suivi d'heures.

**`maintenance_contract`** — id, client_id, subscription_line_id (nullable), name, hours_per_period (décimal), file_path (PDF uploadé), start_date, end_date (nullable), status (`ACTIVE` | `ENDED`)

**`maintenance_period`** — id, contract_id, start_date, end_date, hours_quota, invoice_id (nullable)

**`time_entry`** — id, period_id, date, hours (décimal, ex. 1.5), description, user_id

Règles :
- **Heures restantes calculées** = quota de la période − somme des `time_entry` (plus de compteur stocké qui dérive).
- À chaque renouvellement de l'abonnement, nouvelle `maintenance_period` créée (quota remis à zéro).
- **Terminer** le contrat quand on veut (même logique que l'abonnement).
- **Rapport d'heures PDF** par période, pour le client.
- Alerte dashboard : contrats dont la période se termine dans 30 jours ou dont le quota est presque épuisé.

### 3.4 Factures

**`invoice`** — id, number (BIGINT unique), qr_reference (CHAR(27) unique), client_id, subscription_id (nullable), title, issue_date (nullable tant que brouillon), due_date, status, written_off_at, write_off_reason, created_at, updated_at

**`invoice_line`** — id, invoice_id, service_id, label, quantity (décimal), unit_price_cents, unit_cost_cents (optionnel), position

**`invoice_event`** (timeline) — id, invoice_id, type, message, user_id, created_at

**`payment`** — id, invoice_id, amount_cents, paid_at, bank_transaction_id (nullable), note

Statuts :

| Statut | Signification | Modifiable |
|---|---|---|
| `DRAFT` | Créée (manuellement ou par un abonnement) | Oui |
| `ISSUED` | PDF généré, date d'émission figée | Oui tant que non envoyée (régénère le PDF) |
| `SENT` | Envoyée au client | Non (annuler et recréer) |
| `PARTIALLY_PAID` | Calculé : 0 < payé < total | — |
| `PAID` | Calculé : payé ≥ total | — |
| `WRITTEN_OFF` | **Soldée** : reste dû abandonné, avec motif (ex. départ client, prorata) | — |
| `CANCELLED` | Annulée | — |

Règles :
- **Numéro** attribué de façon atomique (transaction + `SELECT … FOR UPDATE` sur le setting) — fin du risque de doublon.
- **Date de la facture** = `issue_date`, figée à la 1re génération du PDF (aujourd'hui : date du jour à chaque régénération).
- **PDF archivé** sur disque à l'envoi : on garde exactement ce que le client a reçu.
- « En retard » = calculé (`SENT` ou `PARTIALLY_PAID` et `due_date` dépassée), plus besoin d'un état `UNPAID` manuel.
- PDF multi-pages si beaucoup de lignes.
- Création du client **directement depuis le formulaire de facture**.

### 3.5 Dépenses et banque

**`expense`** — id, date, amount_cents, supplier (ex. « Infomaniak »), category, label, client_id (nullable), invoice_id (nullable : coût lié à une facture client), subscription_line_id (nullable), bank_transaction_id (nullable)

Catégories proposées : `DOMAIN`, `HOSTING`, `VPS`, `EMAIL`, `SOFTWARE`, `HARDWARE`, `OTHER` (liste modifiable).

**`bank_import`** — id, file_name, file_hash (unique), iban, period_from, period_to, imported_at, user_id

**`bank_transaction`** — id, import_id, bank_ref (`AcctSvcrRef`, unique), booking_date, value_date, amount_cents, direction (`CREDIT` | `DEBIT`), counterparty, remittance_info, qr_reference (si présente), kind (`INVOICE_PAYMENT` | `EXPENSE` | `PARTNER_WITHDRAWAL` | `OTHER` | `UNCLASSIFIED`), partner_user_id (nullable), status (`PENDING` | `MATCHED` | `IGNORED`)

→ La case « Charge payée par MDev » de la création de facture crée directement une **dépense liée** (fin des fausses factures sur le client 1).

### 3.6 Audit

**`audit_log`** — id, user_id, entity, entity_id, action, changes (JSON), created_at
**`legacy_history`** — copie brute de l'ancienne table `history` (archive, lecture seule).

## 4. Import bancaire (relevés BCV)

Format retenu : **camt.053** exporté depuis l'e-banking BCV avec **« Transactions individuelles avec détails »** (à confirmer avec un fichier d'exemple : l'export « Relevé de compte » ne contient pas les références QR des crédits).

Déroulement :
1. Upload du fichier → vérification de l'IBAN du relevé (`IBAN` en setting) et du hash (pas de double import).
2. Chaque écriture (et chaque sous-transaction d'un lot) devient une `bank_transaction`, dédoublonnée par `AcctSvcrRef`.
3. Rapprochement automatique proposé :
   - **Crédit avec référence QR** → facture correspondante, paiement créé.
   - **Crédit sans référence** → facture ouverte avec le même reste dû, datée avant le paiement. Une seule candidate : proposée. Plusieurs : choix manuel. Aucune : « non rapproché » (paiement partiel possible sur une facture choisie).
   - **Débit carte Infomaniak** → proposé comme dépense ; si une dépense prévue de même montant existe (coût d'abonnement), elle est reliée.
   - **Virement vers Brice / Théo** → prélèvement associé.
4. Écran de validation : tout est proposé, rien n'est appliqué sans un clic.

**Import PDF** : faisable par extraction de texte, mais fragile (dépend de la mise en page BCV). À évaluer uniquement si un exemple de PDF « avec détails » contient des informations que le camt.053 n'a pas. Le camt.053 reste la voie principale.

## 5. Indicateurs (dashboard)

Définitions claires, toutes basées sur des dates explicites :

| Indicateur | Définition |
|---|---|
| CA facturé | Somme des factures émises (`issue_date`) hors annulées ; une facture soldée compte pour le montant encaissé |
| Encaissé | Somme des `payment` (`paid_at`) |
| Dépenses | Somme des `expense` (`date`) |
| Résultat | Encaissé − dépenses (prélèvements associés **exclus**) |
| Prélèvements associés | Par associé, par période |
| Marge abonnements | Prix − coût des lignes actives (revenu récurrent annuel) |
| À encaisser | Reste dû des factures envoyées, dont en retard |

Plus : graphique mensuel (facturé / encaissé / dépenses), meilleur client, prochains renouvellements (30 jours), contrats de maintenance à surveiller, transactions bancaires non rapprochées.

## 6. Écrans

1. **Connexion**
2. **Dashboard**
3. **Clients** — liste, fiche client (factures, abonnements, contrats, solde ouvert)
4. **Services** — catalogue
5. **Factures** — liste (filtres et pagination côté serveur), création/édition, timeline, paiements, solder, PDF
6. **Abonnements** — liste (prochaine échéance, marge), création/édition, terminer, « générer maintenant »
7. **Contrats de maintenance** — liste, détail (périodes, heures, rapport PDF, fichier du contrat)
8. **Dépenses** — liste, création manuelle
9. **Banque** — imports, transactions, rapprochement
10. **Paramètres** — coordonnées société, IBAN / QR-IBAN, numérotation, délais
11. **Journal** — audit log

## 7. Sécurité

- Secrets uniquement en variables d'environnement (`.env` local, variables Infomaniak en prod), `.env.example` commité.
- Session cookie httpOnly + SameSite, expiration glissante. Aucune clé dans le bundle front.
- Validation Zod sur toutes les entrées, requêtes paramétrées (Drizzle).
- Uploads : PDF uniquement, taille limitée, stockés hors du dossier public, servis via une route authentifiée.
- Route de tâche planifiée protégée par un secret dédié.
- **À faire dès maintenant sur la prod actuelle** : changer le secret JWT (il est présent dans le bundle front).

## 8. Migration des données

Script TypeScript (`scripts/migrate-legacy.ts`) : **ancienne base → nouvelle base**, rejouable, avec mode `--dry-run`.

### 8.1 Correspondances

| Ancien | Nouveau |
|---|---|
| `user` | `user` (hash bcrypt conservé, les mots de passe restent valables) |
| `client` (sauf id 1) | `client` (IDs conservés) |
| `service` | `service` (« Pack 7 adresses mails », « Mail H1 », « kSuite » conservés tels quels ; regroupement possible plus tard) |
| `invoice` + `invoice_service` (clients ≠ 1) | `invoice` + `invoice_line` (IDs, numéros, références conservés ; montants → centimes) |
| `invoice` du client 1 (factures « MDev ») | `expense`, reliée à la facture client correspondante (même nom, créée dans la même minute) quand elle existe |
| `invoice_log` | `invoice_event` |
| États | `CREATED`/`UPDATED` → `DRAFT` ; `GENERATED` → `ISSUED` ; `SENT`/`UNPAID` → `SENT` ; `PAID` → `SENT` + `payment` du montant total, daté du log `PAID` ; `CANCELLED` → `CANCELLED` |
| `issue_date` | Date du 1er log `GENERATED`, sinon date de création |
| `maintenance_contract` + `contract_hour` | `maintenance_contract` + `maintenance_period` + `time_entry` (heures restantes recalculées → écart signalé : contrat 1 = 5 h calculées vs 4 h stockées) |
| `contract_invoice` | `maintenance_period.invoice_id` |
| `setting.INVOICE_NUMBER` | `setting.INVOICE_NUMBER` (suite conservée) |
| `connexion_log` | non migré (repart à zéro) |
| `history` | `legacy_history` (archive brute) |
| — | `subscription` : **proposés** à partir des dernières factures annuelles de chaque client, puis validés manuellement avant import |

### 8.2 Contrôles automatiques (le script échoue si un contrôle échoue)

- Nombre de clients, factures, lignes, heures identique (hors client 1 et archivés).
- Total facturé par année identique au centime près.
- Total des dépenses = total des anciennes factures du client 1.
- Résultat net par année identique à l'ancien calcul du dashboard.
- Unicité des numéros et références QR, dernier numéro = `INVOICE_NUMBER`.
- Rapport des anomalies (heures, factures sans log, dates incohérentes).

### 8.3 Après migration

- Import du relevé camt.053 2026 → rapprochement des paiements récents (ex. facture #50, paiement partiel Campo SA → solder la facture #48 avec motif).
- Revue et validation des abonnements proposés.

## 9. Déploiement Infomaniak

À vérifier sur l'offre (version de Node disponible, commande de démarrage, port, tâches planifiées, dossier persistant) :

- Build `nuxt build` (preset `node-server`), démarrage `node .output/server/index.mjs`.
- Variables d'environnement : `DATABASE_URL`, `NUXT_SESSION_PASSWORD`, `CRON_SECRET`, `STORAGE_DIR`.
- Migrations Drizzle exécutées au déploiement (`drizzle-kit migrate`).
- Tâche planifiée Infomaniak quotidienne → `POST /api/cron/daily` (génération des abonnements). Filet de sécurité : la génération est aussi vérifiée à l'ouverture du dashboard.
- Fichiers (PDF de factures envoyées, contrats) dans `STORAGE_DIR`, hors du dossier de build, inclus dans les sauvegardes.

### Bascule

1. Recette complète de la V2 sur une base de test alimentée par une copie de la prod.
2. Jour J : ancienne app en lecture seule (ou arrêtée), dump de sauvegarde de la prod.
3. Migration dans la nouvelle base, contrôles verts.
4. Démarrage de la V2, vérifications manuelles (dashboard, 3 factures au hasard, PDF).
5. Bascule du domaine `mportal.mdevelopment.ch` vers la V2 ; ancienne app et ancienne base conservées quelques semaines.

## 10. Lots de développement

| Lot | Contenu |
|---|---|
| 0 | Initialisation Nuxt, Drizzle, schéma + migrations, auth, layout |
| 1 | Clients, services, factures (CRUD, PDF QR-bill, timeline, paiements, solder) |
| 2 | Script de migration + contrôles (testé sur le dump de prod) |
| 3 | Abonnements (génération, terminer, marge) |
| 4 | Contrats de maintenance (périodes, heures, upload, rapport PDF) |
| 5 | Dépenses + import bancaire camt.053 + rapprochement |
| 6 | Dashboard, paramètres, journal |
| 7 | Recette, déploiement Infomaniak, bascule |

Les lots 0 à 2 permettent déjà de remplacer l'existant ; les lots 3 à 5 apportent les nouveautés.

## 11. Points ouverts

1. **Fichier camt.053 « avec détails »** : à fournir pour confirmer la présence des références QR.
2. **Délai de génération** des abonnements avant l'échéance (proposition : 30 jours).
3. **Définitions du dashboard** (section 5) : à valider.
4. **Renouvellements possiblement oubliés** détectés dans les données (voir analyse) : à vérifier avant d'importer les abonnements.
5. **Offre Infomaniak** : version de Node et tâches planifiées à confirmer.
