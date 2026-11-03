import {test} from 'node:test';import assert from 'node:assert/strict';import {criarEvolution, lerMensagemRecebida} from './evolution.mjs';
function montar(admin){const calls=[];const evo=criarEvolution({url:'http://local',chave:'teste',instancia:'teste',fetchFn:async(url,opts)=>{calls.push({url,opts});const data=url.includes('findGroupInfos')?{announce:true,participants:[{phoneNumber:'123@s.whatsapp.net',admin}]}:url.includes('fetchInstances')?[{ownerJid:'123@s.whatsapp.net'}]:{key:{id:'teste'}};return {ok:true,text:async()=>JSON.stringify(data)}}});return {evo,calls}}
test('grupo restrito sem admin não chama envio de texto nem imagem',async()=>{for(const tipo of ['texto','imagem']){const {evo,calls}=montar(null);await assert.rejects(tipo==='texto'?evo.enviarTexto('pais@g.us','Aviso'):evo.enviarImagem('pais@g.us','https://imagem','Aviso'),/administradores/);assert.equal(calls.some(c=>c.url.includes('/message/')),false)}});
test('admin envia o texto integral no endpoint de texto',async()=>{const {evo,calls}=montar('admin');await evo.enviarTexto('pais@g.us','Aviso completo\nCom horário e link');assert.deepEqual(JSON.parse(calls.at(-1).opts.body),{number:'pais@g.us',text:'Aviso completo\nCom horário e link'})});
test('texto vazio é recusado antes de qualquer chamada',async()=>{const {evo,calls}=montar('admin');await assert.rejects(evo.enviarTexto('pais@g.us','  '),/vazia/);assert.equal(calls.length,0)});

test('cartão de contato vira nome e número no texto', () => {
  const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Jheniffer\nTEL;type=CELL;waid=5519988887777:+55 19 98888-7777\nEND:VCARD'
  const msg = lerMensagemRecebida({ event: 'messages.upsert', data: { key: { remoteJid: '5519911112222@s.whatsapp.net', id: 'x1' }, message: { contactMessage: { displayName: 'Jheniffer', vcard } } } })
  assert.deepEqual(msg.contatos, [{ nome: 'Jheniffer', numero: '5519988887777' }])
  assert.equal(msg.texto, 'Jheniffer 5519988887777')
  assert.equal(msg.midia, null)
})
test('vários cartões de uma vez, inclusive sem waid', () => {
  const card = (n, t) => ({ displayName: n, vcard: `BEGIN:VCARD\nFN:${n}\nTEL;type=CELL:${t}\nEND:VCARD` })
  const msg = lerMensagemRecebida({ event: 'messages.upsert', data: { key: { remoteJid: '5519911112222@s.whatsapp.net', id: 'x2' }, message: { contactsArrayMessage: { contacts: [card('Pedro', '(19) 98888-7777'), card('Ana', '19 97777-6666')] } } } })
  assert.deepEqual(msg.contatos.map((c) => c.numero), ['5519988887777', '5519977776666'])
})
