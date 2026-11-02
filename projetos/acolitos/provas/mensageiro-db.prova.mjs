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
console.log(JSON.stringify({ok:true,checks:['grants','RLS privada','propriedade','família','tempo mínimo','idempotência','limite diário','temporada','sessão expirada','concorrência']}));
}finally{if(running)execFileSync(bin+'pg_ctl',['-D',path.join(dir,'data'),'-m','fast','-w','stop'],{stdio:'pipe'});}
