export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "Non défini";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch (e) {
    return "Date invalide";
  }
}

export function formatDateOnly(dateString: string | undefined | null) {
  if (!dateString) return "Non défini";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
    }).format(new Date(dateString));
  } catch (e) {
    return "Date invalide";
  }
}

export function formatCurrency(amount: number | undefined | null) {
  if (amount === undefined || amount === null) return "Sur devis";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
