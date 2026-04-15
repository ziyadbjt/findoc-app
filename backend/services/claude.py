def generer_ecritures(facture_data: dict) -> list:
    code_tiers = facture_data.get("code_tiers", "")
    montant_ht = facture_data.get("montant_ht", 0)
    tva = facture_data.get("tva", 0)
    montant_ttc = facture_data.get("montant_ttc", 0)
    fournisseur = facture_data.get("fournisseur", "")
    
    ecritures = []
    
    # Écriture fournisseur
    ecritures.append({
        "compte_pcm": "401100",
        "libelle": fournisseur,
        "debit": montant_ht,
        "credit": 0
    })
    
    # TVA déductible
    ecritures.append({
        "compte_pcm": "344100",
        "libelle": "TVA déductible 20%",
        "debit": tva,
        "credit": 0
    })
    
    # RAS si fournisseur étranger (FE)
    if code_tiers.startswith("FE"):
        ras = round(montant_ht * 0.10, 2)
        ecritures.append({
            "compte_pcm": "4455",
            "libelle": "RAS à reverser DGI 10%",
            "debit": 0,
            "credit": ras
        })
        ecritures.append({
            "compte_pcm": "512100",
            "libelle": "Banque · règlement",
            "debit": 0,
            "credit": round(montant_ttc - ras, 2)
        })
    else:
        ecritures.append({
            "compte_pcm": "512100",
            "libelle": "Banque · règlement",
            "debit": 0,
            "credit": montant_ttc
        })
    
    return ecritures