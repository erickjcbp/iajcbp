const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('./colunas-tabela.js');
const colunas=[{id:'nome',valor:m=>m.nome},{id:'idade',tipo:'numero',valor:m=>m.idade},{id:'funcao',valor:m=>m.funcao}];
const lista=[{nome:'Érica',idade:12,funcao:'Vela presente'},{nome:'Ana',idade:null,funcao:'Sem escala'},{nome:'Bruno',idade:9,funcao:'Vela escalado'},{nome:'Clara',idade:15,funcao:'Cruz presente'}];
test('combina filtros de colunas, intervalo numérico e busca sem acentos',()=>{
 assert.deepEqual(C.aplicar(lista,colunas,{ordem:'idade',desc:true,filtros:{idade:{min:'10',max:'14'},funcao:'VÉLA'}}).map(m=>m.nome),['Érica']);
 assert.deepEqual(C.aplicar(lista,colunas,{filtros:{nome:'erica'}}).map(m=>m.nome),['Érica']);
 assert.equal(C.aplicar(lista,colunas,{filtros:{idade:{min:'0'}}}).length,3);
});
test('ordena numericamente nos dois sentidos com ausências no fim sem mudar a lista original',()=>{
 assert.deepEqual(C.aplicar(lista,colunas,{ordem:'idade'}).map(m=>m.nome),['Bruno','Érica','Clara','Ana']);
 assert.deepEqual(C.aplicar(lista,colunas,{ordem:'idade',desc:true}).map(m=>m.nome),['Clara','Érica','Bruno','Ana']);assert.equal(lista[0].nome,'Érica');
});
