// Extrai o objeto JSON da resposta do modelo, tolerando bloco de código e texto em volta.

export type ResultadoJson = { ok: true; valor: unknown } | { ok: false; erro: string };

export function extrairJson(texto: string): ResultadoJson {
  let corpo = texto.trim();
  const cerca = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(corpo);
  if (cerca?.[1] !== undefined) corpo = cerca[1].trim();
  if (!corpo.startsWith('{')) {
    const inicio = corpo.indexOf('{');
    const fim = corpo.lastIndexOf('}');
    if (inicio === -1 || fim <= inicio) {
      return { ok: false, erro: 'a resposta não contém um objeto JSON' };
    }
    corpo = corpo.slice(inicio, fim + 1);
  }
  try {
    const valor: unknown = JSON.parse(corpo);
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
      return { ok: false, erro: 'o JSON da resposta não é um objeto' };
    }
    return { ok: true, valor };
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    return { ok: false, erro: `JSON malformado (${motivo.slice(0, 120)})` };
  }
}
