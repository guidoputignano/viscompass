// Pillar C source views (joint feedback 2, G2-01/G2-02): the c_fonte parameter and the Italian lists of the coverage
// lines, and the wording agreed for Batch 1b. No figure and no organisation key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const {C_SOURCE_VIEWS,C_SOURCE_PARAM,cSourceView,cSourceViewSearch,cItalianList}=await import('../lib/dashboard-review/pillar-c/source-views.ts');

test('c_fonte: dpc and filef open their views; anything else, or nothing, is the ledger view',()=>{
  assert.deepEqual([...C_SOURCE_VIEWS],['spesa','dpc','filef']);assert.equal(C_SOURCE_PARAM,'c_fonte');
  for(const [search,view] of [['','spesa'],['c_fonte=dpc','dpc'],['c_fonte=filef','filef'],['c_fonte=spesa','spesa'],['c_fonte=DPC','spesa'],['c_fonte=','spesa'],['c_fonte=residenza','spesa'],['c_org=asl-1&c_fonte=filef','filef']])
    assert.equal(cSourceView(new URLSearchParams(search)),view,search);
});

test('c_fonte: switching the view keeps every other parameter, and the ledger view needs no parameter',()=>{
  assert.equal(cSourceViewSearch('?c_org=asl-2&c_channel=DD','dpc'),'?c_org=asl-2&c_channel=DD&c_fonte=dpc');
  assert.equal(cSourceViewSearch('?c_org=asl-2&c_fonte=dpc&c_channel=DD','filef'),'?c_org=asl-2&c_fonte=filef&c_channel=DD');
  assert.equal(cSourceViewSearch('?c_org=asl-2&c_fonte=dpc','spesa'),'?c_org=asl-2');
  assert.equal(cSourceViewSearch('?c_fonte=filef','spesa'),'');assert.equal(cSourceViewSearch('','spesa'),'');
  assert.equal(cSourceViewSearch('','dpc'),'?c_fonte=dpc');
});

test('Italian lists: «A», «A e B», «A, B e C»',()=>{
  assert.equal(cItalianList([]),'');assert.equal(cItalianList(['ASL 3']),'ASL 3');
  assert.equal(cItalianList(['ASL 1','ASL 2']),'ASL 1 e ASL 2');assert.equal(cItalianList(['ASL 1','ASL 2','ASL 4']),'ASL 1, ASL 2 e ASL 4');
});

// ---------------------------------------------------------------- joint feedback 2, Batch 1b: the agreed wording
const {C_ADD_RESIDENCE_LABELS,C_ADD_COPY}=await import('../lib/dashboard-review/pillar-c/additions.ts');
const UI=['components/dashboard-review/pillar-c/recipient-views.tsx','components/dashboard-review/pillar-c/extension-sections.tsx','components/dashboard-review/pillar-c/extension-reviewer.tsx',
  'components/dashboard-review/pillar-c/additions-sections.tsx','components/dashboard-review/pillar-c/source-views.tsx','lib/dashboard-review/pillar-c/additions.ts','lib/dashboard-review/pillar-c/extension.ts','lib/dashboard-review/pillar-c/section-navigation.ts'];

test('G2-09/G2-10: the ASL of reference, never a residence or a mobility measure',()=>{
  assert.deepEqual(C_ADD_RESIDENCE_LABELS,{sameAsl:'Stessa ASL del flusso',otherAslInRegion:'Altra ASL della regione',outsideRegion:'ASL di un’altra regione',unknown:'ASL non identificabile'});
  assert.equal(C_ADD_COPY.residenceTitle,'ASL di riferimento degli assistiti DPC · gennaio 2026');
  assert.match(C_ADD_COPY.residenceLead,/può essere l’ASL di residenza o quella che ha in carico l’assistito/);
  assert.equal(C_ADD_COPY.residenceAggregate,'Il totale somma i conteggi delle singole ASL: un assistito presente nei dati di due ASL può essere contato due volte.');
  for(const v of [...Object.values(C_ADD_RESIDENCE_LABELS),C_ADD_COPY.residenceTitle,C_ADD_COPY.residenceUnavailable])assert.doesNotMatch(v,/[Rr]esiden|risied|mobilit/,v);
});

test('G2-06/G2-07: «assistiti», never «destinatari» in the copy; «Donne (%)» without «sesso noto»',()=>{
  for(const file of UI){
    // Only identifiers keep the old word: the section id «destinatari», its anchors and the heading id «destinatari-dpc».
    const src=readFileSync(new URL(`../${file}`,import.meta.url),'utf8').replace(/"destinatari"|destinatari-dpc|destinatari: UsersRound/g,'');
    assert.doesNotMatch(src,/[Dd]estinatar(i|io)\b/,file);
    assert.doesNotMatch(src,/sesso (non )?noto/,file);
  }
});
