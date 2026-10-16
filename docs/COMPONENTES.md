<!-- Levantamento feito no Figma em 16/10/2026 (F1), só leitura. Serve de referência para as telas das próximas fases; as normalizações adotadas no código estão em docs/DECISOES.md. -->

# Especificação visual dos componentes (Figma → React Native)

Arquivo `z4hwlJgPHTikSzQ9yfjAI9`, página "Telas v2 · Cromo". Levantamento só de leitura.

## Convenções deste documento

- Cores pelo nome da variável (`cromo/...`). As variáveis têm modo claro e escuro; nas telas escuras os mesmos nomes estão ligados, então "claro e escuro iguais" significa mesmo token, valor do modo.
- Efeitos e gradientes pelo nome do estilo. Nas telas escuras os estilos trocam de família: `Cromo/X` → `Cromo Escuro/X` (Elevação, Afundado, Esfera, Esfera clara; gradientes Pílula preta, Esfera preta, Esfera clara). Só aponto o escuro quando há algo além dessa troca.
- Inversão importante no escuro: `Cromo Escuro/Pílula preta` é clara (#F4F5F5 → #C9CCCC), `Cromo Escuro/Esfera preta` é cromo claro e `Cromo Escuro/Esfera clara` é cromo escuro. `cromo/primario-texto` também inverte (claro #f6f6f6, escuro #141515). Tudo que está "sobre pílula/esfera preta" fica escuro sobre claro no modo escuro.
- Hex só aparece quando não há variável/estilo ligado, e está marcado como **sem variável**.
- O MCP lista estilos de pintura e de efeito com o mesmo nome uma vez só (ex.: `Cromo/Esfera clara` é gradiente e efeito). Quando digo "gradiente Esfera clara + efeito Esfera clara" é isso.
- Ícones: o nome da camada é `icon/<nome>`; o SVG exportado tem traço com espessura absoluta (px), que varia de ícone para ícone (anotado em cada bloco). Em lucide isso pede `absoluteStrokeWidth` ou ajuste de `strokeWidth` por tamanho.
- Nenhum destes componentes existe como componente do Figma: o quadro `Componentes · Cromo` (12:2) só tem Avatar, Barra de status, Barra de abas, Post e Botão metal. Tudo abaixo são frames soltos repetidos nas telas, sem variantes nem propriedades.

---

## BotaoSuave

1. **Onde**: 10 Aparência `28:446` (voltar); 03 Post `17:169` (mais); escuro 10 `31:1175`. Também em 12, 13, 14, 15, 16, 18, 20, 21, e dentro de linhas (01 `14:38` lápis, 02 `16:102`, 21 `57:1789`).
2. **Dimensão**: 40 × 40 fixo, raio 20 (círculo), conteúdo centralizado, sem padding. Ícone 18 × 18 (posição 11,11). Exceção: lápis 16 × 16 em `14:38`.
3. **Cores**: fundo `cromo/superficie-2`; sem borda; ícone `cromo/texto`. Escuro: mesmos tokens.
4. **Texto/efeito**: sem texto; **sem efeito** (nem sombra nem afundado), só cor chapada.
5. **Variantes e estados**: nenhum estado de pressionado/desativado desenhado. Existe uma variante irmã **elevada** (`botao-elevado`), usada sobre a capa de perfil:
   - 08 `26:371` (40 × 40, voltar/mais) e 05 `19:251`, `19:256` (38 × 38, raio 19, ícone 17).
   - Fundo `cromo/superficie` + efeito `Cromo/Elevação`; ícone `cromo/texto`.
6. **Ícones**: `icon/arrow-left` (lucide arrow-left, bate), `icon/more` (lucide **ellipsis**, nome não bate), `icon/x`, `icon/pencil`, `icon/pen`, `icon/arrow-up-right`, `icon/share` (lucide share/share-2, não conferi a forma), `icon/sliders` (lucide sliders-horizontal/vertical, não conferi), `icon/message-square`, `icon/globe`, `icon/book`. Traço do SVG: 1,8 px em 18 px.
7. **Atenção**: a versão suave não tem sombra; a "borda branca de 1 px" só aparece na variante elevada (é a sombra interna de Elevação).

---

## Chip

1. **Onde**: 01 Criar mundo `14:44` (universos); 12 Compor post `53:1344` (tons); 03 Post `17:188` (ações) e `17:218` (efeitos), `17:238` (desfazer); 13 `53:1438` (novas respostas); 17 `55:1573` (AO VIVO); 18 `56:1518`; 04 `18:289` (ações rápidas); 15 `54:1524`; 10 `28:460` (efeito); 05 `19:385` (editar persona). Escuro: 01 `30:508`, 03 `30:817`, 13 `58:1770`.
2. **Dimensão**: altura pelo conteúdo, largura hug. Raio 999. Gap ícone–texto 6. Três tamanhos de padding aparecem:
   - **grande** px 14, py 9 (01, 05) → 38 com borda / 36 sem borda;
   - **médio** px 12, py 7 (03, 12, 13, 15, 17, 18) → 34 com borda / 32 sem borda; 04 e desfazer de 03 usam py 8 (36 com borda / 34 sem);
   - **pequeno** px 10, py 6 (10, efeito) → 30; desfazer de 09 usa px 11, py 7 (32).
     Ícone 14 × 14 (15 no desfazer de 03, 13 no de 09).
3. **Variantes de cor** (texto sempre `Cromo/Legenda`):
   - **linha**: borda 1 px `cromo/linha`, texto `cromo/texto`, ícone `cromo/texto`. O fundo varia: `cromo/superficie` em 01 e 04; `cromo/fundo` em 03, 12, 18. Sem efeito.
   - **linha tracejada** ("Criar do zero", `14:57`): fundo `cromo/fundo`, borda 1 px **tracejada** `cromo/texto-fraco`, texto e ícone `cromo/texto-suave`.
   - **afundado** (`54:1524`, `17:238`, `27:442`): fundo `cromo/superficie-2` + efeito `Cromo/Afundado`, sem borda; texto e ícone `cromo/texto`.
   - **destaque** (`53:1438`, `55:1573`): fundo `cromo/destaque`, texto e ícone `cromo/destaque-sobre`, sem borda, sombra externa 0/6/8 na cor `cromo/destaque-brilho` (variável ligada à cor da sombra).
   - **suave** (`28:460`): fundo `cromo/destaque-suave`, texto `cromo/destaque-tinta`, sem borda, sem efeito (sem ícone no exemplo).
   - **primário** (selecionado; `14:45`, `53:1347`): gradiente `Cromo/Pílula preta` (vertical, de cima #3E4242 para baixo #111212), texto e ícone `cromo/primario-texto`, sem borda. Em 01 tem efeito `Cromo/Esfera`; em 12 **não tem sombra nenhuma**. Escuro: `Cromo Escuro/Pílula preta` (clara) + `Cromo Escuro/Esfera`, texto/ícone escuros (`primario-texto` #141515).
   - **elevado** (`19:385`, "Editar persona"): fundo `cromo/superficie`, borda 1 px `cromo/linha`, efeito `Cromo/Elevação`, texto/ícone `cromo/texto`.
4. **Estados**: selecionado = primário com `icon/check` à esquerda (01, 12); não selecionado = linha sem ícone. Contador ativo (curtida dada, 03 `17:200`) = fundo `cromo/destaque` + texto `cromo/destaque-sobre` + ícone `cromo/destaque-sobre`.
5. **Ícones**: `icon/check`, `icon/plus`, `icon/message-circle`, `icon/repeat`, `icon/heart`, `icon/trending-up`, `icon/trending-down`, `icon/flame`, `icon/target`, `icon/music`, `icon/calendar`, `icon/eye`, `icon/radio`, `icon/pencil`, `icon/zap` — todos batem com lucide. `icon/up` = lucide **arrow-up** (geometria confere). `icon/undo` = lucide **undo-2** (geometria confere). Traço: 2 px em 14 px (check, 15 px sun), 1,17 px no arrow-up de 14.
6. **Atenção**:
   - O chip selecionado de 01 tem 36 de altura e os vizinhos 38, porque só os não selecionados têm borda. Para não "pular" ao selecionar, compense a borda (ex.: borda transparente no selecionado).
   - O contador ativo de 03 (`17:200`, escuro `30:829`) usa sombra **sem estilo ligado**, com os valores do Cromo/Esfera claro (0/1/2 #0000001F, 0/8/16 #00000038, interna 0/2/2 #FFFFFF4D) **inclusive no escuro**. Já os chips destaque de 13 e 17 usam o brilho `cromo/destaque-brilho`. São dois tratamentos diferentes para o mesmo fundo.
   - "Desfazer · 2" em 09 (`27:442`) põe um `icon/zap` 12 px **depois** do texto, dentro do chip afundado.

---

## Esfera

1. **Onde**: 06 Jornada `20:356` (zap, 40) e trilha de marcos `20:310`; 07 Alertas `25:368` (40); 12 `53:1361` (32); 14 `54:1361` (36); 15 `54:1537` (52, clara); 16 `55:1418` (56); 18 `56:1471` (104 com halo `56:1470`) e `56:1484` (32, clara); 19 folha `56:1628` (60); 02 `16:39` (48) e `16:62` (22, sobre o avatar da história); 03/04/13 botão enviar `53:1547` (40). Escuro: 06 `30:1244`, 19 `58:2518`, 03 `30:885`.
2. **Dimensão**: quadrada, raio = metade do lado. Tamanhos vistos: 22, 32, 36, 38, 40, 44, 48, 52, 56, 60, 104. Ícone centralizado com ≈ 45 % do lado: 22→12, 32→14, 36→16, 38→18, 40→18, 44→18, 48→22, 52→23, 56→25, 60→27, 104→47.
3. **Cores**:
   - **preta** (padrão): gradiente `Cromo/Esfera preta` + efeito `Cromo/Esfera`; ícone `cromo/primario-texto`. Escuro: `Cromo Escuro/Esfera preta` (cromo claro) + `Cromo Escuro/Esfera`; ícone continua `primario-texto` (fica escuro).
   - **clara** (`54:1537`, `56:1484`): gradiente `Cromo/Esfera clara` + efeito `Cromo/Esfera clara`; ícone `cromo/texto`.
4. **Texto/efeito**: sem texto (exceto marcos, ver 5). Efeitos acima.
5. **Variantes e estados** (marcos de 06, 38 × 38, `20:311`–`20:324`):
   - concluído: esfera preta + `icon/check` 18 `primario-texto`;
   - atual: fundo `cromo/superficie`, borda 2 px `cromo/destaque`, efeito `Cromo/Elevação`, número `Cromo/Corpo forte` `cromo/texto`;
   - futuro: fundo `cromo/superficie-2` + `Cromo/Afundado`, número `Cromo/Corpo forte` `cromo/texto-fraco`; o último usa `icon/crown` 16 `cromo/texto-fraco`;
   - conectores entre marcos: 3 px de altura, raio 2, flex 1; `cromo/destaque-grafico` até o marco atual, `cromo/linha` depois.
   - Halo de 18 (`56:1470`): círculo 150 × 150 com fundo `cromo/destaque-suave` e sombra 0/10/20 na cor `cromo/destaque-brilho`, esfera 104 centralizada.
   - Esfera 22 da história (`16:62`): sobreposta ao avatar 56, no canto inferior direito (x 42,5, y 42,5 dentro do anel de borda 1,5 `cromo/linha` com padding 3).
6. **Ícones**: `icon/zap`, `icon/calendar`, `icon/trending-up`, `icon/check`, `icon/crown`, `icon/plus`, `icon/send`, `icon/inbox`, `icon/trophy`, `icon/gem`, `icon/user-check`, `icon/ticket`, `icon/heart`, `icon/mic`, `icon/users`, `icon/flame` (batem com lucide); `icon/mega` → lucide **megaphone**; `icon/news` → lucide **newspaper**; `icon/estrela` **não é lucide**: é uma estrela de 4 pontas com uma menor ao lado, **preenchida** (sem traço). Traço: zap 2 px em 18, 3,6 px em 27.
7. **Atenção**: o gradiente é radial com centro em (35 %, 30 %) da caixa e raio 62,5 % do lado (luz em cima à esquerda); não é centrado. No efeito Cromo/Esfera claro a sombra interna é branca e **para baixo** (0/2/2); no Cromo Escuro/Esfera é preta e **para cima** (0/−2/3).

---

## Cartao

1. **Onde**: 10 `28:452` (prévia), `28:536` (ajustes); 06 `20:299`; 08 `26:419`; 07 `25:388`; 14 `54:1372`; 13 `53:1443`. Escuro: 10 `31:1184`, `31:1267`.
2. **Dimensão**: largura total do conteúdo (358 = tela − 2 × 16), altura pelo conteúdo, `overflow` cortado. Raio **24**. Padding 16 em cartões de conteúdo (gap interno 8 a 12); 14 no cartão de conversa de 13. Cartões que agrupam linhas de lista usam px 16 / py 4 (01, 10) ou px 14 / py 4 (07) ou px 14 / py 2 (14).
3. **Cores**: fundo `cromo/superficie`; sem borda.
4. **Efeito**: `Cromo/Elevação` (claro: 0/1/2 #0000000D, 0/10/24 #00000012, interna 0/1/0 #FFFFFFE5). Escuro: `Cromo Escuro/Elevação` (0/1/2 #00000066, 0/10/24 #00000080, interna 0/1/0 #FFFFFF0F).
5. **Variantes**:
   - linha do tempo de 09 (`27:465`): raio **22**, px 16, py 14, gap 8, mesmo fundo/efeito.
   - cartão-linha (14 `54:1360` "pedidos"): raio **20**, px 14, py 12, mesmo fundo/efeito.
   - cartão afundado (13 `53:1424`, post original): fundo `cromo/superficie-2` + `Cromo/Afundado`, raio 20, padding 12, sem sombra externa.
   - cartão contornado (opções da folha 19, `56:1634`): fundo `cromo/fundo`, borda 1 px `cromo/linha`, raio 20, sem efeito.
6. **Ícones**: nenhum próprio.
7. **Atenção**: a "borda branca de 1 px" no topo é a sombra interna 0/1/0 do estilo Elevação, não um `border`. Em RN precisa de sombra interna (ou uma linha de 1 px no topo com essa cor) além da sombra externa dupla.

---

## Segmentado

1. **Onde**: 10 `28:472` (tema, com ícones); 13 `53:1430` (só texto); 06 `20:362` (2 opções com ícone); 07 `25:337` e 09 `27:415` (4 opções); 21 `57:1722`. Escuro: 10 `31:1203`, 13 `58:1762`.
2. **Dimensão**: largura total; trilho com padding 4, gap 4, raio 999, `overflow` cortado. Opções `flex: 1` (iguais), raio 999. Padding da opção: só texto px 10 / py 9 → trilho 44; com ícone p 10 → 46; em 06 px 12 / py 10 → 46. Gap ícone–texto 6; ícone 15 (10) ou 14 (06).
3. **Cores**: trilho `cromo/superficie-2` + `Cromo/Afundado`. Opção selecionada: fundo `cromo/superficie` + `Cromo/Elevação`, texto `cromo/texto`. Não selecionada: sem fundo, texto `cromo/texto-suave`.
4. **Texto/efeito**: `Cromo/Legenda` em todas as opções.
5. **Estados**: ícone muda com a seleção, mas de forma diferente por tela:
   - 10: selecionado `cromo/texto`, não selecionado `cromo/texto-suave`;
   - 06: selecionado `cromo/destaque-tinta` (coroa), não selecionado `cromo/texto-fraco` (play) enquanto o texto fica `texto-suave`.
6. **Ícones**: `icon/sun`, `icon/moon`, `icon/monitor`, `icon/play`, `icon/crown` (todos lucide). Traço 2 px em 15 px.
7. **Atenção**: no escuro 10 (`31:1204`) a opção **não** selecionada "Claro" ficou com um efeito de sombra sem fundo (resto de edição); não replicar.

---

## BarraProgresso

1. **Onde**: 05 `19:287`; 06 `20:292` (topo), `20:303`, `20:337`; 10 `28:462`; 08 `26:412`; 04 `18:248`; 16 `55:1453`; 12 `53:1367`; 17 `55:1600`; 15 `54:1478`; passos de 01 `14:21`. Escuro: 10 `31:1193`, 06 `30:1270`.
2. **Dimensão**: largura do container (326, 286, 282) ou fixa (96 no topo de 06, 40 em 04). Altura e raio (= metade da altura):
   - 8 / 4 (05, 06 objetivo e topo, 08, 10);
   - 6 / 3 (06 requisitos, 16 indicados, 12 prévia);
   - 5 / 2,5 (04, mini barra ao lado do texto, gap 8);
   - 4 / 2 (17, cronômetro);
   - 3 / 1,5 (15, segmentos de história).
     Preenchimento alinhado à esquerda, mesma altura e mesmo raio do trilho.
3. **Cores**:
   - padrão: trilho `cromo/superficie-2` + `Cromo/Afundado`, preenchimento `cromo/destaque-grafico`;
   - 12 e 17: trilho `cromo/superficie-2` **sem** Afundado, preenchimento `cromo/destaque` (não `destaque-grafico`);
   - 15 (história): trilho `cromo/linha`, sem efeito; segmento visto `cromo/texto`, atual `cromo/destaque`, gap 4 entre segmentos.
4. **Texto/efeito**: rótulos ao redor são `Cromo/Corpo` (nome), `Cromo/Legenda` `texto-suave` (valor "2 de 4") ou `Cromo/Corpo forte` (porcentagem "4%", "24%").
5. **Variante passos** (01 `14:21`): segmentos separados, gap 6, altura 5, raio 3; concluído 26 de largura `cromo/destaque-grafico`; pendente 14 de largura `cromo/linha`; sem Afundado; seguido de `Cromo/Mini` `texto-suave` ("PASSO 2 DE 3").
6. **Ícones**: nenhum na barra (em 05 há `icon/up` 12 `texto-suave` ao lado do valor).
7. **Atenção**: a sombra interna (Afundado) é parte do trilho; no escuro ela vira `Cromo Escuro/Afundado` (preto 70 % para dentro, branco 6 % embaixo). O controle deslizante de 01 (`14:67`) não é BarraProgresso: está achatado em vetor (trilho 8 + Afundado, botão 26 com Esfera clara).

---

## Custo

1. **Onde**: 13 `53:1543`; 03 `17:312`; 04 `18:311`; 15 `54:1533`; 16 `55:1488` (acessório de linha). Escuro: 03 `30:881`.
2. **Dimensão**: hug; px 10, py 6, gap 4, raio 999 → 30 de altura (42 de largura com "1", 45 com "2").
3. **Cores**: fundo `cromo/superficie-2`; sem borda; ícone `cromo/texto`; número `cromo/texto`.
4. **Texto/efeito**: número `Cromo/Legenda`; efeito `Cromo/Afundado` (escuro `Cromo Escuro/Afundado`).
5. **Variantes e estados**: só o estado normal. Não há estado "sem energia suficiente" desenhado. Variante embutida no chip afundado "Desfazer · 2" de 09 (zap 12 depois do texto).
6. **Ícones**: `icon/zap` 13 × 13 (lucide zap).
7. **Atenção**: o botão de publicar de 12 (`53:1394`, Botão metal) **não** usa Custo: o custo está só no texto do botão ("Publicar · 1 energia"), sem ícone nem pílula.

---

## Rotulo

1. **Onde**: tag neutra 13 `53:1513` ("FÃ"); tag destaque 14 `54:1405` ("NOVO"); escuro 13 `58:1849`. Rótulo de seção: 17 `55:1596`, 14 `54:1370`, 12 `53:1342`. Rótulo de mapa: 21 `57:1740`, `57:1744`. Pílula de data: 08 `26:425`.
2. **Dimensão**:
   - **tag**: px 7, py 2, raio 999 → 18 de altura; fica no cabeçalho da linha com gap 6.
   - **rótulo de seção**: linha de largura total, padding top 4 e laterais 4; texto à esquerda, espaçador, meta opcional à direita.
   - **rótulo de mapa**: px 8, py 2, raio 999, gap 4 → 22.
   - **pílula de data**: px 8, py 4, raio **8** (não é pílula).
3. **Cores**:
   - tag neutra: fundo `cromo/superficie-2`, texto `cromo/texto-suave`;
   - tag destaque: fundo `cromo/destaque-suave`, texto `cromo/destaque-tinta`;
   - rótulo de seção: sem fundo, texto `cromo/texto-suave`; meta `cromo/destaque-tinta` ("decida em 0:24");
   - rótulo de mapa: fundo `cromo/superficie`, nome `cromo/texto`, valor `cromo/texto-suave`;
   - pílula de data: fundo `cromo/superficie-2`, texto `cromo/texto-suave`.
4. **Texto**: tag e rótulo de seção em `Cromo/Mini` (11/14, SemiBold, espaçamento 4 % = 0,44 px), conteúdo em maiúsculas digitadas; meta do rótulo de seção, rótulo de mapa e pílula de data em `Cromo/Legenda`. Sem efeitos.
5. **Variantes**: só neutra e destaque para tag.
6. **Ícones**: nenhum (o rótulo "O QUE ELA LEMBRA DE VOCÊ" de 08 `26:420` tem `icon/estrela` 13 e texto `destaque-tinta`, gap 6).
7. **Atenção**: **"figurante" e "puxou conversa" não existem como etiqueta.** "figurantes" só aparece dentro da frase "+ 37 figurantes: fãs, críticos e jornalistas" (01 `14:105`, `Cromo/Legenda` `texto-suave`); "puxou conversa:" é o começo do texto da prévia em 14 (`54:1382`), no mesmo estilo do resto da frase (`Cromo/Corpo forte`).

---

## Folha

1. **Onde**: 19 Sem energia `56:1626` (folha) e `56:1625` (escurecer). Escuro `58:2516`, `58:2515`.
2. **Dimensão**: largura total (390), altura pelo conteúdo (577 no exemplo), presa embaixo. Raio 32 só nos cantos de cima. Padding top 10, laterais 20, base 34; coluna centralizada com gap 14.
   - alça: 40 × 5, raio 3, `cromo/texto-fraco`, primeiro item;
   - esfera 60 (preta) com `icon/zap` 27;
   - lista de opções: largura total, gap 8.
3. **Cores**: fundo `cromo/superficie`. Escurecer: **rgba(0,0,0,0.42), sem variável**, igual no claro e no escuro.
4. **Texto/efeito**: folha com `Cromo/Elevação` (inclui a linha branca de 1 px no topo). Título `Cromo/Título` `cromo/texto` centralizado; descrição `Cromo/Corpo` `cromo/texto-suave` centralizada; "Agora não" `Cromo/Corpo forte` `cromo/texto-suave` (ação de texto, sem fundo).
5. **Opções** (`56:1634`): raio 20, px 14, py 12, gap 12, ícone 20 `cromo/texto`; título `Cromo/Corpo forte` `texto`, subtítulo `Cromo/Legenda` `texto-suave` (gap 1); valor à direita `Cromo/Legenda` `texto-suave`. Normal: fundo `cromo/fundo` + borda 1 px `cromo/linha`. Em destaque (Holofote Plus `56:1659`): fundo `cromo/destaque-suave`, **sem borda**, textos e ícone `cromo/destaque-tinta`, sem valor.
6. **Ícones**: `icon/zap`, `icon/clock`, `icon/tv`, `icon/gem`, `icon/crown` (lucide). Traço 1,67 px em 20 px; 3,6 px no zap de 27.
7. **Atenção**: a opção em destaque tem 64 de altura e as outras 66 por causa da borda (mesmo caso do chip). O escurecer é uma camada separada atrás da folha, cobrindo a tela inteira, inclusive a barra de abas.

---

## Comentario

1. **Onde**: 13 Respostas `53:1443` (cartão de conversa) com `53:1444` (comentário), `53:1472` (aninhado), `53:1524` (digitando), `53:1487` (linha). Escuro `58:1775`. Em 03 as respostas são instâncias do componente **Post** (`17:246`), não Comentario.
2. **Dimensão**: dentro de um Cartao (raio 24, padding 14, gap 12 entre blocos).
   - comentário: linha com gap 10, alinhada ao topo; avatar 36; coluna de texto `flex 1`, gap 3; cabeçalho com gap 6, centralizado verticalmente; ações com padding top 4, gap 14; cada ação ícone 14 + número, gap 5.
   - aninhado: recuo à esquerda de **46** (= avatar 36 + gap 10), gap 8; avatar 28; só a ação de curtir; depois "Ver mais N respostas".
   - separador: 1 px de altura, largura total interna, `cromo/linha`, entre comentários de primeiro nível.
   - digitando: avatar 28 + bolha 50 × 24 (raio 12) + texto, gap 10, centralizado.
3. **Cores**: nome `cromo/texto`; hora `cromo/texto-suave`; corpo `cromo/texto`; números e ícones de ação `cromo/texto-suave`; "Responder" e "Ver mais N respostas" `cromo/destaque-tinta`. Bolha: fundo `cromo/superficie-2`, 3 pontos de 6 px (centros a 15, 25, 35), o primeiro `cromo/texto-suave` e os outros `cromo/texto-fraco`.
4. **Texto**: nome `Cromo/Corpo forte`; hora `Cromo/Legenda`; corpo `Cromo/Corpo`; ações, "Responder", "Ver mais" e "está digitando" `Cromo/Legenda`. Sem efeito no comentário (o efeito é do cartão).
5. **Variantes**: com selo verificado após o nome (`icon/verificado` 15); com tag (Rotulo neutro "FÃ"); aninhado; digitando. Não há estado de curtido desenhado aqui.
6. **Ícones**: `icon/message-circle`, `icon/repeat`, `icon/heart` (14, lucide, traço 2 px). `icon/verificado` **não é lucide**: selo parecido com lucide badge-check, mas preenchido com `cromo/primario` e com o check em `cromo/primario-texto`.
7. **Atenção**: não há linha vertical de conversa ligando pai e filho; a hierarquia é só o recuo de 46 e o avatar menor. As ações do aninhado não têm "Responder".

---

## LinhaDeLista

1. **Onde**: 07 Alertas `25:349` (avatar), `25:367` (esfera), container `25:388`; 14 Mensagens `54:1373` (container `54:1372`); 10 Aparência `28:537` (ajuste); 01 `14:83` (personagem); 05 `19:321` (relação); 18 `56:1483` (recompensa); 16 `55:1480` (ação com custo); 20 `57:1651` (pendência com chevron). Escuro: 10 `31:1268`.
2. **Dimensão**: largura total do cartão, altura pelo conteúdo, gap 12 entre colunas. Padding vertical: 12 (07, 10, 14), 10 (01, 05), 11 (18). Sem padding horizontal (vem do cartão). Separador: borda inferior 1 px `cromo/linha` em todas as linhas menos a última. Coluna central `flex 1`.
   - Avatar/esfera à esquerda: 40 (07, 01, 05, 20), 44 (14), esfera clara 32 (18), esfera 36 (16).
   - Alinhamento: ao topo em 07 (meta com padding top 2); centralizado nas demais.
3. **Cores e texto por coluna**:
   - título: `Cromo/Corpo forte` `cromo/texto`. Em 07 o título é texto misto: nome em `Corpo forte` + resto em `Cromo/Corpo`, ambos `texto`, largura 218.
   - subtítulo: `Cromo/Legenda` `cromo/texto-suave` (gap 2 em 07 e 14, 0 em 01 e 05).
   - terceira linha (14): `Cromo/Legenda` `cromo/texto-fraco` (ex.: "Parceria criativa · 72%").
   - valor/acessório à direita:
     - hora `Cromo/Legenda` `texto-suave` + ponto não lido 9 × 9 `cromo/destaque` abaixo (gap 8) — 07;
     - interruptor 44 × 26 — 01, 10 (em 10 o título é só `Cromo/Corpo` `texto`, sem avatar);
     - porcentagem `Cromo/Corpo forte` `texto` + variação (ícone 11 + `Legenda` `texto-suave`, gap 3), coluna alinhada à direita, gap 2 — 05;
     - valor `Cromo/Corpo forte` `cromo/destaque-tinta`, rótulo à esquerda `Cromo/Corpo` `texto-suave` — 18;
     - Custo — 16;
     - `icon/chev` 16 `cromo/texto-suave` — 14 pedidos, 20.
4. **Efeito**: nenhum na linha (efeito é do cartão).
5. **Estados** (14): não lida → prévia em `Corpo forte` `texto`, hora `destaque-tinta`, ponto 9 px `cromo/destaque` à direita da prévia (gap 8); lida → prévia `Cromo/Corpo` `texto-suave`, hora `texto-suave`, sem ponto. Prévia em uma linha com reticências. Cabeçalho: nome + selo/tag opcionais + espaçador + hora.
6. **Ícones**: `icon/chev` = lucide **chevron-right** (traço 1,33 px em 16); `icon/down` = lucide **arrow-down** (traço 2,2 px em 11); `icon/up` = lucide **arrow-up**; `icon/flat` (05) provavelmente seta/traço horizontal, não conferi; `icon/verificado` custom (ver Comentario).
7. **Atenção**: a hora de não lida muda de cor (`destaque-tinta`), não só o ponto. Em 07 a meta da direita tem largura variável (37–38) e o texto central tem largura fixa 218; em RN use `flex 1` no centro.

---

## Interruptor

1. **Onde**: 10 `28:540` (ligado), `28:550` (desligado); 01 `14:89`. Escuro: 10 `31:1271` (ligado), `31:1281` (desligado).
2. **Dimensão**: 44 × 26 fixo, raio 13. Botão (bola) 20 × 20, a 3 px das bordas: x = 3 desligado, x = 21 ligado; y = 3.
3. **Cores**:
   - ligado: trilho gradiente `Cromo/Pílula preta` (vertical #3E4242 → #111212), sem sombra interna;
   - desligado: trilho `cromo/superficie-2` + `Cromo/Afundado`;
   - bola: gradiente radial branco → #ECEDED (55 %) → #C3C6C6, centro a (7, 6) da bola, raio 12,5, + efeito `Cromo/Esfera clara`. O MCP só confirma o efeito; o preenchimento tem os mesmos stops do gradiente Esfera clara.
   - escuro ligado: trilho `Cromo Escuro/Pílula preta` (**claro**, #F4F5F5 → #C9CCCC) e bola **escura**; escuro desligado: trilho `cromo/superficie-2` (escuro) + `Cromo Escuro/Afundado`, bola escura.
   - bola no escuro: **sem variável/estilo confirmado**, #5A5E62 → #2E3134 (55 %) → #17191B, + efeito `Cromo Escuro/Esfera clara`. Tem um stop a menos que o `Cromo Escuro/Esfera clara` do avatar.
4. **Texto/efeito**: sem texto; efeitos acima.
5. **Estados**: ligado / desligado. Não há desativado desenhado.
6. **Ícones**: nenhum.
7. **Atenção**: o interruptor está achatado em vetor no Figma (a exportação vira uma imagem só; os filhos não aparecem no `get_metadata`, a bola é `28:541`/`28:551`). O trilho corta o conteúdo (`clip`), então a sombra grande da bola (0/6/14) fica recortada dentro da pílula, não vaza para fora.
