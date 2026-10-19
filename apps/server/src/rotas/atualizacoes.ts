import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { VERSAO_API } from '@holofote/shared';
import { z } from 'zod';
import { ErroApi, naoEncontrado } from '../infra/erros';
import type { AppZod } from './tipos';

/**
 * Atualizações por ar (OTA) do app, no protocolo Expo Updates v1 (sem EAS):
 * https://docs.expo.dev/technical-specs/expo-updates-1/
 *
 * Layout em disco: <dir>/<runtimeVersion>/<timestamp numérico>/, com a saída de
 * `expo export --platform ios` (metadata.json, _expo/static/js/ios/*.hbc, assets/...) mais o
 * expoConfig.json. Vale a pasta de timestamp mais alto. As rotas são públicas: o app consulta
 * antes de fazer login.
 */

export interface OpcoesAtualizacoes {
  /** Pasta raiz das atualizações (ATUALIZACOES_DIR). */
  dir: string;
  /** Origem pública (URL_PUBLICA) para as URLs absolutas dos arquivos; sem ela, usa a do pedido. */
  urlPublica?: string;
}

export const ROTA_MANIFESTO = `/${VERSAO_API}/atualizacoes/manifesto`;
export const ROTA_ARQUIVO = `/${VERSAO_API}/atualizacoes/arquivo`;

const PLATAFORMA = 'ios';
const SO_DIGITOS = /^\d+$/;
// Nome de pasta seguro (a versão de runtime vira um caminho em disco).
const NOME_SEGURO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const TIPOS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.json': 'application/json',
  '.hbc': 'application/javascript',
  '.bundle': 'application/javascript',
  '.js': 'application/javascript',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

const tipoDe = (extensao: string) => TIPOS[extensao.toLowerCase()] ?? 'application/octet-stream';

const Metadados = z.object({
  fileMetadata: z.object({
    ios: z.object({
      bundle: z.string().min(1),
      assets: z.array(z.object({ path: z.string().min(1), ext: z.string() })),
    }),
  }),
});

const ConfigExpo = z.record(z.string(), z.unknown());

interface PastaDeAtualizacao {
  caminho: string;
  timestamp: number;
}

/** A pasta de timestamp mais alto da versão de runtime, ou null se não houver nenhuma. */
async function maisRecente(raiz: string, runtime: string): Promise<PastaDeAtualizacao | null> {
  let entradas;
  try {
    entradas = await readdir(resolve(raiz, runtime), { withFileTypes: true });
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw erro;
  }
  // Só pastas com nome numérico: o script publica numa pasta temporária e renomeia no fim.
  const pastas = entradas
    .filter((e) => e.isDirectory() && SO_DIGITOS.test(e.name))
    .map((e) => ({ caminho: resolve(raiz, runtime, e.name), timestamp: Number(e.name) }))
    .sort((a, b) => b.timestamp - a.timestamp);
  return pastas[0] ?? null;
}

/** UUID determinístico a partir do SHA-256 (hex) do metadata.json. */
const hashParaUuid = (hex: string) =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

const paraBase64Url = (b64: string) =>
  b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

interface Arquivo {
  hash: string;
  chave: string;
}

// As pastas de atualização nunca mudam depois de publicadas, então o hash por caminho vale sempre.
const hashes = new Map<string, Arquivo>();

async function descreverArquivo(caminhoAbsoluto: string): Promise<Arquivo> {
  const guardado = hashes.get(caminhoAbsoluto);
  if (guardado) return guardado;
  const conteudo = await readFile(caminhoAbsoluto);
  const arquivo = {
    hash: paraBase64Url(createHash('sha256').update(conteudo).digest('base64')),
    chave: createHash('md5').update(conteudo).digest('hex'),
  };
  hashes.set(caminhoAbsoluto, arquivo);
  return arquivo;
}

function origemPublica(opcoes: OpcoesAtualizacoes, req: { protocol: string; host: string }) {
  return (opcoes.urlPublica ?? `${req.protocol}://${req.host}`).replace(/\/+$/, '');
}

function urlDoArquivo(origem: string, caminhoRelativo: string) {
  return `${origem}${ROTA_ARQUIVO}?caminho=${encodeURIComponent(caminhoRelativo)}`;
}

/** Corpo multipart/mixed com uma parte JSON (`manifest` ou `directive`). */
function multipart(nome: 'manifest' | 'directive', conteudo: unknown) {
  const limite = `holofote-${randomBytes(12).toString('hex')}`;
  const corpo =
    `--${limite}\r\n` +
    `content-disposition: form-data; name="${nome}"\r\n` +
    `content-type: application/json; charset=utf-8\r\n\r\n` +
    `${JSON.stringify(conteudo)}\r\n` +
    `--${limite}--\r\n`;
  return { corpo, tipo: `multipart/mixed; boundary=${limite}` };
}

