import type { expenseCategories } from '../db/schema'

export type ExpenseCategory = (typeof expenseCategories)[number]

/** Devine la catégorie d'une dépense à partir de son libellé (modifiable ensuite). */
export function guessExpenseCategory(text: string): ExpenseCategory {
  const t = text.toLowerCase()
  if (/vps|serveur/.test(t)) return 'VPS'
  if (/domaine|domain|dns/.test(t)) return 'DOMAIN'
  if (/mail|ksuite|kmail/.test(t)) return 'EMAIL'
  if (/h[ée]berg|hosting/.test(t)) return 'HOSTING'
  if (/licen|logiciel|software|abonnement/.test(t)) return 'SOFTWARE'
  // Paiement carte chez l'hébergeur sans détail : hébergement par défaut (modifiable)
  if (/infomaniak/.test(t)) return 'HOSTING'
  return 'OTHER'
}
