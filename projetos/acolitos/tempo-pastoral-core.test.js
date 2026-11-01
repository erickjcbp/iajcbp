const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('./tempo-pastoral-core.js');
test('usa a data de serviço real e mantém o limite ou antes',()=>{
 const d=T.dados({servindo_desde:'2022-09-17',created_at:'2026-06-01',servindo_desde_ou_antes:true},'2026-11-01');
 assert.equal(d.meses,49);assert.equal(d.texto,'4 anos e 1 mês ou mais');assert.match(d.titulo,/17\/09\/2022 ou antes/);
});
test('não transforma importação, ausência ou data futura em tempo de pastoral',()=>{
 for(const m of [{created_at:'2026-06-01'},{},{servindo_desde:'2027-01-01'},{servindo_desde:'2026-02-30'}])assert.equal(T.dados(m,'2026-11-01').meses,null);
});
test('conta meses completos no aniversário, inclusive fim de mês e ano bissexto',()=>{
 for(const [desde,hoje,meses,texto] of [['2025-11-02','2026-11-01',11,'11 meses'],['2025-11-01','2026-11-01',12,'1 ano'],['2024-02-29','2025-02-28',12,'1 ano'],['2026-10-31','2026-11-01',0,'1 dia'],['2026-11-01','2026-11-01',0,'0 dias']]){
  const d=T.dados({servindo_desde:desde},hoje);assert.equal(d.meses,meses);assert.equal(d.texto,texto);
 }
});
