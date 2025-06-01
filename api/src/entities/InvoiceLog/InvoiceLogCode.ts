export enum InvoiceLogCode {
  CREATED = "CREATED", // creation de la facture par le user
  UPDATED = "UPDATED", // mise a jour de la facture par le user
  GENERATED = "GENERATED", // generation de la facture par le user
  SENT = "SENT", // envoi de la facture au client
  PAID = "PAID", // paiement de la facture par le client
  CANCELLED = "CANCELLED", // annulation de la facture par le user
  UNPAID = "UNPAID", // facture impayée par le client
}
