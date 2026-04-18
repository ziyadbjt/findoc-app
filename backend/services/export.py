from datetime import datetime, timedelta

def calculer_retard(date_facture: str, delai_jours: int) -> dict:
    try:
        date = datetime.strptime(date_facture, "%d/%m/%Y")
        echeance = date + timedelta(days=delai_jours)
        aujourd_hui = datetime.now()
        retard = (aujourd_hui - echeance).days
        return {
            "echeance": echeance.strftime("%d/%m/%Y"),
            "retard_jours": max(0, retard),
            "statut": "en_retard" if retard > 0 else "dans_les_delais"
        }
    except:
        return {"echeance": "—", "retard_jours": 0, "statut": "inconnu"}

def calculer_penalite(montant_ttc: float, retard_jours: int, taux_bam: float = 2.25) -> float:
    taux_total = (taux_bam + 3) / 100
    penalite = montant_ttc * taux_total * (retard_jours / 365)
    return round(penalite, 2)