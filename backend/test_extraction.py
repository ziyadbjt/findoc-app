"""
Test rapide de l'extraction PDF via pdfplumber + Claude Haiku.
Usage: venv/bin/python test_extraction.py <chemin_vers_pdf>
"""
import json
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()

from services.document_ai import _extract_text_from_pdf, _extract_with_claude, extract_facture

def test(filepath: str):
    filename = os.path.basename(filepath)
    print(f"\n--- Test : {filename} ---")

    with open(filepath, "rb") as f:
        file_bytes = f.read()

    # Étape 1 : extraction texte
    text = _extract_text_from_pdf(file_bytes)
    if text.strip():
        print(f"Texte extrait ({len(text)} chars) :")
        print(text[:300].replace("\n", " ") + "...")
    else:
        print("Pas de texte extractible (PDF scanné ou image)")

    # Étape 2 : appel Claude
    if text.strip():
        print("\nAppel Claude Haiku...")
        result = _extract_with_claude(text, filename)
        if result:
            print("Résultat Claude :")
            for k, v in result.items():
                if k not in ("texte_source", "line_items"):
                    print(f"  {k}: {v}")
        else:
            print("Claude a échoué → fallback activé")

    # Résultat final complet
    print("\nPipeline complet (extract_facture) :")
    final = extract_facture(filepath, filename)
    for k in ("fournisseur", "num_facture", "date_facture", "date_echeance", "montant_ht", "tva", "montant_ttc", "confidence", "source_ai"):
        print(f"  {k}: {final.get(k)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # test avec le premier PDF trouvé dans uploads/
        import glob
        pdfs = glob.glob("uploads/*.pdf")
        if not pdfs:
            print("Usage: venv/bin/python test_extraction.py <fichier.pdf>")
            sys.exit(1)
        test(pdfs[0])
    else:
        test(sys.argv[1])
