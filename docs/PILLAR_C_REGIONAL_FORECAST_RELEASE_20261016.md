# Pillar C regional forecast — signed-in release

16 October 2026. Owner instruction: publish this AIFA-only regional forecast for signed-in users, not anonymously. Keep private Azienda analyses restricted. No request to publish the whole Pillar C workbook or widen private institutional access.

The owner also explicitly requested removal of the alternative view. Both links and the `vista=interfaccia` rendering branch are removed. Old bookmarks now render the authorized analytical/forecast view, never the illustrative workspace. The underlying design-source files are preserved, not served or deleted.

## Scope

The regional Abruzzo forecast uses the immutable R5 artifact already deployed and numerically verified: TOT/A/H monthly 2026 points and 80/95% intervals, observed 2025 context, three supplementary annual records and four series-admission decisions. C has no forecast. No new calculation, private spending aggregate, allocation, patient/count scenario or other Region is added.

The owner authorized this bounded modelled publication after the independent R5 checks and the 16 October follow-up cleared the T2/regression findings. This does not accept all 85 workbook outputs, turn modelled future values into observations or approve clinical mappings. Annual uncertainty remains supplementary and not backtested. Source, licence, missingness and model limitations remain in the panel; no extra attribution wording is introduced.

## Authorization and projection

`/dashboard-review` continues to require a real approved membership. An approved ordinary member receives only `CRegionalForecast`, exactly `{forecast}`. An approved reviewer/admin keeps the existing private analytical workspace. Query parameters cannot switch an ordinary member to the private preview/workspace.

The forecast server loader reuses the existing immutable, private, hash-pinned transport object. The service transport stays server-only: before any client serialization, `projectCRegionalForecast` explicitly selects only the public-source forecast and validates its closed schema and fixed regional scope. It neither calls the private reviewer loader nor forwards private rows, lineage or evidence. This is an explicit public-source projection contract, not a replacement for RLS on institutional data. Storage policies, credentials, memberships, fact tables and analytical gates are unchanged. The caller cannot replace the production hash pin.

The Pillar C navigation link is now visible to approved ordinary users. Their page has the same Totale/A/H selector, uncertainty chart, exact table, rejection and methodological details. It has no global Azienda or private-channel selectors because the forecast does not have that grain. Source values remain outside the public repository and static assets.

## Verification and operational limits

Tests exercise the explicit projection (private-value sentinel cannot survive), unknown/nested fields, public scope, source integrity, pre-read membership gate, failure/empty states and preservation of the existing private reviewer gate. The compiler, current TypeScript tests and production build must pass before push. A private real-packet check verifies the exact positive projection against the immutable source artifact.

Anonymous access must still redirect. Reviewer live smoke must retain the private workspace and display the published forecast. A distinct ordinary approved account must subsequently verify its forecast-only view; no test user is created or membership changed to make that test pass. Record an unperformed role-session check as such, not as a passed RLS audit.

Rollback is a code rollback: the immutable artifact, storage policies and facts are untouched. Reverting the new route branch/nav visibility restores reviewer-only access without data deletion or reimport.
