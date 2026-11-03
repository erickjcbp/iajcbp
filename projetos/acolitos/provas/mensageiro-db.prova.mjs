// Cluster PostgreSQL exclusivo deste teste. Nenhum acesso à produção ou .env.
import fs from 'node:fs';import path from 'node:path';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../..'),dir=path.join(root,'materiais-paroquia/provas/mensageiro/postgres'),bin='/opt/homebrew/opt/postgresql@17/bin/',exec=promisify(execFile);fs.mkdirSync(dir,{recursive:true});
const args=['-X','-q','-A','-t','-h',dir,'-p','55447','-d','postgres','-v','ON_ERROR_STOP=1'];const q=s=>"'"+String(s).replaceAll("'","''")+"'";
function sql(s){return execFileSync(bin+'psql',[...args,'-c',s],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',m='33333333-3333-4333-8333-333333333333',sibling='44444444-4444-4444-8444-444444444444',group='55555555-5555-4555-8555-555555555555';
function as(role,user,s){return `begin;set local role ${role};select set_config('request.jwt.claim.sub',${q(user)},true);select set_config('request.jwt.claim.role',${q(role)},true);${s};commit;`;}
function rpc(role,user,name,params){const out=sql(as(role,user,`select public.${name}(${params})`));return JSON.parse(out.split('\n').at(-1));}
function start(user=uid,member=m){return rpc('authenticated',user,'acolitos_game_sessao',q(member)+',null');}
function age(id){sql(`update acolitos_game_sessoes set iniciado_em=now()-interval '2 minutes' where id=${q(id)}`);}
function credit(id,xp=20){return rpc('service_role',uid,'acolitos_game_creditar',`${q(id)},${q(uid)},5400,900,${xp}`);}
let running=false;
try{
if(!fs.existsSync(path.join(dir,'data/PG_VERSION')))execFileSync(bin+'initdb',['-D',path.join(dir,'data'),'-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
execFileSync(bin+'pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'postgres.log'),'-o',`-p 55447 -k ${dir} -h 127.0.0.1`,'-w','start'],{stdio:'pipe'});running=true;
sql(`drop schema public cascade;create schema public;grant usage on schema public to public;create schema if not exists auth;
do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon;end if;if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select from pg_roles where rolname='service_role') then create role service_role;end if;end$$;
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create or replace function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
grant usage on schema auth to public;grant execute on all functions in schema auth to public;
create table pastoral_modules(id uuid primary key default gen_random_uuid(),slug text,ativo boolean default true);
create table pastoral_members(user_id uuid,module_id uuid,role text);
create table acolitos_membros(id uuid primary key,user_id uuid,status text default 'ativo',serve boolean default true,nome text default 'Teste',apelido text,grupo_irmaos uuid,escalar_com_irmao boolean default false,xp_avulso int default 0);
create table acolitos_temporadas(id uuid default gen_random_uuid(),ativa boolean default true,created_at timestamptz default now());
create table acolitos_xp_temporada(membro_id uuid,temporada_id uuid,xp int,origem text);
insert into pastoral_modules(slug)values('acolitos');insert into pastoral_members select ${q(uid)},id,'coroinha' from pastoral_modules;insert into pastoral_members select ${q(other)},id,'coroinha' from pastoral_modules;
insert into acolitos_membros(id,user_id,grupo_irmaos,escalar_com_irmao)values(${q(m)},${q(uid)},${q(group)},true),(${q(sibling)},null,${q(group)},true);
insert into acolitos_temporadas default values;`);
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261102180000_corrida_mensageiro.sql'),'utf8'));
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261102210000_mensageiro_ranking.sql'),'utf8'));
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261102223000_mensageiro_agua_rara.sql'),'utf8'));
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261103000000_mensageiro_rota_aberta.sql'),'utf8'));
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261103010000_mensageiro_desafio.sql'),'utf8'));
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261103020000_davi_game.sql'),'utf8'));
assert.equal(sql("select has_function_privilege('anon','public.acolitos_game_sessao(uuid,uuid)','execute')"),'f');assert.equal(sql("select has_function_privilege('authenticated','public.acolitos_game_creditar(uuid,uuid,int,int,int)','execute')"),'f');assert.equal(sql("select has_table_privilege('authenticated','acolitos_game_sessoes','select')"),'f');
assert.throws(()=>start(other),/Command failed/);const a=start();assert.throws(()=>rpc('authenticated',other,'acolitos_game_sessao',q(m)+','+q(a.id)),/Command failed/);
assert.throws(()=>credit(a.id),/Command failed/);age(a.id);assert.equal(credit(a.id).xp,20);assert.equal(credit(a.id).novo,false);assert.equal(sql(`select xp_avulso from acolitos_membros where id=${q(m)}`),'20');
const b=start();age(b.id);assert.equal(credit(b.id).xp,20);const c=start();age(c.id);assert.equal(credit(c.id).xp,20);const d=start();age(d.id);assert.equal(credit(d.id).xp,0);assert.equal(sql(`select xp_avulso from acolitos_membros where id=${q(m)}`),'60');assert.equal(sql('select sum(xp) from acolitos_xp_temporada'),'60');
// Perfil familiar autorizado usa saldo próprio.
const e=start(uid,sibling);age(e.id);assert.equal(credit(e.id).xp,20);
// Nova sessão invalida a anterior e chamada direta ao crédito é negada.
const old=start(uid,sibling),fresh=start(uid,sibling);age(old.id);assert.throws(()=>credit(old.id),/Command failed/);assert.throws(()=>rpc('authenticated',uid,'acolitos_game_creditar',`${q(fresh.id)},${q(uid)},600,100,20`),/Command failed/);
// Concorrência: limite diário mantém 60 sob dois créditos simultâneos.
sql(`update acolitos_membros set xp_avulso=0 where id=${q(sibling)};delete from acolitos_game_sessoes where membro_id=${q(sibling)};`);
for(let i=0;i<2;i++){const prior=start(uid,sibling);age(prior.id);credit(prior.id);}
const x=start(uid,sibling);age(x.id);sql(`update acolitos_game_sessoes set expira_em=now()+interval '20 minutes' where id=${q(x.id)}`);const y=start(uid,sibling);age(y.id);sql(`update acolitos_game_sessoes set expira_em=now()+interval '20 minutes' where id=${q(x.id)}`);
const query=id=>as('service_role',uid,`select public.acolitos_game_creditar(${q(id)},${q(uid)},5400,900,20)`);await Promise.all([exec(bin+'psql',[...args,'-c',query(x.id)]),exec(bin+'psql',[...args,'-c',query(y.id)])]);assert.equal(sql(`select xp_avulso from acolitos_membros where id=${q(sibling)}`),'60');
// Versões, ranking por melhor partida e isolamento do perfil.
const v2=rpc('authenticated',uid,'acolitos_game_iniciar_v2',q(m));assert.equal(v2.versao,2);age(v2.id);credit(v2.id);
const v22=rpc('authenticated',uid,'acolitos_game_iniciar_v2',q(m));age(v22.id);credit(v22.id);
const rank=rpc('authenticated',uid,'acolitos_game_ranking',q(m)+",'semana'");assert.equal(rank.participantes,1);assert.equal(rank.top.length,1);assert.equal(rank.meu.pontos,900);assert.equal(rank.meu.eu,true);assert.equal(rank.meu.posicao,1);
assert.throws(()=>rpc('authenticated',other,'acolitos_game_ranking',q(m)+",'geral'"));assert.throws(()=>rpc('anon',uid,'acolitos_game_ranking',q(m)+",'geral'"));
assert.equal(sql("select has_function_privilege('anon','public.acolitos_game_ranking(uuid,text)','execute')"),'f');
const v3=rpc('authenticated',uid,'acolitos_game_iniciar_v3',q(m));assert.equal(v3.versao,3);age(v3.id);credit(v3.id);assert.equal(rpc('authenticated',uid,'acolitos_game_ranking',q(m)+",'geral'").participantes,1);assert.throws(()=>rpc('authenticated',other,'acolitos_game_iniciar_v3',q(m)));assert.equal(sql("select has_function_privilege('anon','public.acolitos_game_iniciar_v3(uuid)','execute')"),'f');
const m4='66666666-6666-4666-8666-666666666666';sql(`insert into acolitos_membros(id,user_id,nome)values(${q(m4)},${q(uid)},'Teste rota')`);
const start4=()=>rpc('authenticated',uid,'acolitos_game_iniciar_v4',q(m4));const credit4=(id,points=2400,meters=1700)=>rpc('service_role',uid,'acolitos_game_creditar_v4',`${q(id)},${q(uid)},7200,${points},20,${meters},1`);
const a4=start4();assert.equal(a4.versao,4);assert.equal(a4.record,0);age(a4.id);const r4=credit4(a4.id);assert.equal(r4.xp,20);assert.equal(r4.distancia,1700);assert.equal(credit4(a4.id).novo,false);
assert.throws(()=>rpc('authenticated',uid,'acolitos_game_creditar_v4',`${q(a4.id)},${q(uid)},7200,2400,20,1700,1`));assert.throws(()=>rpc('authenticated',other,'acolitos_game_iniciar_v4',q(m4)));
const b4=start4();age(b4.id);credit4(b4.id,300,1800);const c4=start4();age(c4.id);credit4(c4.id,2400,1900);const ranking4=rpc('authenticated',uid,'acolitos_game_ranking_v4',q(m4)+",'semana'");assert.equal(ranking4.participantes,1);assert.equal(ranking4.top.length,1);assert.equal(ranking4.meu.distancia,1900);assert.equal(ranking4.meu.pontos,2400);assert.equal(start4().record_distance,1900);
const legacyAfter=start(uid,m4);age(legacyAfter.id);assert.equal(credit(legacyAfter.id).xp,0,'teto60 compartilhado entre versões');
assert.equal(sql("select has_function_privilege('anon','public.acolitos_game_ranking_v4(uuid,text)','execute')"),'f');assert.equal(sql("select has_function_privilege('authenticated','public.acolitos_game_creditar_v4(uuid,uuid,int,int,int,int,int)','execute')"),'f');assert.equal(sql("select has_table_privilege('authenticated','acolitos_game_sessoes','select')"),'f');
// Motor5: permissões, replay longo, crédito idempotente e teto compartilhado.
const a5=rpc('authenticated',uid,'acolitos_game_iniciar_v5',q(m4));assert.equal(a5.versao,5);age(a5.id);
const credit5=()=>rpc('service_role',uid,'acolitos_game_creditar_v5',`${q(a5.id)},${q(uid)},7200,3000,20,1900,1`);
assert.equal(credit5().xp,0);assert.equal(credit5().novo,false);assert.equal(rpc('authenticated',uid,'acolitos_game_ranking_v5',q(m4)+",'semana'").meu.distancia,1900);
assert.throws(()=>rpc('authenticated',other,'acolitos_game_iniciar_v5',q(m4)));
assert.equal(sql("select has_function_privilege('authenticated','public.acolitos_game_creditar_v5(uuid,uuid,int,int,int,int,int)','execute')"),'f');assert.equal(sql("select has_function_privilege('anon','public.acolitos_game_ranking_v5(uuid,text)','execute')"),'f');
// Davi usa versão6 e compartilha o teto com partidas anteriores.
const davi=rpc('authenticated',uid,'acolitos_davi_iniciar',q(m4));assert.equal(davi.versao,6);age(davi.id);
const creditDavi=()=>rpc('service_role',uid,'acolitos_davi_creditar',`${q(davi.id)},${q(uid)},7200,4000,20,7,80`);
assert.equal(creditDavi().xp,0);assert.equal(creditDavi().novo,false);assert.equal(rpc('authenticated',uid,'acolitos_davi_ranking',q(m4)+",'semana'").meu.ondas,7);
assert.throws(()=>rpc('authenticated',other,'acolitos_davi_iniciar',q(m4)));assert.throws(()=>rpc('authenticated',uid,'acolitos_davi_creditar',`${q(davi.id)},${q(uid)},7200,4000,20,7,80`));
assert.equal(sql("select has_function_privilege('anon','public.acolitos_davi_ranking(uuid,text)','execute')"),'f');
const dvMember='77777777-7777-4777-8777-777777777777';sql(`insert into acolitos_membros(id,user_id,nome)values(${q(dvMember)},${q(uid)},'Guardiao teste')`);const ds=rpc('authenticated',uid,'acolitos_davi_iniciar',q(dvMember));age(ds.id);const dr=rpc('service_role',uid,'acolitos_davi_creditar',`${q(ds.id)},${q(uid)},7200,4000,20,7,80`);assert.equal(dr.xp,20);assert.equal(dr.ondas,7);assert.equal(dr.afastados,80);assert.equal(sql(`select xp_avulso from acolitos_membros where id=${q(dvMember)}`),'20');
// Davi resgate: versão7, cap compartilhado e replay antigo preservado.
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261103030000_davi_resgate.sql'),'utf8'));
const d7=rpc('authenticated',uid,'acolitos_davi_iniciar_v2',q(dvMember));assert.equal(d7.versao,7);age(d7.id);
const credit7=()=>rpc('service_role',uid,'acolitos_davi_creditar_v2',`${q(d7.id)},${q(uid)},7200,5000,20,8,90`);
assert.equal(credit7().xp,20);assert.equal(credit7().novo,false);assert.equal(rpc('authenticated',uid,'acolitos_davi_ranking_v2',q(dvMember)+",'geral'").meu.ondas,8);
assert.throws(()=>rpc('authenticated',other,'acolitos_davi_iniciar',q(dvMember)));assert.throws(()=>rpc('authenticated',uid,'acolitos_davi_creditar_v2',`${q(d7.id)},${q(uid)},7200,5000,20,8,90`));assert.equal(sql("select has_function_privilege('anon','public.acolitos_davi_creditar_v2(uuid,uuid,int,int,int,int,int)','execute')"),'f');
assert.equal(rpc('authenticated',uid,'acolitos_davi_iniciar',q(m4)).versao,6,'cliente anterior continua iniciando6');
sql(fs.readFileSync(path.join(root,'supabase/migrations/20261103190548_davi_funda_arraste.sql'),'utf8'));
const d8=rpc('authenticated',uid,'acolitos_davi_iniciar_v3',q(dvMember));assert.equal(d8.versao,8);age(d8.id);
const credit8=()=>rpc('service_role',uid,'acolitos_davi_creditar_v3',`${q(d8.id)},${q(uid)},7200,6000,20,9,100`);
assert.equal(credit8().xp,20);assert.equal(credit8().novo,false);assert.equal(rpc('authenticated',uid,'acolitos_davi_ranking_v3',q(dvMember)+",'geral'").meu.ondas,9);
assert.equal(rpc('authenticated',uid,'acolitos_davi_iniciar_v2',q(m4)).versao,7);assert.equal(rpc('authenticated',uid,'acolitos_davi_iniciar',q(m4)).versao,6);
assert.throws(()=>rpc('authenticated',other,'acolitos_davi_iniciar_v3',q(dvMember)));assert.throws(()=>rpc('authenticated',uid,'acolitos_davi_creditar_v3',`${q(d8.id)},${q(uid)},7200,6000,20,9,100`));assert.equal(sql("select has_function_privilege('anon','public.acolitos_davi_creditar_v3(uuid,uuid,int,int,int,int,int)','execute')"),'f');

console.log(JSON.stringify({ok:true,checks:['grants','RLS privada','propriedade','família','tempo mínimo','idempotência','limite diário','temporada','sessão expirada','concorrência']}));
}finally{if(running)execFileSync(bin+'pg_ctl',['-D',path.join(dir,'data'),'-m','fast','-w','stop'],{stdio:'pipe'});}
