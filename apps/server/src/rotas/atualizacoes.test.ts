import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../app';

const ok = () => Promise.resolve();
const URL_PUBLICA = 'https://holofote.exemplo.ts.net';

const sha256Url = (b: Buffer) =>
  createHash('sha256')
    .update(b)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const md5 = (b: Buffer) => createHash('md5').update(b).digest('hex');
const uuidDe = (b: Buffer) => {
  const h = createHash('sha256').update(b).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const BUNDLE_ANTIGO = Buffer.from('bundle-antigo');
const BUNDLE = Buffer.from('bundle-novo');
const IMAGEM = Buffer.from('imagem-falsa');
const FONTE = Buffer.from('fonte-falsa');

let raiz: string;
let metadataNovo: Buffer;

/** Cria uma atualização no formato de `expo export --platform ios`. */
async function criarAtualizacao(runtime: string, timestamp: number, bundle: Buffer) {
  const pasta = join(raiz, 'atualizacoes', runtime, String(timestamp));
  await mkdir(join(pasta, '_expo/static/js/ios'), { recursive: true });
  await mkdir(join(pasta, 'assets'), { recursive: true });
  await writeFile(join(pasta, '_expo/static/js/ios/entry-abc.hbc'), bundle);
  await writeFile(join(pasta, 'assets/imagem1'), IMAGEM);
  await writeFile(join(pasta, 'assets/fonte1'), FONTE);
  const metadata = Buffer.from(
    JSON.stringify({
      version: 0,
      bundler: 'metro',
      fileMetadata: {
        ios: {
          bundle: '_expo/static/js/ios/entry-abc.hbc',
          assets: [
            { path: 'assets/imagem1', ext: 'png' },
            { path: 'assets/fonte1', ext: 'ttf' },
          ],
        },
      },
    }),
  );
  await writeFile(join(pasta, 'metadata.json'), metadata);
  await writeFile(
    join(pasta, 'expoConfig.json'),
    JSON.stringify({ name: 'Holofote', slug: 'holofote', runtimeVersion: runtime }),
  );
  return metadata;
}

function app(urlPublica: string | null = URL_PUBLICA) {
  return construirApp(
    { postgres: ok, redis: ok },
    { atualizacoes: { dir: join(raiz, 'atualizacoes'), urlPublica: urlPublica ?? undefined } },
  );
}

const cabecalhos = (extra: Record<string, string> = {}) => ({
  'expo-platform': 'ios',
  'expo-runtime-version': '1',
  'expo-protocol-version': '1',
  ...extra,
});

/** Extrai a primeira parte JSON de um multipart/mixed: nome, cabeçalhos e corpo. */
function lerPartes(tipo: string, corpo: string) {
  const limite = /boundary=(.+)$/.exec(tipo)?.[1];
  expect(limite).toBeTruthy();
  return corpo
    .split(`--${limite}`)
    .filter((p) => p.trim() !== '' && p.trim() !== '--')
    .map((p) => {
      const [cab, ...resto] = p.replace(/^\r\n/, '').split('\r\n\r\n');
      const nome = /name="([^"]+)"/.exec(cab ?? '')?.[1];
      return { nome, json: JSON.parse(resto.join('\r\n\r\n').replace(/\r\n$/, '')) };
    });
}

beforeAll(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'holofote-ota-'));
  await criarAtualizacao('1', 1_700_000_000, BUNDLE_ANTIGO);
  metadataNovo = await criarAtualizacao('1', 1_800_000_000, BUNDLE);
  // Pasta temporária de um upload em andamento: não pode ser escolhida.
  await mkdir(join(raiz, 'atualizacoes', '1', '.tmp-1900000000'), { recursive: true });
  await writeFile(join(raiz, 'segredo.txt'), 'fora da pasta');
});

