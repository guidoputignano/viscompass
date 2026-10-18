import {buildCAttrPacket} from '../../lib/dashboard-review/pillar-c/attribution.ts';
export function attributionFixture() {
  const row=(key,c,state,candidates,year=2025,month=1,org='AQ',channel='CO')=>({anno:year,mese:month,asl:org,canale:channel,prodotto_key:key,atc:state==='S5'?'':'TEST',c,attribution_status:state,candidate_portfolios:candidates});
  const portfolios=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
  const rows=[row('900000001','12','S2',['AA']),row('900000002','80','S3',['AA','BB']),row('900000002','-10','S3',['AA','BB']),row('900000003','20','S3',['AA','BB']),row('900000004','2','S4',[]),row('E-unknown','190','S5',[]),row('900000005','0','S3',['AA','BB']),row('900000099','7','S3',['AA','BB'],2024),row('900000002','4','S3',['AA','BB'],2026,1),row('900000008','6','S2',['BB'],2025,7,'CH','DD')];
  return buildCAttrPacket(rows,portfolios,new Map(rows.map(r=>[r.prodotto_key,`Prodotto sintetico ${r.prodotto_key}`])),'1'.repeat(64),'2'.repeat(64),'test-only');
}
