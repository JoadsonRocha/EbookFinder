const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste do Toolbar Unificado (Fase 3 Task 1)...");

const htmlPath = path.join(__dirname, "../app/index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// 1. Verificar presença do container do Toolbar Unificado
assert.ok(
  html.includes('class="unified-toolbar"') || html.includes('id="unifiedToolbar"'),
  "❌ app/index.html deve conter o container com classe 'unified-toolbar' ou id 'unifiedToolbar'"
);

// 2. Verificar que as duas linhas empilhadas antigas não existem mais
assert.ok(
  !html.includes('class="control-row-top"'),
  "❌ A linha separada 'control-row-top' deve ser substituída pelo toolbar unificado"
);
assert.ok(
  !html.includes('class="control-row-bottom"'),
  "❌ A linha separada 'control-row-bottom' deve ser substituída pelo toolbar unificado"
);

// 3. Verificar que todos os IDs essenciais continuam presentes no Toolbar
const requiredIds = [
  "tabTodos",
  "tabFavoritos",
  "tabLendo",
  "tabConcluidos",
  "tabQueroLer",
  "btnAbrirMetricasTab",
  "resultsCount",
  "selectOrdenacao",
  "viewModeGroup",
  "currentPathInfo"
];

requiredIds.forEach(id => {
  assert.ok(
    html.includes(`id="${id}"`),
    `❌ ID obrigatório '${id}' não encontrado no Toolbar em app/index.html`
  );
});

// 4. Verificar estilos em layout.css
const layoutCss = fs.readFileSync(path.join(__dirname, "../app/css/layout.css"), "utf8");
assert.ok(
  layoutCss.includes(".unified-toolbar"),
  "❌ app/css/layout.css deve conter regras para .unified-toolbar"
);

console.log("✅ Teste do Toolbar Unificado aprovado com sucesso!");
