const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste do Menu de Contexto (Fase 3 Task 3)...");

const htmlPath = path.join(__dirname, "../app/index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// 1. Verificar existência do elemento #bookContextMenu
assert.ok(
  html.includes('id="bookContextMenu"'),
  "❌ app/index.html deve conter o elemento com id='bookContextMenu'"
);

// 2. Verificar ações requeridas no menu
const acoesRequeridas = [
  'data-action="ler"',
  'data-action="skillbook"',
  'data-action="book-to-skill"',
  'data-action="favorito"',
  'data-status="lendo"',
  'data-status="concluidos"',
  'data-status="quero-ler"',
  'data-action="explorer"',
  'data-action="remover"'
];

acoesRequeridas.forEach(acao => {
  assert.ok(
    html.includes(acao),
    `❌ O menu de contexto deve conter a ação '${acao}'`
  );
});

// 3. Verificar estilos no layout.css
const layoutCss = fs.readFileSync(path.join(__dirname, "../app/css/layout.css"), "utf8");
assert.ok(
  layoutCss.includes(".context-menu"),
  "❌ app/css/layout.css deve conter estilos para .context-menu"
);
assert.ok(
  layoutCss.includes(".context-menu-item"),
  "❌ app/css/layout.css deve conter estilos para .context-menu-item"
);

// 4. Verificar lógica do contextmenu em shelf.js ou renderer.js
const shelfJs = fs.readFileSync(path.join(__dirname, "../app/js/shelf.js"), "utf8");
const rendererJs = fs.readFileSync(path.join(__dirname, "../app/renderer.js"), "utf8");
const combinedJs = shelfJs + "\n" + rendererJs;

assert.ok(
  combinedJs.includes("contextmenu"),
  "❌ Deve haver um listener de 'contextmenu' para abrir o menu do card"
);
assert.ok(
  combinedJs.includes("bookContextMenu"),
  "❌ O script deve referenciar 'bookContextMenu' para exibição e controle"
);

console.log("✅ Teste do Menu de Contexto aprovado com sucesso!");