afterAll(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('GET /v1/atualizacoes/manifesto', () => {
  it('serve a atualização mais nova com hashes e URLs absolutas', async () => {
    const resposta = await app().inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos(),
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['expo-protocol-version']).toBe('1');
    expect(resposta.headers['expo-sfv-version']).toBe('0');
    expect(resposta.headers['cache-control']).toBe('private, max-age=0');
    expect(resposta.headers['content-type']).toMatch(/^multipart\/mixed; boundary=/);

    const [parte] = lerPartes(String(resposta.headers['content-type']), resposta.body);
    expect(parte?.nome).toBe('manifest');
    const m = parte?.json;
    expect(m.id).toBe(uuidDe(metadataNovo));
    expect(m.createdAt).toBe(new Date(1_800_000_000 * 1000).toISOString());
    expect(m.runtimeVersion).toBe('1');
    expect(m.metadata).toEqual({});
    expect(m.extra.expoClient).toMatchObject({ slug: 'holofote' });

    const caminho = (c: string) =>
      `${URL_PUBLICA}/v1/atualizacoes/arquivo?caminho=${encodeURIComponent(`1/1800000000/${c}`)}`;
    expect(m.launchAsset).toEqual({
      hash: sha256Url(BUNDLE),
      key: md5(BUNDLE),
      contentType: 'application/javascript',
      fileExtension: '.bundle',
      url: caminho('_expo/static/js/ios/entry-abc.hbc'),
    });
    expect(m.assets).toEqual([
      {
        hash: sha256Url(IMAGEM),
        key: md5(IMAGEM),
        contentType: 'image/png',
        fileExtension: '.png',
        url: caminho('assets/imagem1'),
      },
      {
        hash: sha256Url(FONTE),
        key: md5(FONTE),
        contentType: 'font/ttf',
        fileExtension: '.ttf',
        url: caminho('assets/fonte1'),
      },
    ]);
  });

  it('sem URL_PUBLICA, monta a URL com o protocolo e o host do pedido', async () => {
    const resposta = await app(null).inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos({ host: 'meu.host:3333' }),
    });
    const [parte] = lerPartes(String(resposta.headers['content-type']), resposta.body);
    expect(parte?.json.launchAsset.url).toMatch(
      /^http:\/\/meu\.host:3333\/v1\/atualizacoes\/arquivo\?/,
    );
  });

  it('responde noUpdateAvailable quando o app já está na atualização mais nova', async () => {
    const resposta = await app().inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos({ 'expo-current-update-id': uuidDe(metadataNovo) }),
    });
    expect(resposta.statusCode).toBe(200);
    const [parte] = lerPartes(String(resposta.headers['content-type']), resposta.body);
    expect(parte).toEqual({ nome: 'directive', json: { type: 'noUpdateAvailable' } });
  });

  it('serve o manifesto de novo no protocolo 0 mesmo com o id igual', async () => {
    const resposta = await app().inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos({
        'expo-protocol-version': '0',
        'expo-current-update-id': uuidDe(metadataNovo),
      }),
    });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['expo-protocol-version']).toBe('0');
  });

  it('sem atualização para o runtime: noUpdateAvailable (protocolo 1) ou 204 (protocolo 0)', async () => {
    const v1 = await app().inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos({ 'expo-runtime-version': '99' }),
    });
    expect(v1.statusCode).toBe(200);
    expect(lerPartes(String(v1.headers['content-type']), v1.body)[0]?.json).toEqual({
      type: 'noUpdateAvailable',
    });

    const v0 = await app().inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: cabecalhos({ 'expo-runtime-version': '99', 'expo-protocol-version': '0' }),
    });
    expect(v0.statusCode).toBe(204);
    expect(v0.body).toBe('');
  });

  it('responde 400 para plataforma, runtime ou protocolo inválidos', async () => {
    const pedir = (headers: Record<string, string>) =>
      app().inject({ method: 'GET', url: '/v1/atualizacoes/manifesto', headers });

    const android = await pedir(cabecalhos({ 'expo-platform': 'android' }));
    expect(android.statusCode).toBe(400);
    expect(android.json().erro).toBe('invalido');
    expect((await pedir({})).statusCode).toBe(400);
    expect((await pedir({ 'expo-platform': 'ios' })).statusCode).toBe(400);
    expect((await pedir(cabecalhos({ 'expo-runtime-version': '../..' }))).statusCode).toBe(400);
    expect((await pedir(cabecalhos({ 'expo-protocol-version': '7' }))).statusCode).toBe(400);
  });
});

describe('GET /v1/atualizacoes/arquivo', () => {
  const pedir = (caminho: string) =>
    app().inject({
      method: 'GET',
      url: `/v1/atualizacoes/arquivo?caminho=${encodeURIComponent(caminho)}`,
    });

  it('serve o arquivo com o tipo certo, sem token', async () => {
    const imagem = await pedir('1/1800000000/assets/imagem1');
    expect(imagem.statusCode).toBe(200);
    expect(imagem.rawPayload.equals(IMAGEM)).toBe(true);

    const bundle = await pedir('1/1800000000/_expo/static/js/ios/entry-abc.hbc');
    expect(bundle.statusCode).toBe(200);
    expect(bundle.headers['content-type']).toMatch(/^application\/javascript/);
    expect(bundle.rawPayload.equals(BUNDLE)).toBe(true);

    const config = await pedir('1/1800000000/expoConfig.json');
    expect(config.headers['content-type']).toMatch(/^application\/json/);
  });

  it('recusa caminhos que saem da pasta', async () => {
    for (const caminho of [
      '../segredo.txt',
      '1/../../segredo.txt',
      '/etc/passwd',
      '..',
      '',
      'a\0b',
    ]) {
      const resposta = await pedir(caminho);
      expect(resposta.statusCode, caminho).toBeGreaterThanOrEqual(400);
      expect(resposta.statusCode, caminho).toBeLessThan(500);
      expect(resposta.body).not.toContain('fora da pasta');
    }
  });

  it('recusa um link simbólico que aponta para fora da pasta', async () => {
    await symlink(join(raiz, 'segredo.txt'), join(raiz, 'atualizacoes', 'link.txt'));
    const resposta = await pedir('link.txt');
    expect(resposta.statusCode).toBe(404);
    expect(resposta.body).not.toContain('fora da pasta');
  });

  it('responde 404 para arquivo ou pasta inexistente', async () => {
    expect((await pedir('1/1800000000/nao-existe')).statusCode).toBe(404);
    expect((await pedir('1/1800000000')).statusCode).toBe(404);
  });
});
