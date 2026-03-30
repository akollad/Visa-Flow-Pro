export function formatDate(dateString: string | number | undefined | null) {
  if (dateString === undefined || dateString === null || dateString === "") return "Non défini";
  try {
    const d = typeof dateString === "number" ? new Date(dateString) : new Date(dateString);
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Date invalide";
  }
}

export function formatDateOnly(dateString: string | number | undefined | null) {
  if (dateString === undefined || dateString === null || dateString === "") return "Non défini";
  try {
    const d = typeof dateString === "number" ? new Date(dateString) : new Date(dateString);
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
    }).format(d);
  } catch {
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
