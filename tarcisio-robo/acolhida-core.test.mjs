import test from 'node:test';import assert from 'node:assert/strict';import {destinatario,horarioCatequese,confirmacaoExplicita,CATEQUESES,mensagemCatequese} from './acolhida-core.mjs';
const m={id:'m1',nome:'João Silva',data_nascimento:'2014-10-27',telefone:'19998090669',telefone_whatsapp:true,celular_mae:'19995903905',responsavel_whatsapp:true};
test('11anos recebe via mãe; a partir do aniversário12 recebe no próprio WhatsApp',()=>{assert.equal(destinatario(m,[m],'2026-10-26').canal,'responsavel');assert.equal(destinatario(m,[m],'2026-10-27').canal,'jovem');});
test('sem WhatsApp próprio e com telefone igual à mãe usa responsável; idade incerta não vira jovem',()=>{for(const x of [{telefone_whatsapp:false},{telefone:m.celular_mae},{data_nascimento:null}])assert.equal(destinatario({...m,...x},[m],'2026-12-01').canal,'responsavel');});
test('sem contato confirmado bloqueia e telefone próprio compartilhado não vira vínculo',()=>{assert.equal(destinatario({...m,telefone_whatsapp:false,responsavel_whatsapp:false},[m],'2026-12-01').erro,'contato_sem_confirmacao');assert.ok(destinatario(m,[m,{...m,id:'m2',nome:'Outro'}],'2026-12-01').erro);});
test('agenda somenteterça e quinta às18h Brasília; sem acúmulo fora da janela',()=>{assert.equal(horarioCatequese(new Date('2026-10-27T20:59:00Z')),false);assert.equal(horarioCatequese(new Date('2026-10-27T21:00:00Z')),true);assert.equal(horarioCatequese(new Date('2026-10-29T21:00:00Z')),true);assert.equal(horarioCatequese(new Date('2026-10-28T21:00:00Z')),false);assert.equal(horarioCatequese(new Date('2026-10-27T23:00:00Z')),false);});
test('recebimento exige fato positivo e não confunde previsão/pronta com entrega',()=>{assert.equal(confirmacaoExplicita('tunica_recebida','Recebi a túnica ontem!'),true);for(const t of ['Não recebi a túnica','Quando eu receber a túnica aviso','A túnica está pronta','Acho que chega amanhã'])assert.equal(confirmacaoExplicita('tunica_recebida',t),false);});
test('14encontros possuem referências e mensagens distintas para jovem e responsável',()=>{assert.equal(CATEQUESES.length,14);for(const [i,c]of CATEQUESES.entries()){assert.ok(c.fonte);assert.ok(mensagemCatequese(i,'jovem','João').includes(c.titulo));assert.ok(mensagemCatequese(i,'responsavel','João').includes('conversar'));assert.notEqual(mensagemCatequese(i,'jovem','João'),mensagemCatequese(i,'responsavel','João'));}});
test('frases reais de 27/10: quem já tem/usa a túnica, com quebra de linha; medidas e busca são só resposta',()=>{
 assert.equal(confirmacaoExplicita('tunica_recebida','Bom dia , a túnica já está pronta.\nInclusive ela já serviu na missa 🙏🏼'),true);
 assert.equal(confirmacaoExplicita('tunica_recebida','A Bia já tem túnica e tbm já está servindo'),true);
 assert.equal(confirmacaoExplicita('tunica_recebida','Oi Tarcísio, irei buscar minha túnica hoje a tarde'),false);
 assert.equal(confirmacaoExplicita('tunica_recebida','Ainda não tem túnica'),false);
 assert.equal(confirmacaoExplicita('respondeu_tunica','Vamos no sábado tirar as medidas na costureira'),true);
 assert.equal(confirmacaoExplicita('respondeu_tunica','Olá bom dia'),false);
});


test('recebimento na voz passiva é fato; previsão, dúvida e negativa não são',()=>{
 for(const t of ['Ola Tarcísio, minha túnica já foi recebida','A túnica foi retirada hoje','Minha túnica já foi buscada'])assert.equal(confirmacaoExplicita('tunica_recebida',t),true,t);
 for(const t of ['Minha túnica não foi recebida','Minha túnica ainda não foi recebida','Se a túnica foi recebida, o que acontece?','A túnica será recebida amanhã','Acho que minha túnica foi recebida','Minha túnica já está pronta, irei buscar hoje'])assert.equal(confirmacaoExplicita('tunica_recebida',t),false,t);
});


test('responsável definido explicitamente tem prioridade sobre mãe e recado, sem mudar o jovem com WhatsApp próprio',()=>{
 const base={...m,data_nascimento:'2018-01-01',celular_responsavel:'19992114793',celular_mae:'19991352387',celular_recado:'19986048535',responsavel_whatsapp:true};
 assert.equal(destinatario(base,[base],'2026-10-27').numero,'5519992114793');
 assert.equal(destinatario({...base,celular_responsavel:null},[base],'2026-10-27').numero,'5519991352387');
 assert.equal(destinatario({...base,celular_responsavel:null,celular_mae:null},[base],'2026-10-27').numero,'5519986048535');
 const jovem={...base,data_nascimento:'2010-01-01',telefone:'19998090669',telefone_whatsapp:true};assert.equal(destinatario(jovem,[jovem],'2026-10-27').canal,'jovem');
});
