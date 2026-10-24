import "server-only";

/**
 * Regional analytical parity (owner clarification of 23 Oct 2026): the region-wide objects an enabled member of the
 * Regione reads under its own session from pillar-c-scoped/<root>/regione/ (migration 20261023200000, which admits that
 * folder only to a session holding all four ASL units and the aggregate). Built privately from the bytes the reviewer
 * reads (outputs/pillar-c/rec5/regional-parity-20261024/PINS_REGIONAL.json). Hashes and sizes only: no figure.
 *
 *   - extension: the reviewer extension object itself, byte for byte (same SHA-256 and size as
 *     C_EXTENSION_STORAGE.reviewer; a test pins the two together), parsed by the reviewer parser.
 *   - pvm: the one workbook output the price/quantity/mix panel reads (ML-4-PORT-REAL of section «costi»), verbatim,
 *     with the cell formats it uses, the workbook hash and the SHA-256 of the costi section it was taken from.
 *   - review (owner decision of 24 Oct 2026: O4 and the lineage restriction lifted for the Regione): the reviewer
 *     packet's 682 modelled budget rows, re-keyed to their unit (ids <unit>-m-NNNN), and the provenance the reviewer's
 *     «Fonti e significato delle analisi» and «Versione e tracciabilità» panels render.
 */
export const C_REGIONAL_STORAGE = {
  root: "v9",
  extension: { name: "ext1-d5db37e1febcb5a35bc04f20f8ac1a78f4683a31ebeac08ea48f3375c98a5090.json", sha256: "d5db37e1febcb5a35bc04f20f8ac1a78f4683a31ebeac08ea48f3375c98a5090", bytes: 166442 },
  pvm: { name: "pvm-7db28bc37f330946ff46b3ab34acd8bade7e4706e94d5a4101976c76fb140d87.json", sha256: "7db28bc37f330946ff46b3ab34acd8bade7e4706e94d5a4101976c76fb140d87", bytes: 7899 },
  review: { name: "revisione-b086347e4f229703f28905a78341ee719800c03c228ff3d1eff83e36a3103071.json", sha256: "b086347e4f229703f28905a78341ee719800c03c228ff3d1eff83e36a3103071", bytes: 153832 },
  /** The costi section the pvm output was taken from (workbook index 737a2ba7…). */
  costiSha256: "d75e8c506ce2dae6ad9b2fb8edec64532429437a17c1eb46b9835ddaa0a9fd84",
} as const;
export const C_REGIONAL_MAX_BYTES = 1_000_000;
