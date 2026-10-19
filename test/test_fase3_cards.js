const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("🧪 Iniciando teste dos Cards Despoluídos (Fase 3 Task 2)...");

const shelfPath = path.join(__dirname, "../app/js/shelf.js");
const shelfCode = fs.readFileSync(shelfPath, "utf8");

// 1. Verificar que não há botão duplicado 'card-copilot-badge' central sobre a capa
assert.ok(
  !shelfCode.includes('class="card-copilot-badge"'),
  "❌ O botão duplicado 'card-copilot-badge' sobre a capa deve ser removido para despoluir a arte do livro"
);

// 2. Verificar que os botões concorrentes do overlay foram removidos
assert.ok(
  !shelfCode.includes('class="btn-cover-skill"'),
  "❌ O botão concorrente 'btn-cover-skill' deve ser removido do hover (disponível no menu de contexto)"
);
assert.ok(
  !shelfCode.includes('class="btn-cover-info"'),
  "❌ O botão concorrente 'btn-cover-info' deve ser removido do hover (o clique no card já abre os detalhes)"
);

// 3. Verificar que as 2 ações principais e claras existem no hover
assert.ok(
  shelfCode.includes('class="btn-cover-read"'),
  "❌ O botão primário de leitura [ Ler ] deve existir no overlay de hover"
);
assert.ok(
  shelfCode.includes('class="btn-cover-copilot"'),
  "❌ O botão secundário [ SkillBook ] deve existir no overlay de hover"
);

// 4. Verificar que a autoria do livro é exibida
assert.ok(
  shelfCode.includes('class="book-author"') || shelfCode.includes('class="card-author"'),
  "❌ O card deve conter elemento com classe 'book-author' para identificação da autoria"
);

// 5. Verificar estilos de book-author em cards.css
const cardsCss = fs.readFileSync(path.join(__dirname, "../app/css/cards.css"), "utf8");
assert.ok(
  cardsCss.includes(".book-author") || cardsCss.includes(".card-author"),
  "❌ app/css/cards.css deve conter estilos para .book-author"
);

console.log("✅ Teste dos Cards Despoluídos aprovado com sucesso!");
