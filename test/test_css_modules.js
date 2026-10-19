const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste de integridade modular do CSS...");

const cssDir = path.join(__dirname, "../app/css");
assert.ok(fs.existsSync(cssDir), "❌ Diretório app/css/ não existe");

const expectedModules = [
  "tokens.css",
  "layout.css",
  "cards.css",
  "reader.css",
  "copilot.css",
  "responsive.css"
];

expectedModules.forEach(mod => {
  const modPath = path.join(cssDir, mod);
  assert.ok(fs.existsSync(modPath), `❌ Módulo CSS ${mod} não encontrado em app/css/`);
  const content = fs.readFileSync(modPath, "utf8");
  assert.ok(content.length > 50, `❌ Módulo CSS ${mod} está vazio ou muito curto`);
});

// Verificar que app/style.css agrega via @import
const styleCss = fs.readFileSync(path.join(__dirname, "../app/style.css"), "utf8");
expectedModules.forEach(mod => {
  assert.ok(
    styleCss.includes(`@import "css/${mod}"`) || styleCss.includes(`@import url("css/${mod}")`) || styleCss.includes(`@import url('css/${mod}')`),
    `❌ app/style.css deve importar css/${mod}`
  );
});

// Verificar seletores-chave em módulos específicos
const tokensCss = fs.readFileSync(path.join(cssDir, "tokens.css"), "utf8");
assert.ok(tokensCss.includes(":root"), "❌ tokens.css deve conter variáveis :root");
assert.ok(tokensCss.includes('body[data-theme="light"]'), "❌ tokens.css deve conter tema light");

const layoutCss = fs.readFileSync(path.join(cssDir, "layout.css"), "utf8");
assert.ok(layoutCss.includes("header#appHeader"), "❌ layout.css deve conter cabeçalho");

const cardsCss = fs.readFileSync(path.join(cssDir, "cards.css"), "utf8");
assert.ok(cardsCss.includes(".book-card"), "❌ cards.css deve conter .book-card");

const readerCss = fs.readFileSync(path.join(cssDir, "reader.css"), "utf8");
assert.ok(readerCss.includes("reader"), "❌ reader.css deve conter estilos do leitor");

const copilotCss = fs.readFileSync(path.join(cssDir, "copilot.css"), "utf8");
assert.ok(copilotCss.includes("copilot") || copilotCss.includes("copiloto"), "❌ copilot.css deve conter estilos do copiloto");

const responsiveCss = fs.readFileSync(path.join(cssDir, "responsive.css"), "utf8");
assert.ok(responsiveCss.includes("@media (max-width: 768px)"), "❌ responsive.css deve conter media query mobile");

console.log("✅ Teste de integridade modular do CSS aprovado com sucesso!");
