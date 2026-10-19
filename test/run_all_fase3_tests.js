const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("============================================================");
console.log("🚀 INICIANDO SUÍTE INTEGRADA DE TESTES DA FASE 3 (UX/UI & DESIGN)");
console.log("============================================================");

function runStep(name, cmd) {
  process.stdout.write(`⏳ Executando: ${name}... `);
  try {
    const output = execSync(cmd, { stdio: "pipe", encoding: "utf8" });
    console.log("✅ OK");
    return output;
  } catch (err) {
    console.log("❌ FALHA");
    console.error(`Erro ao executar "${cmd}":`);
    console.error(err.stdout || err.stderr || err.message);
    process.exit(1);
  }
}

// 1. Verificação de Sintaxe de todos os arquivos JavaScript
const jsFiles = [
  "main.js",
  "preload.js",
  "serve-mobile.js",
  "app/mobile-bridge.js",
  "app/renderer.js",
  "app/js/state.js",
  "app/js/utils.js",
  "app/js/shelf.js",
  "app/js/reader.js",
  "app/js/copilot.js",
  "app/js/modals.js"
];

jsFiles.forEach(file => {
  runStep(`Sintaxe: ${file}`, `node --check "${file}"`);
});

// 2. Teste de Limpeza de CSS (!important)
runStep("Limpeza e tokens CSS (!important <= 20)", "node test/test_css_cleanliness.js");

// 3. Teste de Integridade Modular do CSS
runStep("Integridade modular do CSS (app/css/*)", "node test/test_css_modules.js");

// 4. Teste de Event Delegation no Grid
runStep("Event Delegation no #grid", "node test/test_event_delegation.js");

// 5. Teste de Integridade dos Submódulos JS
runStep("Integridade dos submódulos JS (app/js/*)", "node test/test_js_modules.js");

// 6. Testes da Fase 3
runStep("Fase 3 - Toolbar Unificado (Task 1)", "node test/test_fase3_toolbar.js");
runStep("Fase 3 - Cards Despoluídos (Task 2)", "node test/test_fase3_cards.js");
runStep("Fase 3 - Menu de Contexto (Task 3)", "node test/test_fase3_context_menu.js");

// 7. Teste de Renderização do DOM no Electron
runStep("Renderização da Estante no Electron", "npx electron test-dom.js");

console.log("============================================================");
console.log("🎉 TODOS OS TESTES DA FASE 3 PASSARAM COM 100% DE SUCESSO!");
console.log("============================================================");
