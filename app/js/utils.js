/**
 * EbookFinder — Módulo de Utilitários
 */
function obterPaletaCapa(str) {
  if (!str) return PALETAS_CAPA[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
  return PALETAS_CAPA[Math.abs(hash) % PALETAS_CAPA.length];
}

/**
 * Converte nomes mecânicos de arquivos (ex: hashes de concurso ou sequências de hífens)
 * em títulos elegantes, limpos e agradáveis de ler.
 */
function formatarTituloHumanizado(tituloOriginal, nomeArquivo) {
  let str = (tituloOriginal || nomeArquivo || "").replace(/\.(pdf|epub|mobi|cbr|cbz|txt|azw3?)$/i, "");

  // Remover marcas d'água e sufixos mecânicos frequentes
  str = str.replace(/[-_](somente[-_ ]*em[-_ ]*pdf|versao[-_ ]*impressao|sem[-_ ]*marca|completo|simplificado|resumo)\b/gi, "");
  str = str.replace(/[-_][a-f0-9]{4,8}\b/gi, "");

  // Concurso / Cursos com numeração de aula e professor
  // Ex: "curso-380456-aula-00-prof-a-paolla-ramos"
  const matchCurso = str.match(/curso[-_](\d+)[-_]aula[-_](\d+)(?:[-_]prof[-_]([a-zA-Z0-9\s-]+))?/i);
  if (matchCurso) {
    const numAula = matchCurso[2];
    let prof = matchCurso[3] ? matchCurso[3].replace(/[-_]/g, " ").trim() : "";
    prof = prof.replace(/\b(somente|em|pdf|completo)\b/gi, "").trim();
    if (prof) {
      prof = prof.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      return `Aula ${numAula} • Prof. ${prof}`;
    }
    return `Aula ${numAula}`;
  }

  // Padrão genérico de aula: "aula-01-...", "Aula 02 ..."
  const matchAula = str.match(/aula[-_ ]*(\d+)/i);
  if (matchAula) {
    const matchProf = str.match(/prof[-_ ]*([a-zA-Z\s-]+)/i);
    if (matchProf) {
      let profName = matchProf[1].replace(/[-_]/g, " ").replace(/\b(somente|em|pdf|completo)\b/gi, "").trim();
      if (profName) {
        profName = profName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return `Aula ${matchAula[1]} • Prof. ${profName}`;
      }
    }
    return `Aula ${matchAula[1]}`;
  }

  // Limpar sequências pontilhadas artificiais como .B..a..c..k..u..p
  if (/\.[a-zA-Z]\./.test(str)) {
    str = str.replace(/\.+/g, "");
  }

  // Limpar traços e underscores
  str = str.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!str) str = tituloOriginal || nomeArquivo || "Documento Sem Título";

  if (str === str.toLowerCase()) {
    str = str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  return str;
}

// ============================================================================
// FILA DE EXTRAÇÃO DE CAPAS DE PDF VIA CANVAS
// ============================================================================
let filaCapasPdf = [];
let processandoFilaCapas = false;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizarHtmlEpub(html) {
  if (!html) return "";
  let clean = String(html);
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^>]*\/?>/gi, "");
  clean = clean.replace(/<base\b[^>]*\/?>/gi, "");
  clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");
  clean = clean.replace(/\bhref\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'href="#"');
  clean = clean.replace(/\bsrc\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'src=""');
  return clean;
}

function normalizarModeloIA(m) {
  if (!m) return "llama-3.1-8b-instant";
  const str = String(m).toLowerCase();
  if (str.includes("120b") || str.includes("70b") || str.includes("pro")) return "llama-3.3-70b-versatile";
  if (str.includes("20b") || str.includes("8b") || str.includes("turbo")) return "llama-3.1-8b-instant";
  return m;
}

function showToast(msg, duracao = 3000) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, duracao);
}

function salvarFavoritos() {
  localStorage.setItem("ef_favoritos", JSON.stringify([...state.favoritos]));
  atualizarContadores();
}

