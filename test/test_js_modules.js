const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🧪 Iniciando teste de integridade dos submódulos JS...");

const jsDir = path.join(__dirname, "../app/js");
assert.ok(fs.existsSync(jsDir), "❌ Diretório app/js/ não existe");

const expectedModules = [
  "state.js",
  "utils.js",
  "shelf.js",
  "reader.js",
  "copilot.js",
  "modals.js"
];

// 1. Verificar existência e sintaxe de cada módulo
expectedModules.forEach(mod => {
  const modPath = path.join(jsDir, mod);
  assert.ok(fs.existsSync(modPath), `❌ Módulo app/js/${mod} não encontrado`);
  
  // Verifica sintaxe com node --check
  try {
    execSync(`node --check "${modPath}"`);
  } catch (err) {
    assert.fail(`❌ Erro de sintaxe no módulo app/js/${mod}: ${err.message}`);
  }
});

// 2. Verificar que index.html inclui todos os scripts
const indexHtml = fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8");
expectedModules.forEach(mod => {
  assert.ok(
    indexHtml.includes(`src="js/${mod}"`) || indexHtml.includes(`src="./js/${mod}"`),
    `❌ app/index.html deve carregar o script js/${mod}`
  );
});

// 3. Verificar que renderer.js foi reduzido para um orquestrador enxuto
const rendererCode = fs.readFileSync(path.join(__dirname, "../app/renderer.js"), "utf8");
const rendererLines = rendererCode.split("\n").length;
console.log(`📊 Linhas atuais em renderer.js: ${rendererLines}`);
assert.ok(rendererLines < 1000, `❌ renderer.js deve ser enxuto (< 1000 linhas), atualmente tem ${rendererLines}`);

console.log("✅ Teste de integridade dos submódulos JS aprovado!");
