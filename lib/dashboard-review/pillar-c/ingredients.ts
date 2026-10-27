/** Pillar C, the active ingredient of each product in the portfolio dossier (joint feedback 2, G2-23): a label joined at
 * display time by exact nine-digit AIC, beside the product's historical ATC and candidate set, which it never replaces.
 *
 * The server joins it (ingredients-loader.ts) and sends only the labels of the products in the view it serves; a view
 * without the field (undefined) has no ingredient column, a view whose labels could not be read (null) says so, and a
 * product without a label (a non-AIC key, or an AIC without a certain match) reads «non disponibile». Browser-safe: the
 * type and the copy only. No label lives here. */
export type CIngredients = Readonly<Record<string, string>>;

export const C_INGREDIENT_COPY = {
  column: "Principio attivo",
  absent: "non disponibile",
  unavailable: "Il principio attivo non è disponibile in questo momento: nessun nome viene ricavato dal marchio o dall’ATC.",
  note: "Principio attivo dagli elenchi ufficiali AIFA delle confezioni (13 ottobre 2026), per codice AIC esatto; una combinazione resta una combinazione. «Non disponibile» indica un codice che non è un AIC o un AIC senza un riscontro certo: nessun nome viene ricavato dal marchio o dall’ATC.",
} as const;

/** The label of one product, or the honest state: «non disponibile» for a product without one, null when the labels
 * could not be read, undefined when the view carries no labels at all. */
export function cIngredientOf(ingredients: CIngredients | null | undefined, key: string): string | null | undefined {
  if (ingredients === undefined) return undefined;
  if (ingredients === null) return null;
  return Object.hasOwn(ingredients, key) ? ingredients[key] : C_INGREDIENT_COPY.absent;
}
