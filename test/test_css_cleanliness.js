const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste de limpeza de CSS (!important count)...");

const cssPath = path.join(__dirname, "../app/style.css");
let totalCount = 0;
const filesToCheck = [cssPath];
const cssDir = path.join(__dirname, "../app/css");
if (fs.existsSync(cssDir)) {
  fs.readdirSync(cssDir).forEach(f => {
    if (f.endsWith(".css")) filesToCheck.push(path.join(cssDir, f));
  });
}

filesToCheck.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const matches = content.match(/!important/g) || [];
  totalCount += matches.length;
});

const count = totalCount;
console.log(`📊 Total de !important encontrados em todos os arquivos CSS: ${count}`);

const MAX_PERMITIDO = 20;
assert.ok(
  count <= MAX_PERMITIDO,
  `❌ Quantidade de !important (${count}) excede o limite aceitável de ${MAX_PERMITIDO}. O CSS precisa ser despoluído.`
);

console.log(`✅ Teste de CSS limpo aprovado! Contagem (${count}) dentro do limite aceitável (<= ${MAX_PERMITIDO}).`);
