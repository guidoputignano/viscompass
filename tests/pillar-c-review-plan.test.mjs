import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cReviewContextKey, cCreateReviewTask, cUpdateReviewTask, cReviewPlan, cReviewJson, cReviewCsv, CReviewValidationError } from '../lib/dashboard-review/pillar-c/review-plan.ts';

const context = {
  period: 'FY2025', org: 'AQ', channel: 'CO', portfolioId: 'TEST_A', portfolioLabel: 'Portafoglio di prova',
  sourceSha256: '1'.repeat(64), classificationSha256: '2'.repeat(64), mappingVersion: 'test-only',
  sourceSnapshot: '3'.repeat(64), fixedNet: '12.001', sharedAbs: '9.999',
};
const initial = {
  type: 'attribution', title: 'Verificare la ripartizione di prova', role: '', owner: '', dueDate: '',
  evidence: '', outcome: '', state: 'draft',
};
const t0 = '2026-10-18T10:00:00.000Z', t1 = '2026-10-18T10:01:00.000Z', t2 = '2026-10-18T10:02:00.000Z', t3 = '2026-10-18T10:03:00.000Z';
const draft = () => cCreateReviewTask(context, initial, { id: 'test-task-1', now: t0 });
const assignedInput = { ...initial, role: 'Farmacia di prova', owner: 'Referente sintetico', dueDate: '2026-11-02', state: 'assigned' };
const code = expected => error => error instanceof CReviewValidationError && error.code === expected;

