import { useCallback } from "react";
import { recordCorrection } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

/**
 * Hook réutilisable — enregistre une correction FinAI depuis n'importe quel endroit de l'UI.
 *
 * Usage:
 *   const correct = useCorrection(dossierId);
 *   correct({ facture, champ: "compte_pcm", original: "6111000", corrige: "6135000" });
 */
export function useCorrection(dossierId) {
  const { token } = useAuth();
  const toast = useToast();

  return useCallback(async ({ facture, champ, original, corrige }) => {
    if (!corrige?.trim() || corrige === original) return;
    try {
      await recordCorrection(token, {
        dossier_id: Number(dossierId),
        facture_id: facture?.id ?? null,
        fournisseur: facture?.fournisseur ?? "",
        description: facture?.categorie ?? "",
        montant: facture?.montant_ht ?? 0,
        champ,
        valeur_originale: original ?? "",
        valeur_corrigee: corrige.trim(),
      });
      toast("FinAI a appris cette correction", "pos");
    } catch {
      // silencieux — ne pas bloquer l'UX pour un échec d'apprentissage
    }
  }, [token, dossierId, toast]);
}
