# Fase 3: Interface & Design Editorial (Toolbar Unificado, Cards Despoluídos e Menu de Contexto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar e despoluir a experiência de usuário do EbookFinder unificando as três barras do topo em um Toolbar único de alta ergonomia, simplificando os cards de livros para valorizar capas editoriais 2:3, e adicionando um menu de contexto de clique direito completo e elegante.

**Architecture:** Consolidar as seções `control-row-top` e `control-row-bottom` em um `<nav class="unified-toolbar">` flexível com badges sutis; simplificar o DOM gerado em `renderizarGrade` mantendo apenas 2 ações principais no hover (`Ler` e `SkillBook`) e metadados organizados; e acoplar um menu de contexto flutuante acessível via delegação de evento `contextmenu` em `#grid` com integração total às APIs de leitura, IA e sistema de arquivos.

**Tech Stack:** HTML5, CSS3 (Camadas modulares em `app/css/`), JavaScript ES6+ (Electron IPC / Capacitor Bridge).

**Spec:** [diagnostico_superpowers.md](file:///C:/Users/joads/.gemini/antigravity-ide/brain/bd14e243-4d1e-4a8b-8117-4a6bf310f0ea/diagnostico_superpowers.md) (Seção 5 e 6).

## Global Constraints

- Manter 100% de compatibilidade tanto no Electron (Windows) quanto no Capacitor / Web (Android).
- Nenhuma quebra nos IDs existentes necessários para testes e scripts (`tabTodos`, `tabFavoritos`, `tabLendo`, `tabConcluidos`, `tabQueroLer`, `resultsCount`, `selectOrdenacao`, `viewModeGroup`, `currentPathInfo`).
- Zero dependências de bibliotecas de componentes externas; utilizar CSS puro e SVGs leves.
- Manter suporte integral aos modos Dark (Bibliophile Dark) e Light (Editorial Clean).

## Review Focus

1. Redução de altura no topo — o novo toolbar deve ocupar no máximo 52px de altura em telas desktop, liberando área vertical para a estante.
2. Interações no card — passar o mouse sobre a capa deve revelar apenas os botões primários [ Ler ] e [ SkillBook ], sem concorrência de 4 botões nem duplicações de badges.
3. Menu de contexto (botão direito) — deve abrir posicionado nas coordenadas do cursor `(e.clientX, e.clientY)` com ajuste de borda para não vazar da janela.
4. Fechamento do menu de contexto — deve fechar ao clicar fora, ao pressionar tecla `Escape` ou ao selecionar qualquer opção.
5. Responsividade mobile — em telas <= 768px, o toolbar deve manter rolagem horizontal suave (*touch scroll*) e manter todos os controles acessíveis.

---

### Task 1: Toolbar Unificado de Navegação & Filtros

**Files:**
- Modify: `app/index.html:190-255`
- Modify: `app/css/layout.css`
- Modify: `app/css/responsive.css`
- Modify: `app/js/shelf.js:330-355`
- Test: `test/test_fase3_toolbar.js`

**Interfaces:**
- Produces: Barra unificada `<nav class="unified-toolbar">` contendo grupo de abas de estantes à esquerda e controles de ordenação/visualização/caminho à direita em linha única.
- Consumes: IDs `tabTodos`, `tabFavoritos`, `tabLendo`, `tabConcluidos`, `tabQueroLer`, `btnAbrirMetricasTab`, `resultsCount`, `selectOrdenacao`, `viewModeGroup`, `currentPathInfo`.

- [ ] **Step 1: Criar teste automatizado do Toolbar Unificado**
  Criar `test/test_fase3_toolbar.js` validando que existe um único container `.unified-toolbar` substituindo as duas linhas separadas, contendo todos os controles e badges obrigatórios.

- [ ] **Step 2: Rodar o teste para confirmar falha inicial (RED)**
  Executar `node test/test_fase3_toolbar.js` (esperado: falha por ausência da classe `.unified-toolbar`).

- [ ] **Step 3: Atualizar HTML do toolbar em `app/index.html`**
  Unificar `control-row-top` e `control-row-bottom` em uma estrutura horizontal enxuta:
  ```html
  <nav class="unified-toolbar" id="unifiedToolbar">
    <div class="toolbar-left">
      <div class="shelf-pills-group">
        <!-- Botões de abas com badges compactas -->
      </div>
    </div>
    <div class="toolbar-right">
      <span class="results-badge" id="resultsCount">...</span>
      <div class="toolbar-divider"></div>
      <div class="sort-group">...</div>
      <div class="view-mode-group" id="viewModeGroup">...</div>
      <div class="current-path-info" id="currentPathInfo">...</div>
    </div>
  </nav>
  ```

- [ ] **Step 4: Estilizar Toolbar em `app/css/layout.css` e `responsive.css`**
  Estilos com `display: flex; align-items: center; justify-content: space-between; height: 50px; padding: 0 24px;` e scroll horizontal no mobile.

- [ ] **Step 5: Rodar testes do toolbar e test-dom no Electron**
  Executar `node test/test_fase3_toolbar.js` e `npx electron test-dom.js`.
  Garantir aprovação (GREEN).

- [ ] **Step 6: Commit**
  `git commit -m "feat(ui): unificar barras do topo em toolbar moderno e ergonomico"`

---

### Task 2: Despoluição e Refinamento Editorial dos Cards da Estante

**Files:**
- Modify: `app/js/shelf.js:460-550`
- Modify: `app/css/cards.css`
- Test: `test/test_fase3_cards.js`

**Interfaces:**
- Produces: Cards com arte de capa limpa, efeito de lombada de livro (*book spine*), badges não-concorrentes, autor exibido de forma elegante, e overlay de hover simplificado com 2 ações claras: `[ ▶ Ler ]` e `[ ✨ SkillBook ]`.

- [ ] **Step 1: Criar teste automatizado para a estrutura dos cards despoluídos**
  Criar `test/test_fase3_cards.js` testando que no card gerado:
  - Não existe mais o botão duplicado `.card-copilot-badge` sobre a capa.
  - O hover overlay possui exatamente 2 botões de ação: `.btn-cover-read` e `.btn-cover-copilot`.
  - Existe `.book-author` para identificação editorial rápida da autoria.

- [ ] **Step 2: Rodar teste e confirmar estado inicial (RED)**
  Executar `node test/test_fase3_cards.js` (esperado: falha reportando botões concorrentes).

- [ ] **Step 3: Atualizar template do card em `app/js/shelf.js`**
  No método `renderizarGrade`:
  - Remover `.card-copilot-badge` central da capa e os botões concorrentes `.btn-cover-skill` e `.btn-cover-info` do overlay.
  - Manter apenas `.btn-cover-read` (destaque primário) e `.btn-cover-copilot` (secundário âmbar).
  - Incluir elemento `<p class="book-author">${autorEscapado}</p>` abaixo do título.

- [ ] **Step 4: Refinar estilos em `app/css/cards.css`**
  Adicionar efeito de lombada (*book spine shadow*), proporção editorial perfeita 2:3, tipografia fina e elegante para o autor, e animação suave de hover.

- [ ] **Step 5: Rodar teste dos cards e capturar screenshots comparativas no Electron**
  Executar `node test/test_fase3_cards.js` e `npx electron test-features.js`.
  Confirmar que as capas e textos renderizam perfeitamente.

- [ ] **Step 6: Commit**
  `git commit -m "feat(cards): despoluir cards de livros com design editorial e hover limpo"`

---

### Task 3: Menu de Contexto Refinado no Botão Direito da Obra

**Files:**
- Modify: `app/index.html`
- Modify: `app/css/layout.css`
- Modify: `app/js/shelf.js`
- Modify: `app/renderer.js`
- Test: `test/test_fase3_context_menu.js`

**Interfaces:**
- Produces: Menu de contexto nativo/flutuante acionado por clique direito (`contextmenu`) sobre qualquer card da estante:
  - Ler no Leitor Interno
  - Conversar com o SkillBook
  - Gerar SKILL.md (Book-to-Skill)
  - Alternar Favorito
  - Mudar Status (Lendo, Concluído, Quero Ler)
  - Revelar no Explorador de Arquivos (Windows)
  - Remover da Estante

- [ ] **Step 1: Criar teste automatizado do Menu de Contexto**
  Criar `test/test_fase3_context_menu.js` verificando que o elemento `#bookContextMenu` existe no DOM com todos os itens de ação e classes apropriadas.

- [ ] **Step 2: Rodar teste e confirmar falha inicial (RED)**
  Executar `node test/test_fase3_context_menu.js` (esperado: falha por ausência do menu).

- [ ] **Step 3: Adicionar marcação do `#bookContextMenu` em `app/index.html`**
  Inserir menu contextual suspenso com ícones SVG modernos para cada ação.

- [ ] **Step 4: Implementar lógica de abertura, posicionamento e despacho em `app/js/shelf.js`**
  Adicionar listener para evento `contextmenu` no grid:
  - Capturar `caminho` do livro via `e.target.closest(".book-card")`.
  - Posicionar o menu em `(e.clientX, e.clientY)` garantindo que não ultrapasse a largura/altura da janela.
  - Conectar cada item do menu à respectiva ação (`abrirLeitorInterno`, `abrirCopilotoIA`, `criarSkillDiretoDoCard`, `alternarFavorito`, `atualizarStatusLeitura`, `revelarNoExplorer`, `removerLivroSelecionado`).
  - Fechar ao clicar fora ou teclar `Escape`.

- [ ] **Step 5: Estilizar o menu de contexto em `app/css/layout.css`**
  Design estilo macOS/Fluent com backdrop blur, bordas sutis e sombras profundas.

- [ ] **Step 6: Rodar testes e validação no Electron**
  Executar `node test/test_fase3_context_menu.js` e `npx electron test-dom.js`.
  Garantir 100% de aprovação.

- [ ] **Step 7: Commit**
  `git commit -m "feat(ux): implementar menu de contexto completo no botao direito dos livros"`

---

### Task 4: Suíte Integrada da Fase 3 e Validação Final

**Files:**
- Create: `test/run_all_fase3_tests.js`
- Modify: `package.json:17`

- [ ] **Step 1: Criar agregador `test/run_all_fase3_tests.js`**
  Executar todas as validações (sintaxe, CSS limpo, módulos, toolbar unificado, cards despoluídos, menu de contexto e testes no Electron).

- [ ] **Step 2: Atualizar comando `"test"` no `package.json`**
  Configurar para rodar a suíte integrada da Fase 3.

- [ ] **Step 3: Executar `npm test` e verificar aprovação completa**
  Garantir 100% dos testes passando sem falhas.

- [ ] **Step 4: Commit final da Fase 3**
  `git commit -m "chore: validar conclusao da Fase 3 de UX/UI e Design Editorial"`
