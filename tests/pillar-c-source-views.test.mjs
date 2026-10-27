// Pillar C source views (joint feedback 2, G2-01/G2-02): the c_fonte parameter and the Italian lists of the coverage
// lines. Pure functions, no figure and no organisation key.
import test from 'node:test';
import assert from 'node:assert/strict';

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