test('local plan context is bound to source, classification, snapshot and every selector', () => {
  const base = cReviewContextKey(context);
  for (const patch of [{ period: 'FY2024' }, { org: 'CH' }, { channel: 'DD' }, { portfolioId: 'TEST_B' }, { sourceSha256: '4'.repeat(64) }, { classificationSha256: '4'.repeat(64) }, { sourceSnapshot: '4'.repeat(64) }, { mappingVersion: 'test-next' }]) assert.notEqual(cReviewContextKey({ ...context, ...patch }), base);
  assert.equal(cReviewContextKey({ ...context, portfolioLabel: 'Etichetta aggiornata' }), base);
  for (const patch of [{ period: 'FY2026' }, { org: '130201' }, { channel: 'other' }, { portfolioId: '../../path' }, { portfolioId: undefined }, { portfolioId: 123 }, { portfolioLabel: '' }, { sourceSnapshot: 'not-a-hash' }, { sourceSha256: 'bad' }, { fixedNet: 'NaN' }, { sharedAbs: '-1' }]) assert.throws(() => cReviewContextKey({ ...context, ...patch }), code('context'));
});
test('creation records a draft only; a checked box cannot jump to completed', () => {
  const task = draft();
  assert.equal(task.contextKey, cReviewContextKey(context)); assert.equal(task.state, 'draft');
  assert.equal(task.resolvedAt, null); assert.equal(task.createdAt, t0);
  assert.throws(() => cCreateReviewTask(context, initial, { id: undefined, now: t0 }), code('task'));
  for (const state of ['assigned', 'in_review', 'resolved']) assert.throws(() => cCreateReviewTask(context, { ...assignedInput, state, evidence: 'Evidenza sintetica', outcome: 'Esito sintetico' }, { id: 'test-task-1', now: t0 }), code('transition'));
});
test('assignment requires a role, a named referent and a valid due date', () => {
  for (const patch of [{ owner: '' }, { owner: '   ' }, { role: '' }, { dueDate: '' }]) assert.throws(() => cUpdateReviewTask(context, draft(), { ...assignedInput, ...patch }, t1), code('assignment'));
  for (const date of ['2026-02-29', '2026-11-31', 'tomorrow', '2026-1-2']) assert.throws(() => cUpdateReviewTask(context, draft(), { ...assignedInput, dueDate: date }, t1), code('input'));
  assert.equal(cUpdateReviewTask(context, draft(), assignedInput, t1).state, 'assigned');
});
test('resolution follows review and requires evidence plus an outcome without changing the source', () => {
  const assigned = cUpdateReviewTask(context, draft(), assignedInput, t1);
  const resolving = { ...assignedInput, state: 'resolved', evidence: 'Protocollo aggregato di prova 4', outcome: 'Ripartizione non dimostrata: richiedere centro di costo.' };
  assert.throws(() => cUpdateReviewTask(context, assigned, resolving, t2), code('transition'));
  const reviewing = cUpdateReviewTask(context, assigned, { ...assignedInput, state: 'in_review' }, t2);
  for (const patch of [{ evidence: '' }, { evidence: ' \n ' }, { outcome: '' }]) assert.throws(() => cUpdateReviewTask(context, reviewing, { ...resolving, ...patch }, t3), code('resolution'));
  const resolved = cUpdateReviewTask(context, reviewing, resolving, t3);
  assert.equal(resolved.state, 'resolved'); assert.equal(resolved.resolvedAt, t3);
  assert.equal(resolved.contextKey, reviewing.contextKey);
  assert.deepEqual(cUpdateReviewTask(context, resolved, resolving, '2026-10-18T10:04:00.000Z'), resolved, 'no-op close preserves its recorded timestamp');
  assert.throws(() => cUpdateReviewTask(context, resolved, { ...resolving, outcome: 'Different outcome' }, '2026-10-18T10:04:00.000Z'), code('transition'));
  const reopened = cUpdateReviewTask(context, resolved, { ...resolving, state: 'in_review' }, '2026-10-18T10:04:00.000Z');
  assert.equal(reopened.resolvedAt, null); assert.equal(reopened.state, 'in_review');
});
test('tasks cannot cross scope/source boundaries or travel backwards in recorded time', () => {
  assert.throws(() => cUpdateReviewTask({ ...context, org: 'CH' }, draft(), assignedInput, t1), code('task'));
  assert.throws(() => cReviewPlan({ ...context, sourceSnapshot: '5'.repeat(64) }, [draft()], t1), code('task'));
  assert.throws(() => cUpdateReviewTask(context, draft(), assignedInput, '2026-10-18T09:00:00.000Z'), code('input'));
  assert.throws(() => cCreateReviewTask(context, initial, { id: 'test', now: '2026-13-01T10:00:00.000Z' }), code('input'));
  assert.throws(() => cReviewPlan(context, [draft()], '2026-10-18T09:00:00.000Z'), code('task'));
});
test('export is explicit, immutable in content, validates tasks and strips unrecognised payload fields', () => {
  const task = { ...draft(), patientId: 'must-never-export', attachment: { hidden: 'must-never-export' } };
  const plan = cReviewPlan({ ...context, patientId: 'must-never-export' }, [task], t1);
  assert.equal(plan.mode, 'local-export-only'); assert.equal(plan.context.sharedAbs, '9.999');
  const json = cReviewJson(plan);
  assert.doesNotMatch(json, /patientId|attachment|must-never-export/);
  assert.deepEqual(JSON.parse(json), plan);
  assert.throws(() => cReviewPlan(context, [draft(), draft()], t1), code('task'));
  assert.throws(() => cReviewPlan(context, [{ ...draft(), state: 'resolved', resolvedAt: t0 }], t1), code('assignment'));
  assert.throws(() => cReviewPlan(context, [{ ...draft(), resolvedAt: t0 }], t1), code('task'));
});
test('CSV quotes values and neutralises formula injection even after whitespace or line breaks', () => {
  const dangerous = ['=HYPERLINK("https://invalid.test","x")', '+1+2', '-10+20', '@SUM(1)', '\t=1+1', '\n=1+1', '\uFEFF=1+1'];
  for (const title of dangerous) {
    const task = cCreateReviewTask(context, { ...initial, title }, { id: 'test', now: t0 });
    const csv = cReviewCsv(cReviewPlan(context, [task], t1));
    assert.ok(csv.startsWith('\uFEFF"id","period"'));
    assert.ok(csv.includes(`"'${title.trim().replaceAll('"', '""')}"`), 'dangerous title is prefixed rather than merely quoted');
  }
  const task = cCreateReviewTask(context, { ...initial, evidence: 'A, B\n"C"' }, { id: 'test', now: t0 });
  const csv = cReviewCsv(cReviewPlan(context, [task], t1));
  assert.match(csv, /"A, B\n""C"""/); assert.match(csv, /"test-only"/);
});
test('UI has no browser persistence, remote write, notification or false saved-device claim', () => {
  const ui = readFileSync(new URL('../components/dashboard-review/pillar-c/review-plan.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /localStorage|sessionStorage|fetch\(|navigator\.sendBeacon|\.from\(/);
  assert.match(ui, /Resta aperto in questa pagina; scarica per conservarlo/);
  assert.match(ui, /Nessun incarico o notifica viene inviato/);
  assert.match(ui, /non modifica la mappatura, gli importi/);
  assert.match(ui, /setPlans\(current => \(\{ \.\.\.current, \[key\]: next \}\)\)/);
  assert.match(ui, /URL\.revokeObjectURL/);
});
test('review plan renders accessible controls, human-readable context and escaped text', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  register('data:text/javascript,' + encodeURIComponent(`
    import {readFileSync} from 'node:fs';
    import {fileURLToPath} from 'node:url';
    import {createRequire} from 'node:module';
    let sucrase;
    export function initialize({pkg}) { sucrase=createRequire(pkg)('sucrase'); }
    export async function load(url,context,next) {
      if(url.startsWith('file:')&&url.endsWith('.tsx'))return {format:'module',source:sucrase.transform(readFileSync(fileURLToPath(url),'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true}).code,shortCircuit:true};
      return next(url,context);
    }
  `), { data: { pkg: pathToFileURL(`${root}package.json`).href } });
  const req = createRequire(`${root}package.json`), React = req('react'), {renderToStaticMarkup} = req('react-dom/server');
  const {CPortfolioReviewPlan} = await import('../components/dashboard-review/pillar-c/review-plan.tsx');
  const reviewer = await (await import('./helpers/pillar-c-audience.mjs')).reviewerAudience(React);
  const html = renderToStaticMarkup(reviewer(React.createElement(CPortfolioReviewPlan,{context:{...context,portfolioLabel:'<script>prova</script>'}})));
  assert.match(html, /<summary/); assert.match(html, /Piano di revisione/);
  assert.match(html, /Anno 2025/); assert.match(html, /ASL 1/);
  assert.match(html, /&lt;script&gt;prova&lt;\/script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.equal((html.match(/disabled=""/g)??[]).length,2,'exports are disabled until a task exists');
  assert.match(html, /Aggiungi attività/); assert.match(html, /Nessun incarico o notifica viene inviato/);
});
