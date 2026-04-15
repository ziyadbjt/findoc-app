import random

def extract_facture(filepath: str, filename: str) -> dict:
    fournisseurs = [
        ("ATLAS SUPPLIES SARL", "FEATLAS"),
        ("MAROC PRINT SAS", "FLMARPRINT"),
        ("CASATEX IMPEX", "FECASATEX"),
        ("SONATRACH MAROC", "FESONATRACH"),
        ("ATLAS TECH SAS", "FEATECH"),
    ]
    
    fournisseur, code_tiers = random.choice(fournisseurs)
    montant_ht = round(random.uniform(5000, 80000), 2)
    tva = round(montant_ht * 0.20, 2)
    montant_ttc = round(montant_ht + tva, 2)
    
    return {
        "fournisseur": fournisseur,
        "code_tiers": code_tiers,
        "montant_ht": montant_ht,
        "tva": tva,
        "montant_ttc": montant_ttc,
        "date_facture": "15/04/2025",
        "confiance": round(random.uniform(0.85, 0.99), 2)
    }