const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste de Event Delegation...");

// 1. Verificar no código-fonte de app/renderer.js se renderizarLivros atribui data-caminho
const rendererCode = fs.readFileSync(path.join(__dirname, "../app/renderer.js"), "utf8");

const temDataCaminho = rendererCode.includes('data-caminho=');
assert.strictEqual(temDataCaminho, true, "❌ O card gerado em renderizarLivros deve conter data-caminho");

// 2. Verificar que NÃO há addEventListener repetido dentro do loop de renderização de cada card
const loopInicio = rendererCode.indexOf("lista.forEach(livro => {");
const loopFim = rendererCode.indexOf("grid.appendChild(card);", loopInicio);
assert.ok(loopInicio !== -1 && loopFim !== -1, "❌ Loop de renderização não encontrado");

const trechoLoop = rendererCode.slice(loopInicio, loopFim);
const listenersNoCard = (trechoLoop.match(/addEventListener/g) || []).length;
assert.strictEqual(listenersNoCard, 0, `❌ Não devem existir addEventListener por card no loop (encontrados: ${listenersNoCard})`);

// 3. Verificar que o listener delegado existe no grid
assert.ok(
  rendererCode.includes('grid.addEventListener("click"') || rendererCode.includes("grid.addEventListener('click'"),
  "❌ Deve existir listener delegado de 'click' no container grid"
);
assert.ok(
  rendererCode.includes('grid.addEventListener("dblclick"') || rendererCode.includes("grid.addEventListener('dblclick'"),
  "❌ Deve existir listener delegado de 'dblclick' no container grid"
);

console.log("✅ Teste de Event Delegation aprovado com sucesso!");
