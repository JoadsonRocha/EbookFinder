# Fase 1: Segurança, Estabilização e Consistência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar vulnerabilidades de segurança (XSS e chaves embutidas), corrigir inconsistências críticas de configuração (appId, versões, métodos duplicados) e padronizar os modelos de IA da Groq no EbookFinder.

**Architecture:** Implementar camada de sanitização e escape HTML sem dependências externas pesadas (`escapeHtml` e sanitizador de tags/atributos HTML para EPUB), remover duplicações de API em `mobile-bridge.js`, harmonizar configurações de build entre Electron e Capacitor, e padronizar identificadores oficiais de modelos da Groq.

**Tech Stack:** JavaScript (ES6+ / Node.js / Electron IPC / Capacitor Bridge), HTML5, JSON.

**Spec:** [diagnostico_superpowers.md](file:///C:/Users/joads/.gemini/antigravity-ide/brain/bd14e243-4d1e-4a8b-8117-4a6bf310f0ea/diagnostico_superpowers.md)

## Global Constraints

- Manter 100% de compatibilidade tanto no ambiente Electron (Windows) quanto no Capacitor / Web (Android).
- Nenhuma quebra de APIs públicas de `window.api` (28 métodos devem continuar funcionando com a mesma assinatura esperada pelo frontend).
- Não adicionar bibliotecas pesadas de terceiros; utilizar soluções nativas e seguras.

## Review Focus

1. Carregamento de EPUB com HTML contendo atributos `onerror`, `onload` ou links `javascript:` — deve ser estritamente desinfetado antes de renderizar no DOM.
2. Livro com título ou autor contendo aspas, `<` ou `>` — não pode corromper o HTML do card nem injetar elementos.
3. Chamada a `exportarArquivoTexto` no mobile — deve funcionar tanto com suporte a Web Share API quanto com download via Blob sem erros de parâmetros ausentes.
4. Consulta ao SkillBook com modelos Groq — deve direcionar para modelos oficiais ativos (`llama-3.3-70b-versatile` e `llama-3.1-8b-instant`).
5. Build de produção do Electron — não deve quebrar nem depender de chaves hardcoded.

---

### Task 1: Unificação de Identificadores (`appId`) e Versões

**Files:**
- Modify: `package.json:19,27`
- Modify: `capacitor.config.json:2`
- Modify: `app/index.html:27,340`

**Interfaces:**
- Produces: `appId` padronizado como `com.joadsonrocha.ebookfinder` em todas as plataformas; versão padronizada como `1.1.0`.

- [ ] **Step 1: Atualizar `package.json`**
  Alterar `"appId": "com.ebookfinder.app"` para `"appId": "com.joadsonrocha.ebookfinder"` e `"version": "1.1.0"`.

- [ ] **Step 2: Verificar `capacitor.config.json`**
  Confirmar que `"appId": "com.joadsonrocha.ebookfinder"`.

- [ ] **Step 3: Harmonizar versão no `app/index.html`**
  Garantir que a badge no header ([L27](file:///d:/FULLSTARK/EbookFinder/app/index.html#L27)) e o modal Sobre ([L340](file:///d:/FULLSTARK/EbookFinder/app/index.html#L340)) exibam `v1.1.0`.

- [ ] **Step 4: Validar JSONs**
  Executar `node -e "JSON.parse(require('fs').readFileSync('package.json')); JSON.parse(require('fs').readFileSync('capacitor.config.json')); console.log('JSONs OK')"`

- [ ] **Step 5: Commit**
  `git commit -m "fix(config): unificar appId e versao 1.1.0 no package e capacitor"`

---

### Task 2: Eliminar Método Duplicado em `mobile-bridge.js`

**Files:**
- Modify: `app/mobile-bridge.js:596-621, 869-910`
- Test: `scratch/test_bridge_parity.js`

**Interfaces:**
- Produces: Uma única definição completa de `exportarArquivoTexto({ nomeSugerido, conteudo, extensao })` em `mobile-bridge.js`.

- [ ] **Step 1: Escrever teste de duplicidade de chaves no `mobile-bridge.js`**
  Criar script que analisa as propriedades atribuídas a `window.api` e falha se houver chaves duplicadas.

- [ ] **Step 2: Rodar teste e confirmar que detecta a duplicação**
  Executar teste e confirmar que `exportarArquivoTexto` aparece 2 vezes.

- [ ] **Step 3: Unificar a função `exportarArquivoTexto` em `app/mobile-bridge.js`**
  Remover a versão incompleta (linhas 596-621) e manter a versão robusta com suporte a `navigator.share` (arquivos e texto) e fallback para `Blob` download (linhas 869-910).

- [ ] **Step 4: Rodar teste e confirmar aprovação**
  Executar teste e verificar que não há mais nenhuma propriedade duplicada em `window.api`.

- [ ] **Step 5: Commit**
  `git commit -m "fix(bridge): remover declaracao duplicada de exportarArquivoTexto"`

---

### Task 3: Sanitização XSS & Escape HTML em `renderer.js` e Processamento de EPUB

**Files:**
- Modify: `app/renderer.js`
- Modify: `main.js:1120-1140`
- Modify: `app/mobile-bridge.js:150-175`
- Test: `scratch/test_sanitization.js`

**Interfaces:**
- Produces:
  - `function escapeHtml(str)` em `renderer.js`
  - `function sanitizarHtmlEpub(html)` em `renderer.js`, `main.js` e `mobile-bridge.js`

- [ ] **Step 1: Criar teste de sanitização com payloads XSS**
  Criar `scratch/test_sanitization.js` testando strings como `<img src=x onerror=alert(1)>`, `<a href="javascript:alert(1)">`, e títulos com `<` e `"`.

- [ ] **Step 2: Implementar `escapeHtml` no topo dos utilitários de `renderer.js`**
  ```javascript
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  ```

- [ ] **Step 3: Aplicar `escapeHtml` na renderização dos cards e modais**
  Em [renderer.js L664-747](file:///d:/FULLSTARK/EbookFinder/app/renderer.js#L664-L747), sanitizar `tituloExibicao`, `livro.autor`, `livro.nome`, `livro.titulo` antes de interpolar em `.innerHTML`.

- [ ] **Step 4: Implementar sanitizador seguro de EPUB**
  Substituir a regex fraca de script por uma sanitização que remove tags perigosas (`script`, `iframe`, `object`, `embed`, `base`) e atributos que iniciam com `on` (ex: `onerror`, `onload`, `onclick`) bem como URLs `javascript:` nos atributos `src` e `href`.

- [ ] **Step 5: Rodar testes de sanitização e verificar aprovação**
  Executar `node scratch/test_sanitization.js`.

- [ ] **Step 6: Commit**
  `git commit -m "security: sanitizar HTML de EPUB e escapar metadados contra XSS"`

---

### Task 4: Padronização dos Modelos Oficiais da Groq

**Files:**
- Modify: `main.js:60-66, 896, 953`
- Modify: `app/mobile-bridge.js:712, 741`
- Modify: `app/index.html:306-310`
- Modify: `app/renderer.js:2310-2340`

**Interfaces:**
- Produces: Modelos padronizados para identificadores oficiais da Groq:
  - `llama-3.3-70b-versatile` (SkillBook Pro / Raciocínio Completo)
  - `llama-3.1-8b-instant` (SkillBook Turbo / Ultra Rápido)
  - Fallback compatível para configurações antigas do usuário.

- [ ] **Step 1: Escrever teste de normalização de modelos**
  Validar que `normalizarModeloIA` mapeia valores antigos (`openai/gpt-oss-20b`, `20b`) para `llama-3.1-8b-instant` e (`120b`, `70b`, `pro`) para `llama-3.3-70b-versatile`.

- [ ] **Step 2: Atualizar opções no `app/index.html`**
  No `<select id="selectModeloIA">`:
  - `value="llama-3.1-8b-instant"`: "SkillBook Turbo (Llama 3.1 8B — Ultra Rápido)"
  - `value="llama-3.3-70b-versatile"`: "SkillBook Pro (Llama 3.3 70B — Raciocínio Avançado)"

- [ ] **Step 3: Atualizar lógica em `main.js`, `renderer.js` e `mobile-bridge.js`**
  Garantir mapeamento retrocompatível para que usuários existentes não tenham que reconfigurar do zero.

- [ ] **Step 4: Rodar teste e validar comportamento**
  Executar `node scratch/test_models.js`.

- [ ] **Step 5: Commit**
  `git commit -m "feat(ai): padronizar modelos oficiais da Groq Llama 3.3 e 3.1"`

---

### Task 5: Isolamento & Segurança de Chaves no Pacote

**Files:**
- Modify: `package.json:28-32`
- Modify: `main.js:53-59`
- Create: `ia_config.example.json`

**Interfaces:**
- Produces: Remoção de chaves ativas do rastreamento de build e criação de template de configuração claro.

- [ ] **Step 1: Criar `ia_config.example.json`**
  Modelo limpo para referência com chave de exemplo vazia.

- [ ] **Step 2: Remover arquivos com chaves ativas da lista `"files"` do `package.json`**
  Remover `"ia_config_bundle.json"` da lista de arquivos distribuídos no instalador público.

- [ ] **Step 3: Ajustar `main.js` para priorizar chave do usuário em `%APPDATA%`**
  Se não houver chave salva, orientar o usuário a configurar no modal em vez de quebrar.

- [ ] **Step 4: Validar sintaxe e integridade**
  Executar verificação de sintaxe de todos os arquivos.

- [ ] **Step 5: Commit**
  `git commit -m "security: isolar chaves de API e remover bundle sensivel do build"`

---

### Task 6: Verificação Completa e Testes Finais

**Files:**
- Test: `scratch/run_all_verifications.js`

- [ ] **Step 1: Rodar suíte completa de verificações**
  - Sintaxe de todos os arquivos JS.
  - Testes de escape HTML e XSS.
  - Paridade de métodos entre `preload.js` e `mobile-bridge.js`.
  - Ausência de métodos duplicados.

- [ ] **Step 2: Validar visualmente e estruturalmente o app**
  Executar teste com Electron para assegurar que a janela abre perfeitamente sem erros no console.

- [ ] **Step 3: Commit final da Fase 1**
  `git commit -m "chore: validar conclusao da Fase 1 de estabilizacao e seguranca"`
