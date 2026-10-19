const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste de limpeza de CSS (!important count)...");

const cssPath = path.join(__dirname, "../app/style.css");
const cssContent = fs.readFileSync(cssPath, "utf8");

// Conta ocorrências de !important
const matches = cssContent.match(/!important/g) || [];
const count = matches.length;

console.log(`📊 Total de !important encontrados em style.css: ${count}`);

const MAX_PERMITIDO = 20;
assert.ok(
  count <= MAX_PERMITIDO,
  `❌ Quantidade de !important (${count}) excede o limite aceitável de ${MAX_PERMITIDO}. O CSS precisa ser despoluído.`
);

console.log(`✅ Teste de CSS limpo aprovado! Contagem (${count}) dentro do limite aceitável (<= ${MAX_PERMITIDO}).`);
