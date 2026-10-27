// PostgreSQL descartável local. Nunca usa .env nem credenciais de produção.
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs';
const exec=promisify(execFile);
export const DB='quiz_validacao', HOST='127.0.0.1', PORT='55439';
const args=['-X','-q','-A','-t','-h',HOST,'-p',PORT,'-d',DB,'-v','ON_ERROR_STOP=1'];
export const ids={admin:'11111111-1111-4111-8111-111111111111',equipe:'22222222-2222-4222-8222-222222222222',coroinha:'33333333-3333-4333-8333-333333333333',outro:'44444444-4444-4444-8444-444444444444',mod:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',outroMod:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',casa:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'};
export const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
export function sql(s){return execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',[...args,'-c',s],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
export function como(uid,s,role='authenticated'){return `begin;set local role ${role};select set_config('request.jwt.claim.sub',${quote(uid)},true);${s};commit;`;}
export function rpc(acao,dados={},uid=ids.admin){const out=sql(como(uid,`select public.quiz_operar(${quote(acao)},${quote(JSON.stringify(dados))}::jsonb)`));return JSON.parse(out.split('\n').at(-1));}
export async function rpcAsync(acao,dados={},uid=ids.admin){const {stdout}=await exec('/opt/homebrew/opt/postgresql@17/bin/psql',[...args,'-c',como(uid,`select public.quiz_operar(${quote(acao)},${quote(JSON.stringify(dados))}::jsonb)`)],{encoding:'utf8'});return JSON.parse(stdout.trim().split('\n').at(-1));}
export function ler(table,uid=ids.admin){if(!/^(acolitos_quizzes|acolitos_gincanas|acolitos_casas|acolitos_retiro_areas)$/.test(table))throw Error('Tabela não permitida');const out=sql(como(uid,`select coalesce(jsonb_agg(t),'[]') from public.${table} t`));return JSON.parse(out.split('\n').at(-1));}
export function preparar(){
 try {execFileSync('/opt/homebrew/opt/postgresql@17/bin/createdb',['-h',HOST,'-p',PORT,'-T','template0','-E','UTF8',DB],{stdio:'pipe'});}catch(e){if(!String(e.stderr).includes('already exists'))throw e;}
 sql(`do $$begin if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select from pg_roles where rolname='anon') then create role anon;end if;end$$;
 create schema if not exists auth;create table if not exists auth.users(id uuid primary key);
 create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table if not exists public.pastoral_modules(id uuid primary key,slug text unique,nome text,ativo boolean default true);
 create table if not exists public.pastoral_members(id uuid primary key default gen_random_uuid(),user_id uuid,module_id uuid,role text);
 create table if not exists public.acolitos_casas(id uuid primary key,nome text,cor text,ordem int default 0);
 insert into auth.users values('${ids.admin}'),('${ids.equipe}'),('${ids.coroinha}'),('${ids.outro}') on conflict do nothing;
 insert into public.pastoral_modules values('${ids.mod}','acolitos','Acólitos',true),('${ids.outroMod}','outra','Outro grupo',true) on conflict do nothing;
 insert into public.pastoral_members(user_id,module_id,role) select u,m,r from (values('${ids.admin}'::uuid,'${ids.mod}'::uuid,'coord_admin'),('${ids.equipe}'::uuid,'${ids.mod}'::uuid,'membro_equipe'),('${ids.coroinha}'::uuid,'${ids.mod}'::uuid,'coroinha'),('${ids.outro}'::uuid,'${ids.outroMod}'::uuid,'coord_admin')) x(u,m,r) where not exists(select 1 from public.pastoral_members p where p.user_id=x.u);
 insert into public.acolitos_casas(id,nome,cor,ordem) values('${ids.casa}','Sanctaris','#c0392b',0) on conflict do nothing;
 alter table public.acolitos_casas add column if not exists slug text;
 alter table public.acolitos_casas add column if not exists tipo text not null default 'membro';
 update public.acolitos_casas set slug='sanctaris',nome='Sanctaris' where id='${ids.casa}';
 insert into public.acolitos_casas(id,nome,cor,ordem,slug) values
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','Seraphim','#e67e22',1,'seraphim'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','Veritatis','#2980b9',2,'veritatis'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','Templaris','#27ae60',3,'templaris'),
 ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4','Consilium','#7d3c98',4,'consilium') on conflict do nothing;
 create table if not exists public.acolitos_retiro_areas(id uuid primary key default gen_random_uuid(),nome text,tipo text default 'retiro',descricao text,local text,data_inicio date,data_fim date,status text default 'planejando');
 insert into public.acolitos_retiro_areas(id,nome,tipo,descricao,local,data_inicio,status) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Retiro de Advento 2026','retiro','Um encontro para servir, aprender e viver a fé em comunidade.','Casa de retiros','2026-11-29','planejando') on conflict do nothing;
 grant select on public.acolitos_casas,public.acolitos_retiro_areas to authenticated;`);
 const migration=fs.readFileSync(new URL('../../../supabase/migrations/20261022120000_quiz_gincanas.sql',import.meta.url),'utf8');
 if(sql("select to_regclass('public.acolitos_quizzes') is null")==='t')sql(migration);
 else for(const bloco of migration.matchAll(/create function[\s\S]*?\$\$;/g)){
  let fonte=bloco[0].replace('create function','create or replace function');
  if(sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='acolitos_gincanas' and column_name='conducao')")==='t')fonte=fonte.replace('public.quiz_operar(', 'public.quiz_operar_base(');
  sql(fonte);
 }
 const v2=fs.readFileSync(new URL('../../../supabase/migrations/20261022170000_dinamicas_temporadas.sql',import.meta.url),'utf8');
 if(sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='acolitos_gincanas' and column_name='conducao')")==='f')sql(v2);
 else for(const bloco of v2.matchAll(/create function[\s\S]*?\$\$;/g))sql(bloco[0].replace('create function','create or replace function'));
}
