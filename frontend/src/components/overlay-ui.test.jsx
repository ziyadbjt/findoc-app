import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ token: "test-token", user: { id: 1 }, authReady: true }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => vi.fn(),
}));

vi.mock("../hooks/useCorrection", () => ({
  useCorrection: () => vi.fn(),
}));

vi.mock("../api", () => ({
  uploadFactures: vi.fn(),
  uploadBankStatement: vi.fn(),
  getFactureFile: vi.fn(async () => ({
    data: new Blob(["invoice"], { type: "application/pdf" }),
  })),
  updateFacture: vi.fn(async (_token, _id, payload) => ({
    data: payload,
  })),
}));

import FacturesPage from "../pages/FacturesPage";
import { CmdK } from "./Shell";

const facture = {
  id: 1,
  fournisseur: "Acme SARL",
  num_facture: "FAC-2026-001",
  date_facture: "2026-04-14",
  date_echeance: "2026-05-14",
  montant_ht: 1000,
  tva: 200,
  montant_ttc: 1200,
  statut: "a_valider",
  paiement: "en_attente",
  confidence: 0.72,
  type: "achat",
  nom_fichier: "acme-facture.pdf",
};

const factureReview2 = {
  id: 2,
  fournisseur: "Beta Industrie",
  num_facture: "FAC-2026-002",
  date_facture: "2026-04-18",
  date_echeance: "2026-05-18",
  montant_ht: 500,
  tva: 100,
  montant_ttc: 600,
  statut: "traite",
  paiement: "en_attente",
  confidence: 0.68,
  type: "achat",
  nom_fichier: "beta-facture.pdf",
};

beforeAll(() => {
  window.URL.createObjectURL = vi.fn(() => "blob:test");
  window.URL.revokeObjectURL = vi.fn();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
});

describe("overlay UI system", () => {
  it("ouvre Importer, Exporter et le detail facture au bon endroit", async () => {
    const user = userEvent.setup();

    render(
      <FacturesPage
        factures={[facture, factureReview2]}
        dossierId="demo"
        onRefresh={vi.fn()}
        ecritures={[]}
        layout="table"
      />
    );

    await user.click(screen.getByRole("button", { name: /Importer/i }));
    expect(screen.getByRole("dialog", { name: /Importer des factures/i })).toBeTruthy();
    expect(document.querySelector('[data-ui-overlay="modal"]')).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Annuler/i }));

    await user.click(screen.getByRole("button", { name: /Exporter/i }));
    expect(screen.getByRole("dialog", { name: /Exporter les données/i })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Annuler/i }));

    await user.click(screen.getAllByText("Acme SARL")[0]);
    expect(await screen.findByText(/Valider facture/i)).toBeTruthy();
    expect(document.querySelector('[data-ui-overlay="drawer"]')).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Valider facture/i }));
    expect(await screen.findByRole("heading", { name: "Beta Industrie" })).toBeTruthy();
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("affiche CmdK dans une modale centree", () => {
    render(
      <CmdK
        open
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onUpload={vi.fn()}
        onExport={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByText(/Importer des factures/i)).toBeTruthy();
    expect(document.querySelector(".cmdk-modal")).toBeTruthy();
  });
});
