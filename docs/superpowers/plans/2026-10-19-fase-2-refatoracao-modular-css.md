# Fase 2: Refatoração Modular, Despoluição CSS & Performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar a dívida técnica monolítica do EbookFinder através de Event Delegation no grid da estante, despoluição de mais de 600 ocorrências de `!important` no CSS, e modularização de `renderer.js` (4.067 linhas) e `style.css` (6.582 linhas) em módulos focados e testáveis sem regressões visuais ou funcionais.

**Architecture:** Adotar Event Delegation nativo no container `#grid` para suprimir milhares de event listeners concorrentes; reestruturar o CSS em camadas (`tokens`, `layout`, `cards`, `reader`, `copilot`, `responsive`) baseadas em variáveis CSS Custom Properties no `:root` e no tema Light sem necessidade de `!important`; e decompor `renderer.js` em submódulos JavaScript com responsabilidades únicas (`state`, `utils`, `shelf`, `reader`, `copilot`, `modals`, `app`) mantendo 100% de compatibilidade com Electron e Capacitor.

**Tech Stack:** JavaScript (ES6+ / Electron IPC / Capacitor Bridge), CSS3 (Custom Properties & CSS Cascade), HTML5.

**Spec:** [diagnostico_superpowers.md](file:///C:/Users/joads/.gemini/antigravity-ide/brain/bd14e243-4d1e-4a8b-8117-4a6bf310f0ea/diagnostico_superpowers.md)

## Global Constraints

- Manter 100% de compatibilidade tanto no ambiente Electron (Windows) quanto no Capacitor / Web (Android).
- Nenhuma alteração de comportamento nas 28 APIs de `window.api` nem na estrutura dos dados em `progresso_leitura.json`.
- A inicialização do aplicativo (`mainWindow.loadFile`) não pode depender de bundler ou processo de compilação adicional em tempo de desenvolvimento.
- Preservar a identidade visual *Bibliophile Dark* e *Editorial Light* com idêntico visual e responsividade.
- Reduzir `!important` de 631 para menos de 20 (permitidos apenas em classes utilitárias fundamentais como `[hidden]`).

## Review Focus

1. Clique e duplo clique nos cards da estante após Event Delegation — deve abrir leitor no duplo clique, abrir detalhes no clique, favoritar no botão estrela e abrir SkillBook no botão ✨ sem conflito entre alvos de clique.
2. Troca dinâmica de temas (Dark 🌙 vs Light ☀️) — nenhum componente deve sofrer colapso de contraste ou legibilidade devido à remoção de `!important`.
3. Navegação responsiva mobile (<= 768px) e tablet (<= 1200px) — cabeçalho compacto, busca na ordem correta e drawer flutuante do menu devem continuar funcionando fluidamente.
4. Leitor interno Split-View (PDF + SkillBook lateral) — renderização de páginas via PDF.js e scroll suave devem permanecer intactos com os novos módulos.
5. Inicialização e carregamento da biblioteca no Electron — `npx electron test-dom.js` e `npx electron test-features.js` devem passar sem erros no console.

---

### Task 1: Implementar Event Delegation no Grid da Estante (`#grid`)

**Files:**
- Modify: `app/renderer.js:735-833, 3400-3430`
- Test: `test/test_event_delegation.js`

**Interfaces:**
- Produces: Delegação unificada de eventos de clique e duplo clique no container `#grid`, identificando os livros pelo atributo `data-caminho`.
- Consumes: `state.livrosFiltrados`, `abrirCopilotoIA`, `criarSkillDiretoDoCard`, `abrirLeitorInterno`, `abrirModalLivro`, `alternarFavorito`.

- [ ] **Step 1: Criar teste automatizado para validar Event Delegation**
  Criar `test/test_event_delegation.js` verificando que os cards gerados possuem `data-caminho` e que um clique simulado em `.card-copilot-badge`, `.btn-cover-read`, `.fav-btn` e no card aciona o dispatcher correto.

- [ ] **Step 2: Rodar teste e confirmar o estado inicial**
  Executar `node test/test_event_delegation.js` e comprovar o comportamento esperado.

- [ ] **Step 3: Adicionar `data-caminho` e remover listeners por card em `renderer.js`**
  No template gerado em `renderizarLivros(livros)`:
  - Garantir `<div class="book-card" data-caminho="${escapeHtml(livro.caminho)}">`.
  - Remover todas as 8 chamadas a `.addEventListener` de dentro do loop `livros.forEach`.

- [ ] **Step 4: Implementar o dispatcher de Event Delegation em `#grid`**
  No container `#grid`:
  ```javascript
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".book-card");
    if (!card) return;
    const caminho = card.dataset.caminho;
    const livro = state.livrosFiltrados.find(l => l.caminho === caminho) || state.todosLivros.find(l => l.caminho === caminho);
    if (!livro) return;

    if (e.target.closest(".fav-btn")) {
      e.stopPropagation();
      const btnFav = card.querySelector(".fav-btn");
      alternarFavorito(livro.caminho, btnFav);
    } else if (e.target.closest(".card-copilot-badge") || e.target.closest(".btn-cover-copilot")) {
      e.stopPropagation();
      abrirCopilotoIA(livro);
    } else if (e.target.closest(".btn-cover-skill")) {
      e.stopPropagation();
      criarSkillDiretoDoCard(livro);
    } else if (e.target.closest(".btn-cover-read")) {
      e.stopPropagation();
      abrirLeitorInterno(livro);
    } else if (e.target.closest(".btn-cover-info") || card.contains(e.target)) {
      abrirModalLivro(livro);
    }
  });

  grid.addEventListener("dblclick", (e) => {
    const card = e.target.closest(".book-card");
    if (!card) return;
    const caminho = card.dataset.caminho;
    const livro = state.livrosFiltrados.find(l => l.caminho === caminho) || state.todosLivros.find(l => l.caminho === caminho);
    if (livro) abrirLeitorInterno(livro);
  });
  ```

- [ ] **Step 5: Rodar testes e validação com Electron**
  Executar `node test/test_event_delegation.js` e `npx electron test-dom.js`.
  Garantir aprovação total e 37 cards renderizados sem listeners redundantes.

- [ ] **Step 6: Commit**
  `git commit -m "perf: implementar Event Delegation no grid da estante"`

---

### Task 2: Despoluição de `!important` e Consolidação de Tokens CSS

**Files:**
- Modify: `app/style.css`
- Test: `test/test_css_cleanliness.js`

**Interfaces:**
- Produces: CSS limpo, reduzindo `!important` de 631 para menos de 20 instâncias, e centralização de tokens de cores, espaçamentos e sombras em variáveis `:root` e `body[data-theme="light"]`.

- [ ] **Step 1: Criar script de medição e validação do CSS**
  Criar `test/test_css_cleanliness.js` que conta os `!important` no CSS e falha se o número for superior a 20.

- [ ] **Step 2: Rodar o teste para registrar a contagem atual (631)**
  Executar `node test/test_css_cleanliness.js` (esperado: falha reportando 631 `!important`).

- [ ] **Step 3: Ajustar tokens no `:root` e `body[data-theme="light"]`**
  Padronizar as variáveis CSS de cor de fundo, superfícies, bordas e textos para que temas e estados não precisem forçar propriedades com `!important`.

- [ ] **Step 4: Remover os `!important` indiscriminados nas media queries mobile/tablet**
  Remover os `!important` redundantes das seções `@media (max-width: 768px)` e `@media (max-width: 1200px)` (linhas 5020-6200), confiando na ordem natural da cascata CSS.

- [ ] **Step 5: Limpar `!important` em classes de temas e cards**
  Substituir regras forçadas por seletores específicos escopados com `body[data-theme="light"]`.

- [ ] **Step 6: Rodar teste de limpeza CSS e capturar screenshots comparativas**
  Executar `node test/test_css_cleanliness.js` (esperado: PASS com < 20 `!important`).
  Executar `npx electron test-features.js` para assegurar que Modo Claro e Modo Escuro renderizam perfeitamente.

- [ ] **Step 7: Commit**
  `git commit -m "style: despoluir CSS reduzindo 631 !important para tokens limpos"`

---

### Task 3: Modularização do CSS em Arquivos Coesos (`app/css/`)

**Files:**
- Create: `app/css/tokens.css`
- Create: `app/css/layout.css`
- Create: `app/css/cards.css`
- Create: `app/css/reader.css`
- Create: `app/css/copilot.css`
- Create: `app/css/responsive.css`
- Modify: `app/style.css`
- Modify: `app/index.html:14`

**Interfaces:**
- Produces: Estrutura modular de estilos, facilitando manutenção e isolamento de escopo, mantendo `app/style.css` como bundle via `@import` ou link direto.

- [ ] **Step 1: Criar arquivo de teste de integridade modular do CSS**
  Criar script que valida que todas as classes fundamentais (`#appHeader`, `.book-card`, `#readerModal`, `#copilotoModal`, `.shelf-tabs`) estão presentes e válidas.

- [ ] **Step 2: Extrair `tokens.css`**
  Variáveis `:root`, tipografia, reset global, temas Dark e Light.

- [ ] **Step 3: Extrair `layout.css`**
  Cabeçalho, barra de busca, toolbar de estantes, menus dropdown e footer.

- [ ] **Step 4: Extrair `cards.css`**
  Estante, `.book-card`, overlays 3D, badges de status, favoritos e estados vazios.

- [ ] **Step 5: Extrair `reader.css`**
  Visualizador PDF.js, leitor EPUB/TXT, Split-View lateral, marcadores e barra de controles de leitura.

- [ ] **Step 6: Extrair `copilot.css`**
  Painel do Tutor IA Book-to-Skill, workspace do Copiloto IA, modais de diálogo e badges.

- [ ] **Step 7: Extrair `responsive.css`**
  Media queries para smartphones (<= 768px) e tablets (<= 1200px) limpas.

- [ ] **Step 8: Atualizar `app/style.css` para importar os módulos**
  Estruturar `app/style.css` como agregador limpo:
  ```css
  @import url("css/tokens.css");
  @import url("css/layout.css");
  @import url("css/cards.css");
  @import url("css/reader.css");
  @import url("css/copilot.css");
  @import url("css/responsive.css");
  ```

- [ ] **Step 9: Validar carregamento no Electron**
  Executar `npx electron test-dom.js` e `npx electron test-features.js`. Confirmar 0 erros de layout.

- [ ] **Step 10: Commit**
  `git commit -m "refactor(css): modularizar folha de estilos em app/css"`

---

### Task 4: Modularização do `renderer.js` em Submódulos Coesos (`app/js/`)

**Files:**
- Create: `app/js/state.js`
- Create: `app/js/utils.js`
- Create: `app/js/shelf.js`
- Create: `app/js/reader.js`
- Create: `app/js/copilot.js`
- Create: `app/js/modals.js`
- Modify: `app/renderer.js`
- Modify: `app/index.html:1218-1220`
- Test: `test/test_js_modules.js`

**Interfaces:**
- Produces: Separação de responsabilidades sob o namespace `window.EbookApp` com módulos independentes:
  - `EbookApp.state`: Gerenciamento do estado reativo global e tema.
  - `EbookApp.utils`: Funções de sanitização (`escapeHtml`, `sanitizarHtmlEpub`), formatação e toasts.
  - `EbookApp.shelf`: Carregamento da estante, renderização com event delegation, ordenação e filtros.
  - `EbookApp.reader`: PDF.js viewer, EPUB/TXT reader, marcadores e Split-View.
  - `EbookApp.copilot`: Tutor Book-to-Skill, chat com Groq e parser de skills.
  - `EbookApp.modals`: Gerenciamento dos modais de Configuração IA, Sobre e Métricas.

- [ ] **Step 1: Criar teste de validação dos submódulos JS**
  Criar `test/test_js_modules.js` validando a existência e contratos de `window.EbookApp` e seus métodos principais.

- [ ] **Step 2: Implementar `app/js/state.js` e `app/js/utils.js`**
  Extrair estado global, persistência de preferências de estante, `escapeHtml`, `sanitizarHtmlEpub`, `formatarBytes` e `showToast`.

- [ ] **Step 3: Implementar `app/js/shelf.js`**
  Extrair lógica de busca, filtros por abas, ordenação, renderização delegada e contadores de estante.

- [ ] **Step 4: Implementar `app/js/reader.js`**
  Extrair visualizador de PDF, paginação, EPUB/TXT parser, zoom, modo sépia/noturno e busca textual.

- [ ] **Step 5: Implementar `app/js/copilot.js`**
  Extrair chat com IA, streaming de mensagens, geração de Book-to-Skill e exportação de skills markdown.

- [ ] **Step 6: Implementar `app/js/modals.js`**
  Extrair modais de Configuração da IA, Sobre e Métricas da Biblioteca.

- [ ] **Step 7: Atualizar `app/renderer.js` como coordenador enxuto**
  Reduzir `renderer.js` de 4.067 linhas para um inicializador conciso que conecta os módulos e atalhos globais de teclado.

- [ ] **Step 8: Atualizar inclusão de scripts em `app/index.html`**
  Garantir a ordem de carregamento adequada no final do `<body>`:
  ```html
  <script src="mobile-bridge.js"></script>
  <script src="js/state.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/shelf.js"></script>
  <script src="js/reader.js"></script>
  <script src="js/copilot.js"></script>
  <script src="js/modals.js"></script>
  <script src="renderer.js"></script>
  ```

- [ ] **Step 9: Rodar teste dos módulos e verificação com Electron**
  Executar `node test/test_js_modules.js` e `npx electron test-dom.js`.
  Confirmar que todos os 37 livros carregam normalmente.

- [ ] **Step 10: Commit**
  `git commit -m "refactor(js): decompor renderer.js em submodulos especializados"`

---

### Task 5: Suíte de Verificação Completa e Validação da Fase 2

**Files:**
- Create: `test/run_all_fase2_tests.js`
- Modify: `package.json:16`

**Interfaces:**
- Produces: Script de verificação automatizada `npm test` englobando sintaxe, limpeza CSS, event delegation, paridade de módulos e integridade do DOM no Electron.

- [ ] **Step 1: Criar agregador `test/run_all_fase2_tests.js`**
  Executa sequencialmente:
  1. Verificação de sintaxe de todos os arquivos JS (`node --check`).
  2. Teste de contagem e despoluição de `!important` (< 20).
  3. Teste de Event Delegation no grid.
  4. Teste de integridade de módulos `EbookApp`.
  5. Teste de execução e renderização DOM no Electron (`test-dom.js`).

- [ ] **Step 2: Adicionar script `"test"` no `package.json`**
  `"test": "node test/run_all_fase2_tests.js"`

- [ ] **Step 3: Rodar `npm test` e verificar 100% de aprovação**
  Executar `npm test` e garantir relatório limpo sem erros.

- [ ] **Step 4: Commit final da Fase 2**
  `git commit -m "chore: validar conclusao da Fase 2 de refatoracao modular e performance"`
