#!/usr/bin/env bash
# Monta o pacote do robô São Tarcísio (robô + núcleos compartilhados do app) e envia para a VPS.
#   ./implantar.sh --dry   só monta o staging e lista os arquivos (não toca na rede)
#   VPS_USER=<usuario> ./implantar.sh   envia e reconstrói (build + up -d robo)
# VPS_USER não tem valor padrão: o usuário SSH da VPS não está registrado no repositório.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
NUCLEOS_ORIGEM="${NUCLEOS_ORIGEM:-$AQUI/../projetos/acolitos}"
STAGING="${STAGING:-$(mktemp -d "${TMPDIR:-/tmp}/tarcisio-staging.XXXXXX")}"
VPS_IP="${VPS_IP:-179.198.107.71}"
CHAVE="${CHAVE:-$HOME/.ssh/sator_whatsapp_gateway_ed25519}"
DESTINO="${DESTINO:-/opt/whatsapp/tarcisio/robo}"
DRY=0; [ "${1:-}" = "--dry" ] && DRY=1

ROBO_ARQUIVOS=(Dockerfile package.json package-lock.json regras.mjs evolution.mjs robo.mjs ia.mjs
  assistente.mjs escala-auto.mjs ministros-pdf.mjs entrada-dono.mjs principal.mjs verificar-cores.mjs)
# Núcleos que o robô carrega (principal.mjs) e o que eles exigem entre si (gerador→kits,horario,rodizio,servir; confirmar-semana→confirmar-escala).
NUCLEOS=(gerador-escala-core.js rodizio-core.js servir-semanal-core.js paginar-core.js
  escala-ministros-core.js kits-core.js horario-core.js confirmar-semana-core.js confirmar-escala-core.js)
OBRIGATORIOS_NO_DEPLOY=1

mkdir -p "$STAGING/robo/cores"
for f in "${ROBO_ARQUIVOS[@]}"; do cp "$AQUI/$f" "$STAGING/robo/$f"; done
FALTANDO=()
for n in "${NUCLEOS[@]}"; do
  if [ -f "$NUCLEOS_ORIGEM/$n" ]; then cp "$NUCLEOS_ORIGEM/$n" "$STAGING/robo/cores/$n"; else FALTANDO+=("$n"); fi
done
# Os núcleos são UMD/CommonJS; um package.json local garante que o Node não os leia como ESM.
echo '{"type":"commonjs"}' > "$STAGING/robo/cores/package.json"

echo "Staging: $STAGING"
(cd "$STAGING" && find robo -type f | sort)
if [ ${#FALTANDO[@]} -gt 0 ]; then echo "AVISO: núcleos ausentes na origem: ${FALTANDO[*]}" >&2; fi

if [ "$DRY" = 1 ]; then echo "--dry: nada enviado."; exit 0; fi
if [ ${#FALTANDO[@]} -gt 0 ]; then echo "ERRO: não implanto com núcleos faltando." >&2; exit 1; fi
: "${VPS_USER:?defina VPS_USER (usuário SSH da VPS; sem valor padrão)}"
ACOLITOS_CORE_DIR="$STAGING/robo/cores" node "$AQUI/verificar-cores.mjs"

SSH_OPTS=(-i "$CHAVE" -o IdentitiesOnly=yes)
ALVO="$VPS_USER@$VPS_IP"
ssh "${SSH_OPTS[@]}" "$ALVO" "mkdir -p '$DESTINO'"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" "$STAGING/robo/" "$ALVO:$DESTINO/"
ssh "${SSH_OPTS[@]}" "$ALVO" "cd /opt/whatsapp/tarcisio && docker compose -p wa-tarcisio build robo && docker compose -p wa-tarcisio up -d robo"
