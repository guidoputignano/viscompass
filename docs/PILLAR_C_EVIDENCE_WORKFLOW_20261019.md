# Pillar C shared evidence review queue

Date: 2026-10-19. This is the reference for the "Verifiche" section of the Pillar C page ("Assegna e segui le verifiche di attribuzione"). It describes what the queue is, what each step requires and what the queue never does. It contains no workbook figures or amounts. Those stay in the private evidence repository.

## What the queue is

The attribution analysis shows which products have spending that cannot be tied to one therapeutic portfolio. Some products are shared between several portfolios, and for others the evidence is insufficient. The queue turns the top of that list into shared review cases. Each case has an owner, evidence documents, a decision and a follow-up.

The list of products is fixed. It does not follow the filters on the page.

- Period: full year 2025.
- Organisation: the aggregate of the four health authorities ("aggregato delle quattro Aziende").
- Channel: all channels.
- Pool: products classified as shared between portfolios or with insufficient evidence. Identifiers that still need resolving are not included.
- Size: the smallest set of products, ranked by absolute exposure, that together reach at least 80% of that pool's absolute exposure.

The 80% describes **economic coverage** of the starting list. It does not mean that 80% of clinical attribution will be resolved. A review can end by confirming that attribution is still uncertain, and that is a valid outcome. Decisions are kept separate from the mapping and from every total on the dashboard.

The attribution panel links to the queue only when it shows the same perimeter (2025, regional aggregate, all channels, shared and insufficient evidence, no search). For any other selection it says that the queue uses a fixed priority and does not follow that selection.

## Who can use it

Reviewers and administrators who are currently enabled can use the queue. Every write also requires an approved organisation membership. If that membership is missing, the page says so ("account non abilitato"). Owners can only be chosen from the current list of enabled accounts. A person who leaves that list stays visible in the history as "Account non più nella rosa".

Assignments are visible only inside the queue. **No email or notification is sent**, and the page says this next to the assignment count.

## States and what each step needs

| State (as shown) | How a case gets there | What it needs |
|---|---|---|
| Da assegnare | No case yet. «Prepara verifica» creates one. | Nothing. The case record is permanent from this point. |
| Assegnata | «Salva assegnazione» | An enabled owner, a role or office, and a due date. |
| In verifica | «Avvia verifica», or a reopen | The assigned owner is still enabled. |
| Decisione registrata | «Registra decisione» | A non-empty reason. «Evidenza ritenuta sufficiente per la verifica» also needs at least one attached document. The page disables that option until one is attached. |
| Seguito pianificato | «Salva seguito» | A follow-up owner, a date and a next step. The outcome can be added now or at closing. |
| Verifica chiusa | «Chiudi la verifica» | At least one attached document, a saved follow-up for the current decision with an owner who is still enabled, and an outcome ("Riscontro"). The page lists whichever of these are missing. |

More rules:

- **Reassigning a case that is in review** sends it back to «Assegnata». The decision form closes, and the review has to be started again. The page explains this and asks for an explicit confirmation first. The history keeps both assignments.
- **Reopening** a closed case needs a reason and moves the case back to «In verifica». The earlier decision, follow-up and outcome are not deleted. Until a new decision is recorded, they are labelled "ciclo precedente" (previous cycle), and the decision choice starts again from «Attribuzione ancora incerta».
- The four possible decisions are «Attribuzione ancora incerta», «Evidenza ritenuta sufficiente per la verifica», «Serve una ripartizione locale» and «Identificativo chiarito». Each one is an organisational outcome. None of them certifies a share of clinical attribution or activates a new mapping.
- Text fields are trimmed of spaces, tabs and line breaks at both ends, in the browser and in the database. A note made only of blank lines is refused.

## Evidence documents

- File types: PDF without active content, CSV, or UTF-8 text.
- Size: up to **4 MB** per file. The hosting platform rejects request bodies above 4.5 MB before the application sees them, so 4 MB leaves room for the upload envelope. The page checks the size before uploading and names the file that is too large.
- At most ten documents per case.
- **Aggregate data only.** No patient identifiers, records or individual-level data. The reviewer confirms this for every file.
- Documents are stored privately. They are never previewed in the page, and they are downloaded as files only after a fresh access check and an integrity check.
- A registered document cannot be replaced to rewrite a decision. A new document is added, and the history shows both.

## History and concurrent edits

Every change writes an event with the person, the time (Europe/Rome), the case version and what changed. Assignment and follow-up events show the owner's name, role and due date. Attachment events show the file name, but never storage paths or hashes. The database refuses to update, delete or truncate history rows, so the history is append-only.

Each case carries a version number. If two people edit the same case, the second save is refused, and the page asks them to refresh and check the current version. Nothing is overwritten silently.

Text typed but not yet saved (decision reason, follow-up, outcome, reopen reason) is kept for each case while the page is open. So attaching a document in the middle of a decision does not erase it. Once the text is saved, the draft is discarded.

After a successful save, the page shows the saved case straight away, then reloads the list. If only that reload fails, the page says the save is confirmed and the list may be out of date, and suggests «Aggiorna». A failed save never claims that nothing happened if the outcome is unknown. In that case it says "nessuna modifica è stata confermata" and suggests refreshing before trying again.

## When the priority changes

Each case is tied to the attribution snapshot that produced the list and to the product's identity in that list: product key, ATC, attribution state and candidate portfolios. When the queue moves to a new attribution snapshot, it is recomputed and starts fresh. A product that is still in the list gets a new case.

Cases from earlier snapshots, or for products no longer in the list, are not lost. They appear under «Verifiche di una versione precedente della priorità (sola lettura)». There, documents, decisions and history can still be opened and downloaded, but nothing can be changed.

The queue and this archive are both reached through the current attribution source. If that private source cannot be read, the section reports that the shared queue is unavailable. Nothing is lost in that case: the cases, events and documents stay in the database and become reachable again when the source can be read. Document downloads do not depend on it.

## What the queue never does

- It never changes the attribution mapping, any amount or any total on the dashboard.
- It never sends emails, invitations or notifications.
- It never accepts or shows patient-level data.
- It never turns a closed review into a certified clinical attribution or an approved budget.
- It never replaces the in-page review plan of the portfolio dossier, which stays a local draft with downloads only. The two are not connected.

## Accessibility and translation

Opening a case scrolls to it and moves keyboard focus to its title. After each save, focus stays in the case, and the result is announced in a status region that stays visible while the reviewer works on the case. Labels that change, such as row actions, state labels, messages and the list of missing conditions, are rendered so that Chrome's page translation cannot leave an outdated label on screen.

## Status

The database migration `supabase/migrations/20261019120000_pillar_c_evidence_workflow.sql` must be applied before the queue can be used. It also creates the private storage bucket `pillar-c-evidence`. Until then, the section says that the shared queue is not available, and it presents nothing as a saved assignment.
