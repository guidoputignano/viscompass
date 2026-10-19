import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {cReviewV2Fixture} from './fixtures/pillar-c-review.mjs';
import {cMoneyLabel} from '../lib/dashboard-review/pillar-c/review.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
// Exercise rendered TSX as well as the separate full project type-check.
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(specifier,context,next){return next(['next/navigation','next/link'].includes(specifier)?specifier+'.js':specifier,context);}
export async function load(url,context,next){if(url.startsWith('file:')&&url.endsWith('.tsx')){const file=fileURLToPath(url);return{format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};}return next(url,context);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {PillarCForecastPanel}=await import('../components/dashboard-review/pillar-c/forecast-section.tsx');
const render=(forecast,series='TOT')=>renderToStaticMarkup(React.createElement(PillarCForecastPanel,{forecast,series,onSeries(){},published:true}));
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');

test('forecast dashboard renders planning values for each series, without any diagnostic or method payload even inside details',()=>{
  const forecast=cReviewV2Fixture().forecast,before=structuredClone(forecast);
  for(const series of ['TOT','A','H']){
    const html=render(forecast,series),visible=text(html),annual=forecast.annual.find(r=>r.series===series);
    for(const field of ['total','low80','high80','low95','high95'])assert.ok(visible.includes(cMoneyLabel(annual[field]).replace(/\s+/g,' ')),`${series} ${field}`);
    assert.match(html,/data-c-forecast-annual/);assert.match(html,/data-c-forecast-peak/);
    assert.match(visible,/In breve · riferimenti per la pianificazione/);
    assert.match(visible,/Stima annua indicativa/);
    assert.doesNotMatch(html,/ARIMA|ETS di prova|MASE|Winkler|variante primaria|sensibilità di prova|ML-A15|ML-A17|Metodo di prova|Limiti di prova|Lettura di prova|Totale annuo di prova|backtest|Metriche di ammissione|Ammissione delle serie/);
    assert.match(html,/rel="license noopener noreferrer"/);
    assert.match(html,/Dati e ambito della previsione/);
  }
  assert.deepEqual(forecast,before,'rendering does not rewrite the evidence packet');
});

test('complete observed base gives an exact signed comparison and peak month, not an observed growth claim',()=>{
  const forecast=cReviewV2Fixture().forecast,html=render(forecast),visible=text(html);
  assert.match(html,/data-c-forecast-change/);
  assert.match(visible,/\+120,00 € \(\+10,36 %\)/);
  assert.match(visible,/Dicembre 2026 · 112,00 €/);
  assert.match(visible,/Differenza fra la stima indicativa 2026 e gli importi osservati 2025/);
  assert.doesNotMatch(visible,/risparmio|pazienti|sopra il budget|crescita osservata/i);
});

test('missing month or partial source coverage never publishes an annual change, while the forecast remains visible',()=>{
  for(const series of ['A','H']){
    const html=render(cReviewV2Fixture().forecast,series);
    assert.doesNotMatch(html,/data-c-forecast-change/);
    assert.match(html,/Base 2025 incompleta/);
    assert.match(html,/data-c-forecast-annual/);
    assert.match(html,/data-c-forecast-peak/);
  }
});

test('no forecast and rejected selections never render replacement amounts or model rejection details',()=>{
  const missing=render(undefined);
  assert.match(missing,/role="status"/);assert.doesNotMatch(missing,/data-c-forecast-annual/);
  const forecast=cReviewV2Fixture().forecast;
  forecast.admission[0].decision='RIFIUTATA';
  forecast.admission[0].rejection={reason:'MASE sentinel',fallback:'ARIMA sentinel'};
  const rejected=render(forecast);
  assert.match(rejected,/previsione non disponibile per questa selezione/);
  assert.doesNotMatch(rejected,/data-c-forecast-annual|data-c-forecast-change|data-c-forecast-peak|MASE sentinel|ARIMA sentinel/);
});
