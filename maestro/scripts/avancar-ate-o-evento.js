/* global http, output, APARELHO_ID */ // Globais do runScript do Maestro.
// Avança o relógio simulado do mundo (rota de desenvolvimento POST /v1/dev/relogio) até as 18h05
// do dia do próximo evento, para ele ficar "ao vivo". Só funciona contra a API local.
// Entrada: APARELHO_ID, o id do aparelho do simulador (a linha mais recente de `usuario`).
// O login anônimo devolve o token desse aparelho, então o app não precisa ser tocado.
var base = 'http://127.0.0.1:3333/v1';
var JSON_CAB = { 'Content-Type': 'application/json' };

function resposta(r, rota) {
  if (!r.ok) throw new Error(rota + ' respondeu ' + r.status + ': ' + r.body);
  return JSON.parse(r.body);
}

var login = resposta(
  http.post(base + '/auth/anonimo', {
    headers: JSON_CAB,
    body: JSON.stringify({ aparelhoId: APARELHO_ID }),
  }),
  'auth/anonimo',
);
var cab = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };

function avancar(minutos) {
  return resposta(
    http.post(base + '/dev/relogio', {
      headers: cab,
      body: JSON.stringify({ avancarMinutos: minutos }),
    }),
    'dev/relogio',
  );
}

var evento = resposta(http.get(base + '/jornada', { headers: cab }), 'jornada').proximoEvento;
if (!evento) throw new Error('O mundo não tem evento agendado.');
var dia = resposta(http.get(base + '/mundos/atual', { headers: cab }), 'mundos/atual').dia;

// Um minuto só para ler a hora do mundo (`agora`, em UTC); o fuso do jogador é UTC−3 (São Paulo).
var agoraLocal = Date.parse(avancar(1).agora) - 3 * 3600 * 1000;
var inicioDoDia = Math.floor(agoraLocal / 86400000) * 86400000;
var alvo = inicioDoDia + (evento.quando.dia - dia) * 86400000 + (18 * 60 + 5) * 60000;
var minutos = Math.round((alvo - agoraLocal) / 60000);
// O limite de um pedido é 7 dias.
while (minutos > 0) {
  var passo = Math.min(minutos, 60 * 24 * 7);
  avancar(passo);
  minutos -= passo;
}

output.eventoId = evento.id;
output.titulo = evento.titulo;
