/** Task-oriented entry points are presentation preferences, never membership or permissions. */
export const C_STARTING_VIEWS = ["direzione", "farmacia", "regione"] as const;
export type CStartingView = (typeof C_STARTING_VIEWS)[number];
export const C_STARTING_PARAM = "c_percorso";

export function cStartingView(params: URLSearchParams, kind: string): CStartingView {
  const choice = params.get(C_STARTING_PARAM);
  return C_STARTING_VIEWS.find((value) => value === choice) ?? (kind === "regione" ? "regione" : "direzione");
}

/** Receives a search whose organization has already been resolved by the workspace. Only changes the preference
 * and the open source. No organization key, data read, permission decision or inferred professional role. */
export function cStartingViewSearch(search: string, choice: CStartingView): string {
  const params = new URLSearchParams(search);
  params.set(C_STARTING_PARAM, choice);
  if (choice === "farmacia") params.set("c_fonte", "dpc"); else params.delete("c_fonte");
  return `?${params}`;
}
