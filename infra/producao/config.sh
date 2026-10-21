# Lido pelos scripts de produção (source). Carrega infra/producao/.env, que fica fora do git,
# sem sobrescrever o que já veio do ambiente: SSH_HOST=servidor-ts infra/producao/implantar.sh
_pasta_config="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$_pasta_config/.env" ]]; then
  while IFS='=' read -r _chave _valor || [[ -n "$_chave" ]]; do
    if [[ -n "$_chave" && "$_chave" != \#* && -z "${!_chave:-}" ]]; then
      export "$_chave=$_valor"
    fi
  done <"$_pasta_config/.env"
fi
unset _pasta_config _chave _valor
