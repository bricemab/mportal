# MPortal V2

Outil interne de MDevelopment : clients, services, factures QR suisses, abonnements, contrats de maintenance, dépenses et rapprochement bancaire (relevés BCVS).

- **Mise en production** : voir [DEPLOY.md](DEPLOY.md)
- **Plan fonctionnel** : voir [../PLAN_V2.md](../PLAN_V2.md)

## Stack

Nuxt 4 (Vue 3 + Nitro) · TypeScript strict · Drizzle ORM + MariaDB · Zod · Tailwind CSS 4 · pdfkit + swissqrbill · nuxt-auth-utils (session en cookie scellé) · nuxt-security · Vitest.

## Démarrer en local

Prérequis : Node 20+, une base MariaDB/MySQL vide.

```bash
cp .env.example .env          # puis remplir NUXT_DATABASE_URL, NUXT_SESSION_PASSWORD, NUXT_CRON_SECRET
npm install
npm run db:migrate            # crée les tables (aussi fait automatiquement au démarrage)
npm run user:create -- vous@exemple.ch Prénom Nom
npm run dev
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build de production / démarrage (lit `.env`) |
| `npm test` | Tests unitaires + intégration (`TEST_DATABASE_URL` requis pour l'intégration, base dédiée **effacée à chaque exécution**) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:generate` | Génère une migration SQL après modification de `server/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations en attente |
| `npm run user:create -- email Prénom Nom` | Crée un utilisateur ou réinitialise son mot de passe |
| `npm run legacy:migrate -- [--dry-run] [--reset]` | Reprise des données de l'ancienne application |

Test optionnel sur un vrai relevé (jamais versionné) : `BANK_PDF_SAMPLE=/chemin/releve.pdf npm test`.

## Organisation

```
app/                 Interface (pages, composants, layouts)
server/
  api/               Routes HTTP (validation Zod, aucune logique métier)
  domain/            Logique métier testable (factures, abonnements, banque, PDF…)
  db/                Schéma Drizzle, migrations SQL, migrateur
  middleware/        Garde API : session révocable + contrôle d'origine (anti-CSRF)
  plugins/           Démarrage (config, migrations) et planificateur
shared/utils/        Code partagé front/serveur (montants, dates, référence QR, schémas)
scripts/             Migrations, création d'utilisateur, reprise de l'ancienne app
tests/               Vitest (unitaires et intégration MariaDB)
```

## Règles métier clés

- **Montants en centimes** partout ; quantités à 2 décimales.
- **Numérotation** : suite de l'ancienne application (`INVOICE_NUMBER`), attribution atomique ; référence QR = numéro sur 26 chiffres + clé modulo 10 récursif (identique à la V1).
- **Cycle d'une facture** : brouillon → émise (date et échéance figées, PDF) → envoyée (PDF archivé, plus modifiable) → payée / partiellement payée (paiements multiples) ; soldée (reste abandonné avec motif) ou annulée.
- **Abonnements** : plusieurs lignes facturées ensemble ; facture brouillon générée `SUBSCRIPTION_LEAD_DAYS` jours avant l'échéance, jamais envoyée automatiquement ; rattrapage des échéances manquées avec mention du retard ; modifications appliquées au prochain renouvellement ; terminaison à une date choisie.
- **Contrats de maintenance** : périodes avec quota d'heures, heures restantes calculées, nouvelle période créée au renouvellement de l'abonnement lié.
- **Banque** : import PDF BCVS ou camt.053 ; un même mouvement n'est jamais importé deux fois (empreinte commune aux deux formats) ; rapprochement automatique par référence QR, paiement déjà saisi, prélèvement associé (nom ou IBAN) ou dépense du même montant ; le reste est proposé avec suggestions.

## Sécurité

- Session en cookie `httpOnly`, `SameSite=Strict`, `Secure`, chiffré (iron) ; révocable (version de session en base : déconnexion de tous les appareils, changement de mot de passe).
- Toutes les routes `/api` exigent une session, sauf connexion, santé et tâche planifiée (secret dédié, comparaison à temps constant).
- Requêtes modifiantes : contrôle de l'en-tête `Origin` (anti-CSRF).
- Connexion : bcrypt (coût 12, réhachage transparent des anciens hash), blocage après 5 échecs par email ou 20 par IP sur 30 minutes, réponse identique email inconnu / mauvais mot de passe, limitation de débit.
- En-têtes : CSP stricte avec nonce, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, Permissions-Policy.
- Validation Zod de toutes les entrées ; requêtes SQL paramétrées ; uploads vérifiés par signature (PDF / XML), taille limitée, noms générés côté serveur, stockés hors du dossier public ; XML sans DTD (pas d'XXE).
- Aucun secret dans le code ni dans le bundle front ; journal d'audit de toutes les modifications.
- Vulnérabilités `npm audit` restantes : uniquement dans des outils de développement (`listhen`/`node-forge` du serveur de dev, `esbuild` de drizzle-kit), absents du serveur de production.
