# Pokédex 2.0

Uma Pokédex completa que eu construí do zero, sem framework, com **Vite + TypeScript** e a [PokéAPI](https://pokeapi.co/). O objetivo foi ir além de "buscar um Pokémon e mostrar os dados": queria uma interface com cara de produto — visual dark cinematográfico, animações, carregamento rápido e ferramentas úteis pra quem joga (explorador com filtros, montagem de time, comparação com radar).

> **Demo local:** `npm install && npm run dev` → http://localhost:5173

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Como rodar](#como-rodar)
- [Decisões de projeto](#decisões-de-projeto)
- [Arquitetura](#arquitetura)
- [Como o carregamento funciona](#como-o-carregamento-funciona)
- [Sistema de design](#sistema-de-design)
- [Atalhos de teclado](#atalhos-de-teclado)
- [Rotas e URLs](#rotas-e-urls)
- [Dados salvos no navegador](#dados-salvos-no-navegador)
- [Problemas que resolvi no caminho](#problemas-que-resolvi-no-caminho)
- [Limitações conhecidas](#limitações-conhecidas)
- [Ideias futuras](#ideias-futuras)
- [Créditos](#créditos)

---

## Visão geral

| | |
| --- | --- |
| **Stack** | HTML, CSS moderno, TypeScript, Vite |
| **Dependências de runtime** | Nenhuma — só Vite e TypeScript em dev |
| **API** | PokéAPI v2 (REST) |
| **Cache** | IndexedDB (7 dias) + memória |
| **Tamanho do build** | ~95 KB de JS e ~70 KB de CSS (gzip: ~31 KB + ~14 KB) |
| **Compatibilidade** | Navegadores modernos (usa `color-mix()`, `@property`, `@layer`, View Transitions quando disponível) |

---

## Funcionalidades

### Página do Pokémon
- **Busca** por nome ou número com sugestões instantâneas (sprite + número), navegação por teclado e histórico das últimas 10 buscas.
- **Palco** com artwork oficial, pixel art, shiny, modelo 3D (HOME) e sprite animado (Showdown), com parallax que segue o mouse e halo de luz na cor do tipo.
- **Grito do Pokémon**: botão que toca o `cries.latest` da PokéAPI; enquanto toca, o halo pulsa e o artwork vibra.
- **Ficha da espécie**: geração e região, habitat, taxa de captura (com % aproximada), proporção de gênero em barra, felicidade base, ritmo de crescimento, EXP base, EVs concedidos, cor/forma, passos para chocar e badges de Lendário / Mítico / Bebê.
- **Estatísticas base** com barras animadas, count-up dos números, destaque do maior atributo e total.
- **Dano recebido** com multiplicadores reais combinando os dois tipos (×4, ×2, ×½, ×¼, ×0). O grupo "dano normal" fica colapsado pra não poluir.
- **Linha evolutiva** em timeline com a condição de cada estágio (nível, item, troca, amizade, hora do dia, golpe conhecido, local, gênero…), clicável.
- **Habilidades** com descrição curta, descrição detalhada em português (dicionário próprio com ~300 habilidades) e efeito em jogo expansível.
- **Movimentos** separados por método (nível, ovo, tutor, TM/TR). A tabela aparece na hora e os detalhes (tipo, categoria, poder, precisão, PP) vão preenchendo conforme chegam. Tocar numa linha abre um **painel deslizante** com descrição, efeito, prioridade, alvo, chance de efeito etc. — feito assim porque `title` (tooltip) não funciona no celular.
- **Localizações** por jogo, com taxa de encontro em barra e faixa de nível.
- **Formas alternativas**: Mega X/Y, Gigantamax, regionais (Alola, Galar, Hisui, Paldea), shiny — com stats resumidos e botão pra abrir a forma completa.
- **Anterior / próximo** com pré-carregamento do artwork vizinho.
- **Favoritar**, **adicionar ao time**, **comparar** e **compartilhar** (Web Share API com fallback pra área de transferência).

### Explorar (`#explorar`)
- Grade com os **1025 Pokémon** (artwork oficial, número, nome, tipos, geração).
- Filtros: texto, até 2 tipos ao mesmo tempo, geração (I–IX); ordenação por número ou nome; contador de resultados; botão **Aleatório**.
- Scroll infinito (40 cards por lote) com `IntersectionObserver` e imagens lazy.
- Os filtros ficam na URL, então dá pra compartilhar `#explorar?type=fire,flying&gen=1`.
- Clicar num chip de tipo em qualquer Pokémon abre o explorador já filtrado.
- Cards marcam quem está nos favoritos e no time.

### Meu time (`#time`)
- Até **6 Pokémon**, salvos localmente; arrastar e soltar pra reordenar.
- **Heatmap de defesa combinada**: 18 tipos atacantes × membros do time, com contagem de quantos são fracos e quantos resistem.
- **Diagnóstico**: buracos defensivos (tipos que ferem metade do time sem ninguém resistir), tipos bem cobertos e tipos presentes no time.
- **Stats somados** com média.

### Comparar
- Dois Pokémon lado a lado com **radar de stats em SVG** (animado, nas cores dos tipos).
- **Vantagem de tipo** nos dois sentidos com veredito automático.
- Altura, peso e EXP base em barras espelhadas; habilidades; atalho pra comparar com qualquer membro do time.

### Extras
- **Favoritos** em painel lateral com remoção rápida e contador no topo.
- **Tema claro/escuro** (padrão escuro), salvo localmente.
- **Player "Now Playing"** com 12 trilhas de batalha: cada faixa tem como capa o Pokémon do tema (Cynthia → Garchomp, Rayquaza, Giratina, Red → Pikachu…), disco girando com anel de progresso na cor do tipo, equalizador, fila de reprodução com capas e durações, barra de progresso arrastável, aleatório, mudo/volume, minimizar para um disco e **Media Session** (teclas de mídia e tela de bloqueio mostram capa e título). Três layouts: pílula no desktop/tablet, barra de largura total no celular em pé e versão compacta no celular deitado.
- Avisos de online/offline; quando offline, Pokémon já visitados continuam abrindo pelo cache.
- Voltar/avançar do navegador funcionam em todas as telas.

---

## Como rodar

Precisa do **Node.js 18+** (eu usei o 24).

```bash
# 1. entrar na pasta do projeto
cd Pokédex

# 2. instalar as dependências de desenvolvimento (só na primeira vez)
npm install

# 3. subir o servidor de desenvolvimento
npm run dev
# → http://localhost:5173
```

Outros comandos:

```bash
npm run build      # typecheck + bundle em ../docs/ (pasta publicada no GitHub Pages)
npm run preview    # serve o build pra conferir antes de publicar
npm run typecheck  # só o TypeScript, sem gerar nada
```

> **Importante:** abrir o `index.html` com duplo clique não funciona — o projeto usa módulos ES e TypeScript, então precisa passar pelo Vite (`npm run dev`) ou pelo build.

### Publicar (GitHub Pages)
O `npm run build` gera o site pronto em **`docs/` na raiz do repositório** (configurado em `vite.config.ts` com `outDir: '../docs'` e `base: './'`). Pra publicar:

1. `npm run build`
2. Commit e push da pasta `docs/`
3. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/docs`**

O site fica em `https://<usuário>.github.io/<repositório>/`. Como os caminhos são relativos, o mesmo build também funciona em Netlify, Vercel ou qualquer servidor estático — é só subir o conteúdo de `docs/`.

---

## Decisões de projeto

**Por que sem framework?**
Queria ter controle total do DOM e das animações, e o projeto não tem estado compartilhado complexo o bastante pra justificar React/Vue. Um store observável de 100 linhas resolveu. O bundle final ficou pequeno e o build leva 1–3 segundos.

**Por que Vite + TypeScript?**
O `app.js` original tinha quase 3 mil linhas num arquivo só. Dividir em módulos com tipagem deixou cada parte pequena e testável, e o TypeScript pegou vários bugs de campos opcionais da PokéAPI (`sprites.other?.home?.front_default`, `base_experience: null` etc.) antes de eu rodar qualquer coisa.

**Por que REST e não o GraphQL da PokéAPI?**
O endpoint GraphQL ainda é beta. Preferi a API REST (estável, com CDN) e compensar a latência com paralelismo, cache em IndexedDB e renderização progressiva.

**Por que IndexedDB e não localStorage?**
Os dados da PokéAPI são grandes (um Pokémon com movimentos passa de 100 KB). O `localStorage` tem ~5 MB e a versão antiga vivia apagando cache pra caber. O IndexedDB tem centenas de MB e é assíncrono. Ficou com TTL de 7 dias porque esses dados praticamente não mudam.

**Por que não virou PWA?**
Cheguei a considerar, mas decidi deixar pra uma próxima versão. O cache em IndexedDB já cobre o caso mais comum (reabrir algo já visto).

---

## Arquitetura

```
Pokédex/
├── index.html              # markup da aplicação (sprite de ícones SVG inline + 3 views)
├── vite.config.ts          # base './' pra hospedagem estática
├── tsconfig.json           # strict, ES2022, DOM
├── public/
│   ├── img/                # placeholders e favicon
│   └── Music/              # trilhas do player
└── src/
    ├── main.ts             # bootstrap: liga router → views e store → render
    ├── api/
    │   ├── client.ts       # getJSON com 3 camadas de cache, dedupe, AbortSignal e pool()
    │   ├── pokeapi.ts      # endpoints tipados + índice leve (1025 espécies + tipos)
    │   └── types.ts        # tipos do subconjunto da PokéAPI que eu uso
    ├── data/
    │   ├── constants.ts    # cores/nomes dos tipos, gerações, traduções fixas
    │   ├── i18n.ts         # dicionários pt-BR de habilidades, formatName, pickFlavorText
    │   └── pokemon.ts      # monta o PokemonView (2 rodadas), dano, evolução, movimentos
    ├── state/
    │   ├── store.ts        # store observável + loadPokemon() com cancelamento
    │   ├── persist.ts      # favoritos, time, histórico, tema (localStorage com try/catch)
    │   └── router.ts       # ?pokemon= | #explorar | #time com pushState/popstate
    ├── ui/
    │   ├── dom.ts          # $, $$, escapeHtml, debounce
    │   ├── icons.ts        # svgIcon(), typeBadge()
    │   ├── motion.ts       # reveal, countUp, parallax, swapMainImage, view transitions
    │   ├── overlays.ts     # drawer, modal e bottom-sheet (foco, Esc, scroll lock)
    │   ├── search.ts       # sugestões, teclado, histórico
    │   ├── tabs.ts         # segmented control com indicador deslizante
    │   ├── shortcuts.ts    # "/", Alt+←/→
    │   └── toast.ts
    ├── views/
    │   ├── hero.ts         # cabeçalho, palco, variações, grito, ações
    │   ├── species.ts      # painel Ficha
    │   ├── stats.ts  damage.ts  evolution.ts  abilities.ts  sprites.ts
    │   ├── moves.ts        # tabela progressiva + sheet de detalhes
    │   ├── locations.ts  forms.ts
    │   ├── explorer.ts     # grade com filtros
    │   ├── team.ts         # time + heatmap
    │   └── compare.ts      # radar + vantagem de tipo
    ├── audio/player.ts     # player de música + grito + Media Session
    └── styles/
        ├── styles.css      # sistema de design (tokens, componentes, motion)
        └── features.css    # telas da 2.0 (ficha, sheet, explorador, time, radar)
```

Fluxo de dados, em uma frase: o **router** lê a URL e pede ao **store** que carregue um Pokémon; o store emite `pokemon:core` e depois `pokemon:extra`; o `main.ts` escuta esses eventos e chama as **views**, que só sabem transformar dados em HTML.

---

## Como o carregamento funciona

Essa foi a parte em que eu mais investi, porque a versão antiga demorava vários segundos e travava a tela.

1. **Rodada 1 (paralela):** `pokemon` + `species`. Assim que chega, o hero, a ficha, os stats e os sprites já aparecem. Os painéis que dependem da rodada 2 mostram skeleton.
2. **Habilidades e movimentos viram stream:** a tabela de movimentos é montada na hora com o que já vem no objeto do Pokémon (nome, método, nível) e os detalhes são buscados com um pool de 8 requisições, começando pela aba que está visível. Trocar de aba prioriza as linhas dela.
3. **Rodada 2 (paralela):** cadeia evolutiva, encontros, dados dos tipos (pra calcular o dano) e formas alternativas.
4. **Cache:** toda resposta vai pra memória e pro IndexedDB. Requisições iguais em voo são deduplicadas. No segundo acesso a um Pokémon, **zero** chamadas à PokéAPI.
5. **Cancelamento:** cada `load()` cria um `AbortController` e aborta o anterior; resultados que chegam atrasados são descartados por um token. Clicar "próximo" cinco vezes seguidas termina no Pokémon certo.
6. **Pré-carregamento:** depois de renderizar, o artwork do anterior e do próximo são baixados em segundo plano.
7. **View Transitions API** suaviza a troca de Pokémon e de telas quando o navegador suporta (com fallback silencioso).

---

## Sistema de design

- **Conceito:** um "console" premium. O Pokémon é a estrela: artwork enorme sobre um halo de luz, número da Pokédex como marca d'água, o resto em painéis de vidro discretos.
- **Cor ambiente dinâmica:** `--accent` e `--accent-2` recebem as cores dos tipos via JS e, com `@property`, a transição entre um Pokémon e outro é suave (fundo, halo, barras, botões, indicadores — tudo acompanha).
- **Tipografia:** Bricolage Grotesque (display), Manrope (corpo), JetBrains Mono (números e rótulos).
- **Tokens em `@layer`:** tokens → base → layout → components → overlays → motion → utilities. O tema claro só troca tokens.
- **Chips de tipo** com `color-mix()` pra manter contraste nos dois temas.
- **Motion:** reveal escalonado no carregamento, count-up nos números, parallax no palco, indicador deslizante nas abas; tudo desliga com `prefers-reduced-motion`.
- **Ícones:** um único sprite SVG inline, referenciado com `<use>`.
- **Responsivo:** breakpoints em 1100 / 820 / 520 px; no celular o palco vem primeiro, o bento vira uma coluna e a tabela de movimentos ganha scroll horizontal.

---

## Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `/` | Focar a busca |
| `↑` `↓` `Enter` | Navegar e escolher uma sugestão |
| `Alt + ←` / `Alt + →` | Pokémon anterior / próximo |
| `Esc` | Fechar painel, modal, sheet ou sugestões |
| `Enter` numa linha de movimento | Abrir os detalhes |

---

## Rotas e URLs

| URL | Tela |
| --- | --- |
| `/` | Pikachu (padrão) |
| `/?pokemon=6` ou `/?pokemon=charizard` | Página do Pokémon (nomes são normalizados pro ID) |
| `/?pokemon=10034` | Formas alternativas (IDs 10000+) |
| `/#explorar` | Explorador |
| `/#explorar?type=fire,flying&gen=1&q=char&sort=name` | Explorador com filtros |
| `/#time` | Meu time |

---

## Dados salvos no navegador

Nada sai do navegador do usuário.

| Onde | O quê |
| --- | --- |
| IndexedDB `pokedex-cache` | Respostas da PokéAPI (7 dias) |
| `localStorage` | `pokedex-favorites`, `pokedex-team`, `pokedex-search-history`, `pokedex-theme`, configurações do player (`pokedex-music-*`) |

Pra limpar tudo: DevTools → Application → Storage → *Clear site data*.

---

## Problemas que resolvi no caminho

- **Condição de corrida ao navegar rápido** — a resposta de um Pokémon antigo chegava depois e sobrescrevia o atual. Resolvido com `AbortController` + token de requisição no store.
- **100+ requisições antes de mostrar qualquer coisa** — os movimentos travavam o render. Agora a tabela aparece na hora e os detalhes preenchem em stream.
- **Cache estourando o `localStorage`** — a versão antiga tinha um sistema de limpeza LRU manual e "modo mínimo" pra caber em 5 MB. Migrar pra IndexedDB eliminou tudo isso.
- **Tooltips de movimentos inúteis no celular** — troquei o `title` por um bottom-sheet.
- **Descrições em inglês antigo ("POKéMON" em caixa alta)** — passei a pegar a entrada mais recente e normalizar o texto.
- **Body sumindo ao trocar de tela** — um `dataset.view` no `<body>` batia com o seletor `[data-view]` das views e escondia a página inteira. Ficou como lembrete de sempre escopar seletores (`.view[data-view]`).
- **Radar SVG com 1.25em de altura** — a regra global de ícones (`svg { width: 1.25em }`) pegava o gráfico. Precisou de `height: auto; aspect-ratio: 1` e `stroke: none` explícitos.
- **"Transition was skipped"** — a View Transitions API rejeita a promessa quando uma transição interrompe outra; bastou tratar `ready/finished`.

---

## Limitações conhecidas

- Descrições de Pokémon, movimentos e habilidades vêm em inglês quando a PokéAPI não tem pt-BR (a maioria dos casos). Nomes de tipos, stats, grupos de ovos, habitats etc. eu traduzi manualmente; ~300 habilidades têm nome e descrição em português.
- O índice de tipos do explorador faz 18 requisições na primeira abertura (uma por tipo) — depois fica em cache.
- A PokéAPI tem limite de uso justo; em redes muito lentas o carregamento inicial de um Pokémon com 100+ movimentos pode levar alguns segundos até preencher tudo (mas a tela já está usável).
- Não é PWA (não instala nem funciona 100% offline).

---

## Ideias futuras

- PWA com service worker (offline completo e instalável)
- Calculadora de dano e de stats por nível/natureza/EVs
- Comparação de até 6 Pokémon ao mesmo tempo
- Exportar/importar o time (JSON ou link)
- Filtro por habilidade, grupo de ovos e faixa de stats no explorador
- Traduções pt-BR completas de movimentos

---

## Créditos

- Dados: [PokéAPI](https://pokeapi.co/) e [PokeAPI/sprites](https://github.com/PokeAPI/sprites).
- Fontes: Bricolage Grotesque, Manrope e JetBrains Mono (Google Fonts).
- Pokémon e todos os nomes relacionados são propriedade de Nintendo / Creatures Inc. / GAME FREAK Inc. Este é um projeto de estudo, sem fins comerciais.

Licença MIT — veja `LICENSE`.