/** Lê o cabeçalho; valor repetido (array) conta como inválido. */
function cabecalho(valor: string | string[] | undefined): string | undefined {
  return typeof valor === 'string' ? valor : undefined;
}

export function rotasAtualizacoes(app: AppZod, opcoes: OpcoesAtualizacoes) {
  const raiz = resolve(opcoes.dir);

  app.get(ROTA_MANIFESTO, async (req, reply) => {
    const versaoProtocolo = cabecalho(req.headers['expo-protocol-version']) ?? '0';
    if (versaoProtocolo !== '0' && versaoProtocolo !== '1') {
      throw new ErroApi(400, 'invalido', 'Protocolo não suportado. Use 0 ou 1.');
    }
    if (cabecalho(req.headers['expo-platform']) !== PLATAFORMA) {
      throw new ErroApi(400, 'invalido', 'Plataforma não suportada. Só ios.');
    }
    const runtime = cabecalho(req.headers['expo-runtime-version']);
    if (!runtime || !NOME_SEGURO.test(runtime)) {
      throw new ErroApi(400, 'invalido', 'Versão de runtime ausente ou inválida.');
    }
    const protocolo1 = versaoProtocolo === '1';

    reply.header('expo-protocol-version', versaoProtocolo);
    reply.header('expo-sfv-version', 0);
    reply.header('cache-control', 'private, max-age=0');

    const semAtualizacao = () => {
      // O protocolo 0 não tem diretivas: multipart sem partes é 204.
      if (!protocolo1) return reply.code(204).send();
      const { corpo, tipo } = multipart('directive', { type: 'noUpdateAvailable' });
      return reply.code(200).type(tipo).send(corpo);
    };

    const pasta = await maisRecente(raiz, runtime);
    if (!pasta) return semAtualizacao();

    const bruto = await readFile(resolve(pasta.caminho, 'metadata.json'));
    const id = hashParaUuid(createHash('sha256').update(bruto).digest('hex'));
    if (protocolo1 && cabecalho(req.headers['expo-current-update-id']) === id) {
      return semAtualizacao();
    }

    const metadados = Metadados.parse(JSON.parse(bruto.toString('utf-8'))).fileMetadata.ios;
    const configExpo = ConfigExpo.parse(
      JSON.parse(await readFile(resolve(pasta.caminho, 'expoConfig.json'), 'utf-8')),
    );
    const origem = origemPublica(opcoes, req);
    const relativo = (arquivo: string) => `${runtime}/${pasta.timestamp}/${arquivo}`;

    const ativo = async (
      arquivo: string,
      extra: { contentType: string; fileExtension?: string },
    ) => {
      const { hash, chave } = await descreverArquivo(resolve(pasta.caminho, arquivo));
      return { hash, key: chave, ...extra, url: urlDoArquivo(origem, relativo(arquivo)) };
    };

    const manifesto = {
      id,
      createdAt: new Date(pasta.timestamp * (pasta.timestamp > 1e11 ? 1 : 1000)).toISOString(),
      runtimeVersion: runtime,
      launchAsset: await ativo(metadados.bundle, {
        contentType: 'application/javascript',
        fileExtension: '.bundle',
      }),
      assets: await Promise.all(
        metadados.assets.map((a) =>
          ativo(a.path, { contentType: tipoDe(`.${a.ext}`), fileExtension: `.${a.ext}` }),
        ),
      ),
      metadata: {},
      extra: { expoClient: configExpo },
    };
    const { corpo, tipo } = multipart('manifest', manifesto);
    return reply.code(200).type(tipo).send(corpo);
  });

  app.get(
    ROTA_ARQUIVO,
    { schema: { querystring: z.object({ caminho: z.string().min(1).max(512) }) } },
    async (req, reply) => {
      const alvo = resolve(raiz, req.query.caminho);
      if (req.query.caminho.includes('\0') || !alvo.startsWith(raiz + sep)) {
        throw new ErroApi(400, 'invalido', 'Caminho inválido.');
      }
      let real: string;
      try {
        // realpath também barra um link simbólico que aponte para fora da pasta.
        real = await realpath(alvo);
        if (!real.startsWith((await realpath(raiz)) + sep)) throw naoEncontrado();
        if (!(await stat(real)).isFile()) throw naoEncontrado();
      } catch (erro) {
        if (erro instanceof ErroApi) throw erro;
        if ((erro as NodeJS.ErrnoException).code === 'ENOENT')
          throw naoEncontrado('Arquivo não encontrado');
        throw erro;
      }
      // Pastas publicadas não mudam: o cliente pode guardar o arquivo.
      reply.header('cache-control', 'public, max-age=31536000, immutable');
      return reply.type(tipoDe(extname(real))).send(createReadStream(real));
    },
  );
}
