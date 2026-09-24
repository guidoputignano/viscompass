import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseGoldFile} from '../lib/uploads/gold-file.ts';

// The real extraction's row-1 group header. The basis of columns 19/21 is
// asserted against this and nothing else, because row 2 lies about it.
const GROUP='DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI';
// Row 2 as the real file actually labels it: both omit "per Conto".
const LABELS={4:'Codice Azienda Sanitaria',8:'Codice AIC',10:'Mesi disponibili',
  19:'Quantita (Distribuzione Diretta+Consumi Ospedalieri)(a)',
  20:'Prezzo unitario (b)',21:'Costo SellOut (Distribuzione Diretta+ Consumi Ospedalieri)(c)'};

const data=(over={})=>({1:2025,2:'130',4:'130201',5:'ASL LANCIANO',7:'PRODOTTO',8:'022211039',
  9:12,10:'202501\n202502\n202503',12:'ACME',19:100,20:2,21:200,...over});

/** Builds a workbook in the shape the parser expects, with holes punched to order. */
async function book({group=GROUP,labels={},rows=[data()],width=34,sheet='DIR_OSP_TRA_003AS'}={}){
  const wb=new ExcelJS.Workbook();
  const ws=wb.addWorksheet(sheet);
  for(const c of [19,20,21]) ws.getRow(1).getCell(c).value=group;
  const r2={...LABELS,...labels};
  for(const [c,v] of Object.entries(r2)) ws.getRow(2).getCell(Number(c)).value=v;
  if(width>21) ws.getRow(2).getCell(width).value='ultima colonna';
  rows.forEach((row,i)=>{
    for(const [c,v] of Object.entries(row)) if(v!==undefined) ws.getRow(3+i).getCell(Number(c)).value=v;
  });
  return parseGoldFile(await wb.xlsx.writeBuffer());
}

test('the group header decides the basis, and the row-2 label cannot override it',async()=>{
  // Row 2 omits "per Conto" here exactly as the real file does. The parser must
  // still accept, and must record the header it accepted on.
  const {rows,meta}=await book();
  assert.equal(meta.basisHeader,GROUP.toUpperCase());
  assert.equal(rows[0].cost,200);

  // An extraction that really is DD + CO only must abort, not be read under the
  // old assumption. EUR 80m of Distribuzione per Conto rides on this.
  await assert.rejects(
    ()=>book({group:'DISTRIBUZIONE DIRETTA+CONSUMI OSPEDALIERI'}),
    /does not name "PER CONTO"/,
  );
  await assert.rejects(()=>book({group:'DISTRIBUZIONE PER CONTO+CONSUMI OSPEDALIERI'}),/"DIRETTA"/);
  await assert.rejects(()=>book({group:'DISTRIBUZIONE DIRETTA+ DISTRIBUZIONE PER CONTO'}),/"OSPEDALIERI"/);
});

test('the aggregate columns are read as they stand, never recomputed from components',async()=>{
  // Components deliberately contradict the aggregate. The aggregate wins,
  // because recomputing is the bug the parser exists to prevent.
  const {rows}=await book({rows:[data({13:1,14:2,15:3,16:4,17:5,18:6})]});
  assert.equal(rows[0].quantity,100);
  assert.equal(rows[0].cost,200);
});

test('months come from the row own coverage, not the extraction period',async()=>{
  // Column 9 reads 12 on every row of the real file; column 10 is per-row.
  const {rows}=await book({rows:[
    data({9:12,10:'202501\n202502\n202503'}),
    data({9:12,10:'202501'}),
    data({9:12,10:undefined}),
  ]});
  assert.deepEqual(rows.map(r=>r.months),[3,1,null]);
});

test('an absent number is absent, never a reported zero',async()=>{
  const {rows}=await book({rows:[
    data({19:undefined,21:undefined}),
    data({21:{error:'#DIV/0!'}}),
    data({21:{formula:'U3/S3',result:{error:'#DIV/0!'}}}),
    data({19:0,21:0}),
  ]});
  assert.equal(rows[0].quantity,null);
  assert.equal(rows[0].cost,null);
  assert.equal(rows[1].cost,null,'an Excel error cell is undefined, not zero');
  assert.equal(rows[2].cost,null,'a formula erroring out is undefined, not zero');
  assert.equal(rows[3].cost,0,'a real zero survives as a zero');
});

test('a string where a number belongs aborts, naming the row and column',async()=>{
  // "1.234" is 1234 or 1.234 depending on a convention the file does not state.
  await assert.rejects(()=>book({rows:[data({21:'1.234'})]}),/Row 3, column 21/);
});

test('a wholly blank row is skipped; a partly blank one is data',async()=>{
  const {rows,meta}=await book({rows:[
    data(),
    {1:2025,2:'130'},                                    // no key, no figures: trailing blank
    data({19:undefined,21:undefined,12:undefined}),      // has keys: real row, missing figures
  ]});
  assert.equal(meta.totalRows,2);
  assert.deepEqual(rows.map(r=>r.sourceRow),[3,5],'sourceRow stays the sheet row, for tracing back');
});

test('the AIC is passed through exactly, never padded into a plausible key',async()=>{
  const {rows}=await book({rows:[data({8:'022211039'}),data({8:'22211039'}),data({8:undefined})]});
  assert.deepEqual(rows.map(r=>r.aic),['022211039','22211039',null]);
});

test('a file that is not this extraction is rejected on shape',async()=>{
  await assert.rejects(()=>book({width:21}),/at least 34 columns/);
  await assert.rejects(()=>book({rows:[]}),/Expected data rows/);
  await assert.rejects(()=>book({labels:{8:'Codice prodotto'}}),/Column 8/);
  await assert.rejects(()=>book({labels:{10:'Periodo'}}),/Column 10/);
  await assert.rejects(()=>book({labels:{19:'Quantita'}}),/Column 19/);
});

test('meta records what was parsed, derived and not assumed',async()=>{
  const {meta}=await book({rows:[data({1:2025}),data({1:2024,2:'140'}),data({1:2025})]});
  assert.equal(meta.sheetName,'DIR_OSP_TRA_003AS');
  assert.equal(meta.totalRows,3);
  assert.deepEqual(meta.years,[2024,2025],'distinct and sorted, however many the file holds');
  assert.deepEqual(meta.regionCodes,['130','140']);
});