function formatarTamanho(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function truncarCaminho(caminho, maxChars = 38) {
  if (!caminho) return "Nenhuma pasta selecionada";
  if (caminho.length <= maxChars) return caminho;
  return "..." + caminho.slice(caminho.length - maxChars);
}

function formatarDataLeitura(timestamp) {
  if (!timestamp) return "Nenhuma leitura registrada";
  try {
    const data = new Date(timestamp);
    return `Lido em ${data.toLocaleDateString("pt-BR")} às ${data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (e) {
    return "Nenhuma leitura registrada";
  }
}

function atualizarProgressoVisual(pag, tot) {
  const p = Math.max(0, parseInt(pag, 10) || 0);
  const t = Math.max(0, parseInt(tot, 10) || 0);
  const pct = t > 0 ? Math.min(100, Math.round((p / t) * 100)) : 0;

  const lblPct = document.getElementById("lblProgressoPercentual");
  const barFill = document.getElementById("progressBarFill");

  if (lblPct) lblPct.textContent = `${pct}%`;
  if (barFill) {
    barFill.style.width = `${pct}%`;
    barFill.classList.toggle("concluido", pct >= 100);
  }

  return { paginaAtual: p, totalPaginas: t, porcentagem: pct };
}

function formatarMarkdownSimples(md) {
  if (!md) return "";

  // 1. Escapar HTML base para segurança
  let text = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Blocos de Código (``` ... ```)
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `\n<pre><code>${code.trim()}</code></pre>\n`;
  });

  // 3. Tabelas Markdown (| th | th |\n|---|---|\n| td | td |)
  text = text.replace(/(?:^|\n)((?:\|[^\n]+\|\r?\n?)+)/g, (match, tableBlock) => {
    const lines = tableBlock.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;
    if (!lines[1].includes("-")) return match;

    const parseRow = (line) => {
      return line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cell => cell.trim());
    };

    const headers = parseRow(lines[0]);
    const headerHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;

    const bodyRows = lines.slice(2).map(rowLine => {
      const cells = parseRow(rowLine);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join("")}</tr>`;
    }).join("");

    return `\n<div class="table-container"><table>${headerHtml}<tbody>${bodyRows}</tbody></table></div>\n`;
  });

  // 4. Blockquotes / Citações (> texto)
  text = text.replace(/(?:^|\n)&gt;\s*([^\n]+(?:\n&gt;\s*[^\n]+)*)/g, (match, quoteContent) => {
    const cleaned = quoteContent.replace(/\n&gt;\s*/g, " ");
    return `\n<blockquote>${cleaned}</blockquote>\n`;
  });

  // 5. Cabeçalhos (#, ##, ###)
  text = text.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^## (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^# (.*$)/gim, "<h3>$1</h3>");

  // 6. Linhas Horizontais (--- ou ***)
  text = text.replace(/^(?:---|\*\*\*|___)$/gim, "<hr/>");

  // 7. Listas não ordenadas (- ou * ou •)
  text = text.replace(/(?:^|\n)((?:[\t ]*[-*•]\s+[^\n]+\r?\n?)+)/g, (match, listBlock) => {
    const items = listBlock.trim().split(/\r?\n/).map(it => {
      return `<li>${it.replace(/^[\t ]*[-*•]\s+/, "")}</li>`;
    }).join("");
    return `\n<ul>${items}</ul>\n`;
  });

  // 8. Listas numeradas (1. 2. 3.)
  text = text.replace(/(?:^|\n)((?:[\t ]*\d+\.\s+[^\n]+\r?\n?)+)/g, (match, listBlock) => {
    const items = listBlock.trim().split(/\r?\n/).map(it => {
      return `<li>${it.replace(/^[\t ]*\d+\.\s+/, "")}</li>`;
    }).join("");
    return `\n<ol>${items}</ol>\n`;
  });

  // 9. Estilos inline (negrito, itálico, código)
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 10. Parágrafos e quebras
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (/^<(div|table|thead|tbody|tr|th|td|ul|ol|li|h3|blockquote|pre|hr)/i.test(trimmed)) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
  });

  return formattedBlocks.filter(Boolean).join("");
}

// ============================================================================
// 5.3 WORKSPACE DEDICADO DO COPILOTO IA (ESTILO CHATGPT / CLAUDE)
// ============================================================================

function obterHistoricoChatStorage(caminho) {
  try {
    if (!caminho) return [];
    const raw = localStorage.getItem("ef_chat_" + caminho);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Alias para compatibilidade
const carregarHistoricoChatStorage = obterHistoricoChatStorage;

function salvarHistoricoChatStorage(caminho, historico) {
  try {
    if (!caminho) return;
    const fatiado = (historico || []).slice(-40);
    localStorage.setItem("ef_chat_" + caminho, JSON.stringify(fatiado));
  } catch (e) {
    console.warn("Erro ao salvar histórico do chat:", e);
  }
}

function limparHistoricoChatStorage(caminho) {
  try {
    if (!caminho) return;
    localStorage.removeItem("ef_chat_" + caminho);
  } catch (e) {}
}


window.escapeHtml = escapeHtml;
window.sanitizarHtmlEpub = sanitizarHtmlEpub;
window.showToast = showToast;
window.formatarTamanho = formatarTamanho;
window.truncarCaminho = truncarCaminho;
window.formatarDataLeitura = formatarDataLeitura;
window.formatarMarkdownSimples = formatarMarkdownSimples;
window.normalizarModeloIA = normalizarModeloIA;