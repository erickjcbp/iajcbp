const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const w={};vm.runInNewContext(fs.readFileSync(__dirname+'/medalhas-arte.js','utf8'),{window:w});
test('os cinco marcos usam medalhões circulares sem fita, com ônix e rubi',()=>{
 for(const [icone,tier,marco] of [['tempo_chama','bronze','1'],['tempo_pilar','prata','2'],['tempo_raiz','ouro','3'],['tempo_altar','onix','5'],['tempo_veterano','rubi','V']]){
  const html=w.MedalhasArte.html(icone,tier,96);assert.match(html,/medalhao-tempo/);assert.ok(html.includes('data-marco="'+marco+'"'));assert.match(html,/<clipPath/);assert.doesNotMatch(html,/ribbon/);
 }
});
test('as artes aprovadas são preservadas, com atlas próprio para ônix e rubi',()=>{
 assert.match(w.MedalhasArte.html('tempo_chama','bronze',96),/tempo-bronze-prata-ouro\.webp/);
 assert.match(w.MedalhasArte.html('tempo_altar','onix',96),/tempo-onix-rubi\.webp/);
 const html=w.MedalhasArte.html('tempo_veterano','rubi','96\" onclick=alert(1)');assert.doesNotMatch(html,/onclick/);
 assert.equal(w.MedalhasArte.html('desconhecido','rubi',64),'');assert.match(w.MedalhasArte.html('pomba','ouro',64),/pomba-ouro.webp/);
});
