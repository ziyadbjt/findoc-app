export function formatMAD(n) {
  if (n == null || isNaN(n)) return "—";
  const neg = n < 0;
  const parts = Math.abs(n).toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return (neg ? "−" : "") + parts.join(",");
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function daysBetween(iso1, iso2) {
  if (!iso1 || !iso2) return 0;
  return Math.round((new Date(iso2) - new Date(iso1)) / (1000 * 60 * 60 * 24));
}

export function enrichDossier(d) {
  const words = (d.raison_sociale || "").toUpperCase().split(/\s+/).filter(Boolean);
  const initials = words.length >= 2 ? words[0][0] + words[1][0] : (d.raison_sociale || "XX").slice(0, 2).toUpperCase();
  const computedHue = Math.abs((d.raison_sociale || "").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)) % 360;
  const hue = d.logo_hue != null ? d.logo_hue : computedHue;
  return { ...d, initials, hue };
}

export function enrichFacture(f) {
  const defaults = {
    num_facture: f.nom_fichier?.replace(/\.pdf$/i, "") || "—",
    date_echeance: f.date_facture
      ? new Date(new Date(f.date_facture).getTime() + 30 * 864e5).toISOString().slice(0, 10)
      : null,
    tva_taux: f.montant_ht > 0 ? Math.round((f.tva / f.montant_ht) * 100) : 20,
    paiement: "en_attente",
    confidence: 0.95,
    categorie: "—",
    compte_pcm: "",
    notes: "",
  };
  return { ...defaults, ...f };
}
