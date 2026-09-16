/**
 * ============================================================================
 * EbookFinder - Processo de Renderização (Frontend / DOM)
 * ============================================================================
 * @description Gerencia a estante virtual, exibição de capas de livros em 2:3,
 *              estantes de leitura (Lendo, Concluídos, Quero Ler), busca por
 *              título e autor, modal de leitura e favoritos.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

// Inicializa o Worker do PDF.js para extração rápida de capas da página 1
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}

// ============================================================================
// 1. ESTADO GLOBAL DA APLICAÇÃO
// ============================================================================
const state = {
  pastaAtual: null,
  todosLivros: [],
  livrosFiltrados: [],
  abaAtiva: "todos", // "todos" | "favoritos" | "lendo" | "concluidos" | "quero-ler"
  termoBusca: "",
  ordenacaoAtual: "titulo-asc",
  modoVisualizacao: localStorage.getItem("ef_modo_visualizacao") || "normal", // "normal" | "compact" | "list"
  buscaRecursiva: localStorage.getItem("ef_recursivo") !== "false",
  favoritos: new Set(JSON.parse(localStorage.getItem("ef_favoritos") || "[]")),
  livroSelecionado: null,
  tema: localStorage.getItem("ef_theme") || "dark",
  tabModalAtiva: "detalhes",
  skillAtual: null,
  chatHistorico: []
};

// ============================================================================
// TEMAS DE CAPA DURA & FORMATAÇÃO HUMANIZADA
// ============================================================================
const PALETAS_CAPA = [
  { tema: "sapphire", bg: "linear-gradient(145deg, #132238, #0b1524)", borda: "#38bdf8", tag: "#0284c7" },
  { tema: "emerald",  bg: "linear-gradient(145deg, #063c2e, #02241b)", borda: "#34d399", tag: "#059669" },
  { tema: "burgundy", bg: "linear-gradient(145deg, #3d0718, #22020b)", borda: "#fb7185", tag: "#e11d48" },
  { tema: "obsidian", bg: "linear-gradient(145deg, #1c1926, #0e0d16)", borda: "#e5a93b", tag: "#d97706" },
  { tema: "amethyst", bg: "linear-gradient(145deg, #2d0b4e, #18042b)", borda: "#c084fc", tag: "#9333ea" },
  { tema: "indigo",   bg: "linear-gradient(145deg, #181842, #0d0c24)", borda: "#818cf8", tag: "#4f46e5" }
];

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

function enfileirarExtracaoCapasPdf(livros) {
  if (!Array.isArray(livros)) return;
  const pendentes = livros.filter(l => l.extensao === ".pdf" && !l.thumbnail);
  if (pendentes.length === 0) return;

  pendentes.forEach(l => {
    if (!filaCapasPdf.some(item => item.caminho === l.caminho)) {
      filaCapasPdf.push(l);
    }
  });

  processarFilaCapas();
}

async function processarFilaCapas() {
  if (processandoFilaCapas || filaCapasPdf.length === 0) return;
  processandoFilaCapas = true;

  while (filaCapasPdf.length > 0) {
    const livro = filaCapasPdf.shift();
    if (livro.thumbnail) continue;

    try {
      const capaUrl = await extrairCapaPdf(livro);
      if (capaUrl) {
        livro.thumbnail = capaUrl;
        atualizarCapaNoDom(livro.caminho, capaUrl, livro.tituloHumanizado || livro.titulo);
      }
    } catch (err) {
      console.warn("Erro ao processar capa:", livro.caminho, err);
    }

    // Intervalo de 50ms para manter a interface fluida a 60fps
    await new Promise(r => setTimeout(r, 50));
  }

  processandoFilaCapas = false;
}

/**
 * Lê o buffer do PDF via IPC, renderiza a Página 1 no Canvas HTML5 com resolução de alta qualidade
 * e salva o resultado no cache local em disco (thumbs/).
 */
async function extrairCapaPdf(livro) {
  if (!window.pdfjsLib) return null;
  const buffer = await window.api?.lerArquivoBuffer?.(livro.caminho);
  if (!buffer || buffer.length === 0) return null;

  try {
    const uint8 = new Uint8Array(buffer);
    const loadingTask = window.pdfjsLib.getDocument({
      data: uint8,
      disableFontFace: false
    });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const unscaled = page.getViewport({ scale: 1.0 });
    const scale = Math.min(2.0, Math.max(0.6, 360 / (unscaled.width || 360)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });

    // Fundo branco caso o PDF possua fundo transparente
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const caminhoCache = await window.api?.salvarCapaCache?.(livro.caminho, dataUrl);
    return caminhoCache || dataUrl;
  } catch (err) {
    console.error("Falha ao renderizar capa do PDF:", livro.caminho, err);
    return null;
  }
}

/**
 * Atualiza o elemento no DOM em tempo real com fade-in suave assim que a capa é extraída.
 */
function atualizarCapaNoDom(caminho, thumbUrl, titulo) {
  const card = document.querySelector(`.book-card[data-caminho="${CSS.escape(caminho)}"]`);
  if (card) {
    const wrapper = card.querySelector(".book-cover-wrapper");
    if (wrapper) {
      const fallback = wrapper.querySelector(".book-cover-fallback");
      if (fallback) fallback.remove();

      let img = wrapper.querySelector(".book-cover-image");
      if (!img) {
        img = document.createElement("img");
        img.className = "book-cover-image cover-fade-in";
        img.alt = titulo;
        img.loading = "lazy";
        wrapper.prepend(img);
      }
      img.src = thumbUrl;
    }
  }

  if (state.livroSelecionado && state.livroSelecionado.caminho === caminho) {
    const modalCapa = document.getElementById("modalCapaContainer");
    if (modalCapa) {
      modalCapa.innerHTML = `<img src="${thumbUrl}" alt="${titulo}" class="cover-fade-in">`;
    }
  }
}

/**
 * Alterna entre modos de visualização: normal, compacto ou lista.
 */
function aplicarModoVisualizacao(modo) {
  state.modoVisualizacao = modo || "normal";
  localStorage.setItem("ef_modo_visualizacao", state.modoVisualizacao);

  const grid = document.getElementById("grid");
  if (grid) {
    grid.classList.remove("compact", "list-view");
    if (state.modoVisualizacao === "compact") grid.classList.add("compact");
    if (state.modoVisualizacao === "list") grid.classList.add("list-view");
  }

  document.querySelectorAll(".btn-view-mode").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === state.modoVisualizacao);
  });
}

// ============================================================================
// 2. UTILITÁRIOS
// ============================================================================

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

async function salvarProgressoModal(marcarConcluido = false) {
  if (!state.livroSelecionado) return;

  const inputPagina = document.getElementById("inputPaginaAtual");
  const inputTotal = document.getElementById("inputTotalPaginas");
  const inputNotas = document.getElementById("inputAnotacoes");
  const lblUltima = document.getElementById("lblUltimaLeitura");

  let pag = Math.max(0, parseInt(inputPagina?.value, 10) || 0);
  let tot = Math.max(0, parseInt(inputTotal?.value, 10) || 0);
  const notas = inputNotas?.value || "";

  if (marcarConcluido && tot > 0) {
    pag = tot;
    if (inputPagina) inputPagina.value = pag;
  }

  const { porcentagem } = atualizarProgressoVisual(pag, tot);

  const dadosProgresso = {
    paginaAtual: pag,
    totalPaginas: tot,
    porcentagem,
    anotacoes: notas
  };

  const resultado = await window.api?.salvarProgressoLeitura?.(state.livroSelecionado.caminho, dadosProgresso);

  if (resultado) {
    state.livroSelecionado.progresso = resultado;
    if (resultado.status) {
      state.livroSelecionado.status = resultado.status;
      document.querySelectorAll(".btn-status").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.status === resultado.status);
      });
    }

    if (lblUltima && resultado.ultimaLeituraEm) {
      lblUltima.textContent = formatarDataLeitura(resultado.ultimaLeituraEm);
    }

    // Atualiza também na lista global
    const idx = state.todosLivros.findIndex(l => l.caminho === state.livroSelecionado.caminho);
    if (idx !== -1) {
      state.todosLivros[idx].progresso = resultado;
      if (resultado.status) state.todosLivros[idx].status = resultado.status;
    }

    aplicarFiltrosEOrdenacao();
    showToast(marcarConcluido ? "Parabéns! Obra concluída." : `Progresso salvo: Pág. ${pag}${tot ? `/${tot}` : ''} (${porcentagem}%)`);
  } else {
    showToast("Erro ao salvar progresso.");
  }
}

// ============================================================================
// 3. CARREGAMENTO DA BIBLIOTECA
// ============================================================================

async function carregarBiblioteca() {
  const grid = document.getElementById("grid");
  const resultsCount = document.getElementById("resultsCount");

  if (resultsCount) resultsCount.textContent = "Carregando estante de livros...";
  if (grid) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <h3 class="empty-title">Lendo arquivos da estante...</h3>
        <p class="empty-desc">Processando livros e extraindo capas automaticamente.</p>
      </div>
    `;
  }

  try {
    const status = await window.api?.obterStatusSistema?.();
    state.pastaAtual = status?.pastaAtual || null;

    atualizarIndicadorPasta();

    if (!state.pastaAtual) {
      renderizarEstadoSemPasta();
      return;
    }

    const livros = await window.api?.buscarEbooks?.("", state.buscaRecursiva);
    state.todosLivros = (Array.isArray(livros) ? livros : []).map(l => ({
      ...l,
      tituloHumanizado: formatarTituloHumanizado(l.titulo, l.nome)
    }));

    aplicarFiltrosEOrdenacao();
    enfileirarExtracaoCapasPdf(state.todosLivros);
  } catch (err) {
    console.error("❌ Erro ao carregar biblioteca:", err);
    showToast("Erro ao ler livros da pasta.");
  }
}

function atualizarIndicadorPasta() {
  const lblPasta = document.getElementById("lblPastaAtual");
  const boxPasta = document.getElementById("currentPathInfo");
  if (lblPasta) {
    lblPasta.textContent = state.pastaAtual ? truncarCaminho(state.pastaAtual) : "Nenhuma pasta selecionada";
  }
  if (boxPasta && state.pastaAtual) {
    boxPasta.title = `Pasta de e-books: ${state.pastaAtual} (Clique para alterar)`;
  }
  atualizarIndicadorSubpastas();
}

function atualizarIndicadorSubpastas() {
  const lblMenu = document.getElementById("lblRecursivo");
  if (lblMenu) lblMenu.textContent = state.buscaRecursiva ? "Ativado" : "Desativado";

  const btnBar = document.getElementById("btnToggleSubpastas");
  const lblBar = document.getElementById("lblSubpastasBar");
  if (btnBar) {
    btnBar.classList.toggle("active", state.buscaRecursiva);
  }
  if (lblBar) {
    lblBar.textContent = `Subpastas: ${state.buscaRecursiva ? "Ativado" : "Desativado"}`;
  }
}

function alternarSubpastas() {
  state.buscaRecursiva = !state.buscaRecursiva;
  localStorage.setItem("ef_recursivo", state.buscaRecursiva);
  atualizarIndicadorSubpastas();
  showToast(state.buscaRecursiva ? "Busca em subpastas ATIVADA." : "Busca em subpastas DESATIVADA.");
  carregarBiblioteca();
}

// ============================================================================
// 4. FILTROS, ORDENAÇÃO E RENDERIZAÇÃO
// ============================================================================

function aplicarFiltrosEOrdenacao() {
  let lista = [...state.todosLivros];

  // 1. Filtro por Estante / Aba
  if (state.abaAtiva === "favoritos") {
    lista = lista.filter(l => state.favoritos.has(l.caminho));
  } else if (state.abaAtiva === "lendo") {
    lista = lista.filter(l => l.status === "lendo");
  } else if (state.abaAtiva === "concluidos") {
    lista = lista.filter(l => l.status === "concluidos");
  } else if (state.abaAtiva === "quero-ler") {
    lista = lista.filter(l => l.status === "quero-ler");
  }

  // 2. Busca por Título, Título Humanizado ou Autor
  const termo = state.termoBusca.trim().toLowerCase();
  if (termo) {
    lista = lista.filter(l => 
      (l.titulo && l.titulo.toLowerCase().includes(termo)) ||
      (l.tituloHumanizado && l.tituloHumanizado.toLowerCase().includes(termo)) ||
      (l.autor && l.autor.toLowerCase().includes(termo)) ||
      (l.nome && l.nome.toLowerCase().includes(termo))
    );
  }

  // 3. Ordenação
  lista.sort((a, b) => {
    const titA = a.tituloHumanizado || a.titulo || a.nome;
    const titB = b.tituloHumanizado || b.titulo || b.nome;

    switch (state.ordenacaoAtual) {
      case "titulo-desc":
        return titB.localeCompare(titA, undefined, { numeric: true });
      case "autor-asc":
        return (a.autor || "").localeCompare(b.autor || "");
      case "data-desc":
        return (b.modificadoEm || 0) - (a.modificadoEm || 0);
      case "tamanho-desc":
        return (b.tamanho || 0) - (a.tamanho || 0);
      case "titulo-asc":
      default:
        return titA.localeCompare(titB, undefined, { numeric: true });
    }
  });

  state.livrosFiltrados = lista;
  renderizarGrade(lista);
  atualizarContadores();
}

function atualizarContadores() {
  const total = state.todosLivros.length;
  const countFav = state.todosLivros.filter(l => state.favoritos.has(l.caminho)).length;
  const countLendo = state.todosLivros.filter(l => l.status === "lendo").length;
  const countConcluidos = state.todosLivros.filter(l => l.status === "concluidos").length;
  const countQueroLer = state.todosLivros.filter(l => l.status === "quero-ler").length;

  document.getElementById("tabCountTodos") && (document.getElementById("tabCountTodos").textContent = total);
  document.getElementById("tabCountFav") && (document.getElementById("tabCountFav").textContent = countFav);
  document.getElementById("tabCountLendo") && (document.getElementById("tabCountLendo").textContent = countLendo);
  document.getElementById("tabCountConcluidos") && (document.getElementById("tabCountConcluidos").textContent = countConcluidos);
  document.getElementById("tabCountQueroLer") && (document.getElementById("tabCountQueroLer").textContent = countQueroLer);

  document.getElementById("countAllBadge") && (document.getElementById("countAllBadge").textContent = total);
  document.getElementById("countFavBadge") && (document.getElementById("countFavBadge").textContent = countFav);
  document.getElementById("countLendoBadge") && (document.getElementById("countLendoBadge").textContent = countLendo);
  document.getElementById("countConcluidosBadge") && (document.getElementById("countConcluidosBadge").textContent = countConcluidos);
  document.getElementById("countQueroLerBadge") && (document.getElementById("countQueroLerBadge").textContent = countQueroLer);

  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) {
    const totalBytes = state.livrosFiltrados.reduce((acc, l) => acc + (l.tamanho || 0), 0);
    const label = state.livrosFiltrados.length === 1 ? "obra encontrada" : "obras encontradas";
    resultsCount.textContent = `${state.livrosFiltrados.length} ${label} • ${formatarTamanho(totalBytes)}`;
  }
}

function renderizarGrade(lista) {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!lista || lista.length === 0) {
    let tituloVazio = "Nenhum livro encontrado";
    let descVazio = "Não há livros que correspondam ao filtro atual.";
    let botaoAcao = `<button class="btn-empty-action" onclick="alternarAba('todos')">Ver Todos os Livros</button>`;

    if (state.abaAtiva === "favoritos") {
      tituloVazio = "Nenhum livro favoritado";
      descVazio = "Clique na estrela de qualquer livro para salvar na sua lista de favoritos.";
    } else if (state.abaAtiva === "lendo") {
      tituloVazio = "Nenhuma leitura em andamento";
      descVazio = "Abra um livro e marque seu status como 'Lendo' para acompanhar seu progresso.";
    } else if (state.abaAtiva === "concluidos") {
      tituloVazio = "Nenhum livro concluído";
      descVazio = "Marque seus livros como concluídos conforme terminar de lê-los.";
    } else if (state.abaAtiva === "quero-ler") {
      tituloVazio = "Lista de desejos vazia";
      descVazio = "Adicione livros em 'Quero Ler' para organizar suas próximas leituras.";
    } else if (state.todosLivros.length === 0) {
      if (!state.buscaRecursiva) {
        tituloVazio = "Nenhum e-book na raiz da pasta";
        descVazio = `Não encontramos e-books diretamente na pasta selecionada. Seus arquivos podem estar dentro de subpastas!`;
        botaoAcao = `<button class="btn-empty-action" id="btnAtivarSubpastasVazio">📂 Ativar Busca em Subpastas</button>`;
      } else {
        tituloVazio = "Nenhum e-book encontrado";
        descVazio = `Nenhum arquivo compatível (.epub, .pdf, .mobi, .cbr, .cbz, .txt) foi encontrado em "${truncarCaminho(state.pastaAtual)}".`;
        botaoAcao = `<button class="btn-empty-action" onclick="abrirPopupPasta()">📁 Escolher Outra Pasta</button>`;
      }
    }

    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3 class="empty-title">${tituloVazio}</h3>
        <p class="empty-desc">${descVazio}</p>
        ${botaoAcao}
      </div>
    `;

    document.getElementById("btnAtivarSubpastasVazio")?.addEventListener("click", alternarSubpastas);
    return;
  }

  lista.forEach(livro => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.setAttribute("data-caminho", livro.caminho);

    const isFav = state.favoritos.has(livro.caminho);
    const formato = (livro.extensao || "").replace(".", "").toUpperCase();
    const tamanho = formatarTamanho(livro.tamanho);
    const tituloExibicao = livro.tituloHumanizado || formatarTituloHumanizado(livro.titulo, livro.nome);
    const paleta = obterPaletaCapa(livro.titulo || livro.nome);

    // Label do status de leitura
    let statusBadge = "";
    if (livro.status === "lendo") {
      statusBadge = `<span class="badge-reading-status lendo">📖 Lendo</span>`;
    } else if (livro.status === "concluidos") {
      statusBadge = `<span class="badge-reading-status concluidos">✅ Concluído</span>`;
    } else if (livro.status === "quero-ler") {
      statusBadge = `<span class="badge-reading-status quero-ler">📌 Quero Ler</span>`;
    }

    // Capa Extraída ou Fallback Estilo Capa Dura Clássica
    const capaConteudo = livro.thumbnail
      ? `<img class="book-cover-image" src="${livro.thumbnail}" alt="${tituloExibicao}" loading="lazy" />`
      : `
        <div class="book-cover-fallback theme-${paleta.tema}" style="background: ${paleta.bg}; border-left-color: ${paleta.borda};">
          <div class="fallback-book-ribbon" style="background: ${paleta.borda};"></div>
          <h4 class="fallback-book-title">${tituloExibicao}</h4>
          <p class="fallback-book-author" style="color: ${paleta.borda};">${livro.autor !== "Desconhecido" ? livro.autor : ""}</p>
        </div>
      `;

    // Progresso de Leitura no Card (apenas para obras que já foram iniciadas)
    const prog = livro.progresso || { paginaAtual: 0, totalPaginas: 0, porcentagem: 0 };
    const paginaAtual = prog.paginaAtual || 0;
    const totalPaginas = prog.totalPaginas || 0;
    const porcentagem = totalPaginas > 0
      ? Math.min(100, Math.round((paginaAtual / totalPaginas) * 100))
      : (prog.porcentagem || 0);

    let progressHtml = "";
    if (paginaAtual > 0) {
      const isConcluido = porcentagem >= 100;
      progressHtml = `
        <div class="card-reading-progress" title="Página ${paginaAtual}${totalPaginas ? ` de ${totalPaginas}` : ''} (${porcentagem}%)">
          <div class="card-progress-bar-bg">
            <div class="card-progress-bar-fill ${isConcluido ? 'concluido' : ''}" style="width: ${porcentagem}%"></div>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="book-cover-wrapper">
        ${capaConteudo}
        <span class="badge-format">${formato}</span>
        ${statusBadge}

        <button class="card-copilot-badge" title="Conversar com o Copiloto IA deste livro">
          <span class="copilot-sparkle-icon">✨</span>
          <span class="copilot-badge-text">Copiloto</span>
        </button>

        <button class="fav-btn ${isFav ? "active" : ""}" title="Favoritar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? "#e5a93b" : "rgba(255,255,255,0.7)"}">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>

        <div class="cover-hover-overlay">
          <button class="btn-cover-read" title="Abrir e ler no Windows">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Ler</span>
          </button>
          <button class="btn-cover-copilot" title="Conversar com o Copiloto IA deste livro">
            <span>✨</span>
            <span>Copiloto</span>
          </button>
          <button class="btn-cover-info" title="Ver detalhes da obra">ℹ️</button>
        </div>
        ${progressHtml}
      </div>

      <div class="book-card-body">
        <h3 class="book-title" title="${livro.titulo} (${livro.nome})">${tituloExibicao}</h3>
        <div class="book-meta">
          <span class="meta-size">${tamanho}</span>
          ${paginaAtual > 0 ? `<span class="meta-prog">${porcentagem}%</span>` : `<span class="meta-ext">${formato}</span>`}
        </div>
      </div>
    `;

    // Ação do Botão Copiloto no Card (Badge Direto e Hover)
    card.querySelector(".card-copilot-badge")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirCopilotoIA(livro);
    });

    card.querySelector(".btn-cover-copilot")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirCopilotoIA(livro);
    });

    // Ação do Botão Flutuante de Leitura na Capa
    card.querySelector(".btn-cover-read")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.abrirNoWindows?.(livro.caminho);
      showToast(`Abrindo "${tituloExibicao}" no Windows...`);
    });

    // Ação do Botão de Detalhes na Capa
    card.querySelector(".btn-cover-info")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalLivro(livro);
    });

    // Duplo clique no Card: Abre diretamente no leitor do Windows
    card.addEventListener("dblclick", () => {
      window.api?.abrirNoWindows?.(livro.caminho);
      showToast(`Abrindo "${tituloExibicao}" no Windows...`);
    });

    // Clique no Card: Abre o Modal de Detalhes
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn") || e.target.closest(".btn-cover-read") || e.target.closest(".btn-cover-copilot") || e.target.closest(".card-copilot-badge") || e.target.closest(".btn-cover-info")) return;
      abrirModalLivro(livro);
    });

    // Botão Favoritar
    const btnFav = card.querySelector(".fav-btn");
    btnFav?.addEventListener("click", (e) => {
      e.stopPropagation();
      alternarFavorito(livro.caminho, btnFav);
    });

    grid.appendChild(card);
  });
}

function renderizarEstadoSemPasta() {
  const grid = document.getElementById("grid");
  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) resultsCount.textContent = "Nenhuma pasta selecionada";
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📁</div>
      <h3 class="empty-title">Nenhuma pasta selecionada</h3>
      <p class="empty-desc">Escolha a pasta do seu computador onde seus e-books (.pdf, .epub, etc.) estão localizados ou selecione arquivos diretamente.</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px;">
        <button class="btn-empty-action" onclick="abrirPopupPasta()">📁 Selecionar Pasta</button>
        <button class="btn-empty-action" id="btnEscolherArquivosVazio" style="background: rgba(229, 169, 59, 0.15); border: 1px solid rgba(229, 169, 59, 0.4); color: #e5a93b;">📄 Selecionar Arquivos PDF</button>
      </div>
    </div>
  `;
  document.getElementById("btnEscolherArquivosVazio")?.addEventListener("click", () => {
    window.api?.escolherArquivos?.().then(novaPasta => {
      if (novaPasta) {
        state.pastaAtual = novaPasta;
        showToast("Pasta de e-books selecionada!");
        carregarBiblioteca();
      }
    });
  });
}

// ============================================================
// 5. MODAL DE DETALHES DO LIVRO
// ============================================================

function abrirModalLivro(livro) {
  const modal = document.getElementById("modalLivro");
  if (!modal) return;

  state.livroSelecionado = livro;
  const tituloLimpo = livro.tituloHumanizado || formatarTituloHumanizado(livro.titulo, livro.nome);
  const formato = (livro.extensao || "").replace(".", "").toUpperCase();
  const paleta = obterPaletaCapa(livro.titulo || livro.nome);

  document.getElementById("modalTitulo").textContent = tituloLimpo;
  document.getElementById("modalAutor").textContent = livro.autor !== "Desconhecido" ? livro.autor : "Autor Não Informado";
  document.getElementById("modalBadgeFormato").textContent = formato;

  const specs = document.getElementById("modalSpecs");
  if (specs) {
    const totPaginas = livro.progresso?.totalPaginas;
    specs.innerHTML = `
      <div class="modal-specs-pills">
        <span class="spec-pill">${formato}</span>
        <span class="spec-pill">${formatarTamanho(livro.tamanho)}</span>
        ${totPaginas ? `<span class="spec-pill">${totPaginas} págs</span>` : ""}
      </div>
      <div class="modal-filepath" title="${livro.caminho}">📁 ${livro.nome}</div>
    `;
  }

  const coverContainer = document.getElementById("modalCapaContainer");
  if (coverContainer) {
    if (livro.thumbnail) {
      coverContainer.innerHTML = `<img src="${livro.thumbnail}" alt="${tituloLimpo}" class="cover-fade-in">`;
    } else {
      coverContainer.innerHTML = `
        <div class="book-cover-fallback theme-${paleta.tema}" style="height:100%; background:${paleta.bg}; border-left-color:${paleta.borda};">
          <div class="fallback-book-ribbon" style="background:${paleta.borda};"></div>
          <div class="fallback-book-header">
            <span class="fallback-book-format" style="color:${paleta.borda};">${formato}</span>
          </div>
          <h4 class="fallback-book-title">${tituloLimpo}</h4>
          <p class="fallback-book-author" style="color:${paleta.borda};">${livro.autor !== "Desconhecido" ? livro.autor : "Biblioteca Digital"}</p>
          <div class="fallback-book-footer">📖</div>
        </div>
      `;
    }
  }

  // Atualiza botões de status de leitura ativos
  document.querySelectorAll(".btn-status").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === (livro.status || "nenhum"));
  });

  // Preenche dados do progresso de leitura
  const prog = livro.progresso || { paginaAtual: 0, totalPaginas: 0, porcentagem: 0, anotacoes: "", ultimaLeituraEm: null };
  const inputPagina = document.getElementById("inputPaginaAtual");
  const inputTotal = document.getElementById("inputTotalPaginas");
  const inputNotas = document.getElementById("inputAnotacoes");
  const lblUltima = document.getElementById("lblUltimaLeitura");

  if (inputPagina) inputPagina.value = prog.paginaAtual || 0;
  if (inputTotal) inputTotal.value = prog.totalPaginas || 0;
  if (inputNotas) inputNotas.value = prog.anotacoes || "";
  if (lblUltima) lblUltima.textContent = formatarDataLeitura(prog.ultimaLeituraEm);

  atualizarProgressoVisual(prog.paginaAtual, prog.totalPaginas);
  alternarTabModal("detalhes");

  modal.hidden = false;
  document.addEventListener("keydown", lidarTeclasModal);
}

function fecharModalLivro() {
  const modal = document.getElementById("modalLivro");
  if (modal) modal.hidden = true;
  state.livroSelecionado = null;
  document.removeEventListener("keydown", lidarTeclasModal);
}

function lidarTeclasModal(e) {
  if (e.key === "Escape") {
    fecharModalLivro();
    fecharModalConfigIA();
    fecharCopilotoIA();
  }
}

// ============================================================================
// 5.1 TEMA CLARO / ESCURO & CONFIGURAÇÃO DA IA (GROQ)
// ============================================================================

function aplicarTema(novoTema) {
  state.tema = novoTema;
  localStorage.setItem("ef_theme", novoTema);
  document.body.setAttribute("data-theme", novoTema);

  const iconLua = document.getElementById("iconLua");
  const iconSol = document.getElementById("iconSol");
  if (iconLua && iconSol) {
    iconLua.hidden = novoTema === "light";
    iconSol.hidden = novoTema !== "light";
  }
}

async function abrirModalConfigIA() {
  const modal = document.getElementById("modalConfigIA");
  if (!modal) return;

  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "qwen/qwen3.8-27b", isBundled: false };
  const inputKey = document.getElementById("inputGroqKey");
  const selectModel = document.getElementById("selectModeloIA");
  const lblStatus = document.getElementById("lblStatusConexao");

  if (inputKey) {
    inputKey.value = cfg.apiKey || "";
    if (cfg.isBundled) {
      inputKey.placeholder = "Chave integrada no Instalador MSI (Ativa)";
    } else {
      inputKey.placeholder = "gsk_...";
    }
  }

  if (selectModel) selectModel.value = cfg.model || "qwen/qwen3.8-27b";

  if (lblStatus) {
    if (cfg.isBundled) {
      lblStatus.textContent = "🟢 Chave de IA ativa via Instalador MSI";
      lblStatus.className = "status-indicator ok";
    } else if (cfg.apiKey) {
      lblStatus.textContent = "🟢 Chave configurada no perfil do usuário";
      lblStatus.className = "status-indicator ok";
    } else {
      lblStatus.textContent = "⚪ Nenhuma chave configurada";
      lblStatus.className = "status-indicator";
    }
  }

  modal.hidden = false;
}

function fecharModalConfigIA() {
  const modal = document.getElementById("modalConfigIA");
  if (modal) modal.hidden = true;
}

// ============================================================================
// 5.2 NAVEGAÇÃO POR ABAS NO MODAL E TUTOR IA (BOOK-TO-SKILL)
// ============================================================================

function alternarTabModal(tab) {
  state.tabModalAtiva = tab;
  const tabBtnDetalhes = document.getElementById("tabBtnDetalhes");
  const tabBtnTutor = document.getElementById("tabBtnTutorIA");
  const panelDetalhes = document.getElementById("panelDetalhes");
  const panelTutor = document.getElementById("panelTutorIA");

  if (tab === "tutor") {
    tabBtnDetalhes?.classList.remove("active");
    tabBtnTutor?.classList.add("active");
    if (panelDetalhes) panelDetalhes.hidden = true;
    if (panelTutor) panelTutor.hidden = false;
    carregarEstadoTutorIA();
  } else {
    tabBtnTutor?.classList.remove("active");
    tabBtnDetalhes?.classList.add("active");
    if (panelTutor) panelTutor.hidden = true;
    if (panelDetalhes) panelDetalhes.hidden = false;
  }
}

async function carregarEstadoTutorIA() {
  if (!state.livroSelecionado) return;
  state.chatHistorico = [];

  const lblTitulo = document.getElementById("lblSkillTitulo");
  const lblDesc = document.getElementById("lblSkillDesc");
  const btnGerar = document.getElementById("btnGerarSkillLivro");
  const messagesArea = document.getElementById("chatMessages");

  const nomeObra = state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo || state.livroSelecionado.nome;

  if (messagesArea) {
    messagesArea.innerHTML = `
      <div class="chat-msg tutor">
        <div class="msg-avatar">🤖</div>
        <div class="msg-content">
          <p>Olá! Eu sou seu <strong>Tutor de Leitura</strong> da obra <em>${nomeObra}</em> alimentado pela IA da Groq. Pergunte qualquer dúvida sobre os conceitos, regras práticas ou peça resumos desta obra!</p>
        </div>
      </div>
    `;
  }

  // Verifica se o livro já possui Skill gerada
  const skillInfo = await window.api?.obterSkillLivro?.(state.livroSelecionado.caminho);
  if (skillInfo?.temSkill) {
    state.skillAtual = skillInfo;
    if (lblTitulo) lblTitulo.textContent = "⚡ Skill de IA Ativa (Conhecimento Destilado)";
    if (lblDesc) lblDesc.textContent = "O conteúdo desta obra está indexado em formato modular para respostas imediatas e precisas.";
    if (btnGerar) btnGerar.textContent = "🔄 Re-destilar Livro";
  } else {
    state.skillAtual = null;
    if (lblTitulo) lblTitulo.textContent = "⚡ Skill de IA Não Gerada";
    if (lblDesc) lblDesc.textContent = "Destile os capítulos desta obra em uma Skill modular para respostas instantâneas sem alucinações.";
    if (btnGerar) btnGerar.textContent = "⚡ Gerar Skill do Livro";
  }
}

async function executarBookToSkill() {
  if (!state.livroSelecionado) return;
  const cfg = await window.api?.obterConfigIA?.();
  if (!cfg?.apiKey) {
    showToast("Configure sua chave da API Groq antes de gerar a skill.");
    abrirModalConfigIA();
    return;
  }

  const btnGerar = document.getElementById("btnGerarSkillLivro");
  const progressTrack = document.getElementById("skillProgressBarTrack");
  const progressFill = document.getElementById("skillProgressBarFill");
  const lblDesc = document.getElementById("lblSkillDesc");

  if (btnGerar) { btnGerar.disabled = true; btnGerar.textContent = "⏳ Extraindo..."; }
  if (progressTrack) progressTrack.hidden = false;
  if (progressFill) progressFill.style.width = "20%";

  try {
    const caminho = state.livroSelecionado.caminho;
    const titulo = state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo || state.livroSelecionado.nome;
    let textoAmostra = "";

    // Se for PDF, tenta extrair texto das páginas iniciais / índice usando pdfjsLib
    if (state.livroSelecionado.extensao === ".pdf" && window.pdfjsLib) {
      if (lblDesc) lblDesc.textContent = "Lendo páginas do PDF para indexação...";
      const buffer = await window.api?.lerArquivoBuffer?.(caminho);
      if (buffer) {
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        const totalPag = Math.min(pdf.numPages, 30);
        let textos = [];
        for (let p = 1; p <= totalPag; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const strings = content.items.map(it => it.str).join(" ");
          if (strings.trim().length > 30) {
            textos.push(`[Pág ${p}] ${strings.slice(0, 1000)}`);
          }
          if (progressFill) progressFill.style.width = `${20 + Math.round((p / totalPag) * 40)}%`;
        }
        textoAmostra = textos.join("\n\n");
      }
    } else {
      textoAmostra = `Livro: ${titulo}\nAutor: ${state.livroSelecionado.autor}\nFormato: ${state.livroSelecionado.extensao}`;
    }

    if (lblDesc) lblDesc.textContent = "Sintetizando Skill com modelos mentais via Groq...";
    if (progressFill) progressFill.style.width = "75%";

    const promptSkill = `Você é um gerador de Agent Skills (padrão SKILL.md).
Analise os dados e trechos da seguinte obra para gerar a documentação modular:
Obra: "${titulo}"
Autor: "${state.livroSelecionado.autor || "Desconhecido"}"
Trechos da obra:
${textoAmostra.slice(0, 12000)}

Gere 3 seções estruturadas rigorosamente no formato abaixo:

===SKILL.MD===
# Skill: ${titulo}
## Visão Geral e Modelos Mentais
(Resumo conciso dos principais conceitos, regras de decisão e lições centrais da obra)
## Tópicos e Capítulos Principais
(Mapeamento dos tópicos e capítulos)

===CHEATSHEET.MD===
# Cheatsheet & Regras Práticas: ${titulo}
- Lista de regras de ação, princípios e boas práticas imediatas para consulta rápida

===GLOSSARY.MD===
# Glossário de Termos: ${titulo}
- Principais termos técnicos e seus significados objetivos
`;

    const resIA = await window.api?.perguntarGroq?.({
      pergunta: promptSkill,
      contexto: "Destilação oficial no formato book-to-skill",
      modelo: cfg.model || "qwen/qwen3.8-27b"
    });

    if (resIA?.success && resIA.resposta) {
      if (progressFill) progressFill.style.width = "95%";
      const resp = resIA.resposta;
      let skillMd = resp;
      let cheatsheet = "";
      let glossary = "";

      if (resp.includes("===CHEATSHEET.MD===")) {
        const partes = resp.split("===CHEATSHEET.MD===");
        skillMd = partes[0].replace("===SKILL.MD===", "").trim();
        const resto = partes[1];
        if (resto.includes("===GLOSSARY.MD===")) {
          const sub = resto.split("===GLOSSARY.MD===");
          cheatsheet = sub[0].trim();
          glossary = sub[1].trim();
        } else {
          cheatsheet = resto.trim();
        }
      }

      await window.api?.salvarSkillLivro?.({
        caminho,
        titulo,
        skillMd,
        cheatsheet,
        glossary
      });

      if (progressFill) progressFill.style.width = "100%";
      showToast("Skill do livro gerada com sucesso!");
      await carregarEstadoTutorIA();
    } else {
      throw new Error(resIA?.error || "Falha ao sintetizar com o Groq.");
    }
  } catch (err) {
    console.error("Erro no book-to-skill:", err);
    showToast(`Erro na geração: ${err.message}`);
    if (lblDesc) lblDesc.textContent = "Erro ao destilar livro. Verifique a chave ou tente novamente.";
  } finally {
    if (btnGerar) { btnGerar.disabled = false; btnGerar.textContent = "⚡ Gerar Skill do Livro"; }
    setTimeout(() => { if (progressTrack) progressTrack.hidden = true; }, 1500);
  }
}

async function enviarPerguntaChat(textoPergunta = null) {
  const input = document.getElementById("inputChatPergunta");
  const pergunta = (textoPergunta || input?.value || "").trim();
  if (!pergunta) return;

  if (input) input.value = "";

  const cfg = await window.api?.obterConfigIA?.();
  if (!cfg?.apiKey) {
    showToast("Configure sua chave da API Groq no botão ⚙️ IA.");
    abrirModalConfigIA();
    return;
  }

  const messagesArea = document.getElementById("chatMessages");
  if (!messagesArea) return;

  // Adiciona balão do usuário
  const userMsgEl = document.createElement("div");
  userMsgEl.className = "chat-msg user";
  userMsgEl.innerHTML = `
    <div class="msg-avatar">👤</div>
    <div class="msg-content"><p>${pergunta.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p></div>
  `;
  messagesArea.appendChild(userMsgEl);

  // Adiciona balão de carregamento do Tutor
  const tutorMsgEl = document.createElement("div");
  tutorMsgEl.className = "chat-msg tutor";
  tutorMsgEl.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-content"><p><em>Pensando...</em></p></div>
  `;
  messagesArea.appendChild(tutorMsgEl);
  messagesArea.scrollTop = messagesArea.scrollHeight;

  state.chatHistorico.push({ role: "user", content: pergunta });

  // Monta o contexto a partir da Skill gerada ou dos metadados do livro
  let contexto = "";
  if (state.skillAtual?.skillMd) {
    contexto = `${state.skillAtual.skillMd}\n\n${state.skillAtual.cheatsheet || ""}`;
  } else if (state.livroSelecionado) {
    contexto = `Obra: ${state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo}\nAutor: ${state.livroSelecionado.autor}\nProgresso: Pág. ${state.livroSelecionado.progresso?.paginaAtual || 0}/${state.livroSelecionado.progresso?.totalPaginas || 0}\nAnotações: ${state.livroSelecionado.progresso?.anotacoes || "Nenhuma"}`;
  }

  const res = await window.api?.perguntarGroq?.({
    pergunta,
    contexto,
    historico: state.chatHistorico
  });

  if (res?.success && res.resposta) {
    state.chatHistorico.push({ role: "assistant", content: res.resposta });
    tutorMsgEl.querySelector(".msg-content").innerHTML = formatarMarkdownSimples(res.resposta);
  } else {
    tutorMsgEl.querySelector(".msg-content").innerHTML = `<p style="color:#f43f5e;">⚠️ ${res?.error || "Não foi possível obter resposta da IA."}</p>`;
  }

  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function formatarMarkdownSimples(md) {
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, "<strong>$1</strong>")
    .replace(/^## (.*$)/gim, "<strong>$1</strong>")
    .replace(/^# (.*$)/gim, "<strong>$1</strong>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/^\s*-\s+(.*$)/gim, "• $1<br/>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
  return `<p>${html}</p>`;
}

// ============================================================================
// 5.3 WORKSPACE DEDICADO DO COPILOTO IA (ESTILO CHATGPT / CLAUDE)
// ============================================================================

async function abrirCopilotoIA(livro) {
  if (!livro) return;
  state.livroSelecionado = livro;
  state.chatHistorico = [];

  const modal = document.getElementById("modalCopilotoIA");
  if (!modal) return;

  const tituloLimpo = livro.tituloHumanizado || formatarTituloHumanizado(livro.titulo, livro.nome);
  const autorLimpo = livro.autor !== "Desconhecido" ? livro.autor : "Autor Não Informado";
  const paleta = obterPaletaCapa(livro.titulo || livro.nome);

  // Preenche metadados do livro no cabeçalho
  const lblTitulo = document.getElementById("copilotModalTitulo");
  const lblAutor = document.getElementById("copilotModalAutor");
  const thumbContainer = document.getElementById("copilotHeaderThumb");
  const greeting = document.getElementById("copilotHeroGreeting");
  const modelName = document.getElementById("copilotModelName");
  const badgeStatus = document.getElementById("copilotStatusBadge");
  const btnIndexar = document.getElementById("lblCopilotIndexarBtn");

  if (lblTitulo) {
    lblTitulo.textContent = tituloLimpo;
    lblTitulo.title = `${livro.titulo} (${livro.nome})`;
  }
  if (lblAutor) lblAutor.textContent = autorLimpo;
  if (greeting) greeting.textContent = `Como posso te ajudar com "${tituloLimpo}"?`;

  if (thumbContainer) {
    if (livro.thumbnail) {
      thumbContainer.innerHTML = `<img src="${livro.thumbnail}" alt="${tituloLimpo}">`;
    } else {
      thumbContainer.innerHTML = `
        <div class="theme-${paleta.tema}" style="width:100%;height:100%;background:${paleta.bg};border-left:2px solid ${paleta.borda};display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#fff;">
          📖
        </div>
      `;
    }
  }

  // Identifica o modelo ativo
  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "qwen/qwen3.8-27b" };
  if (modelName) {
    const isQwen = (cfg.model || "").includes("qwen");
    modelName.textContent = isQwen ? "Qwen 2.5 27B" : "Compound Mini";
  }

  // Verifica se o livro já possui Skill gerada
  const skillInfo = await window.api?.obterSkillLivro?.(livro.caminho);
  if (skillInfo?.temSkill) {
    state.skillAtual = skillInfo;
    if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot"></span> Obra Indexada (30 págs)`;
    if (btnIndexar) btnIndexar.textContent = "Reindexar";
  } else {
    state.skillAtual = null;
    if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot" style="background:#e5a93b;box-shadow:0 0 6px #e5a93b;"></span> Obra Conectada`;
    if (btnIndexar) btnIndexar.textContent = "Indexar Livro";
  }

  // Limpa feed e reseta para o estado Hero inicial
  const heroState = document.getElementById("copilotHeroState");
  const messagesList = document.getElementById("copilotMessagesList");
  const quickChips = document.getElementById("copilotQuickChipsBar");
  const input = document.getElementById("copilotChatInput");

  if (heroState) heroState.hidden = false;
  if (messagesList) {
    messagesList.hidden = true;
    messagesList.innerHTML = "";
  }
  if (quickChips) quickChips.hidden = true;
  if (input) {
    input.value = "";
    input.style.height = "auto";
  }

  modal.hidden = false;
  setTimeout(() => input?.focus(), 150);
}

function fecharCopilotoIA() {
  const modal = document.getElementById("modalCopilotoIA");
  if (modal) modal.hidden = true;
}

async function enviarPerguntaCopiloto(textoPergunta = null) {
  const input = document.getElementById("copilotChatInput");
  const pergunta = (textoPergunta || input?.value || "").trim();
  if (!pergunta) return;

  if (input) {
    input.value = "";
    input.style.height = "auto";
    document.getElementById("btnCopilotEnviar")?.classList.remove("active");
  }

  const cfg = await window.api?.obterConfigIA?.();
  if (!cfg?.apiKey) {
    showToast("Configure sua chave da API Groq no botão ⚡ Copiloto IA.");
    abrirModalConfigIA();
    return;
  }

  const heroState = document.getElementById("copilotHeroState");
  const messagesList = document.getElementById("copilotMessagesList");
  const quickChips = document.getElementById("copilotQuickChipsBar");
  const chatFeed = document.getElementById("copilotChatFeed");

  if (heroState) heroState.hidden = true;
  if (messagesList) messagesList.hidden = false;
  if (quickChips) quickChips.hidden = false;

  // 1. Balão do Usuário
  const userRow = document.createElement("div");
  userRow.className = "copilot-msg-row user";
  userRow.innerHTML = `
    <div class="copilot-msg-bubble">
      <p>${pergunta.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>
    <div class="copilot-msg-avatar">👤</div>
  `;
  messagesList.appendChild(userRow);

  // 2. Balão de Pensando do Copiloto IA
  const assistantRow = document.createElement("div");
  assistantRow.className = "copilot-msg-row assistant";
  assistantRow.innerHTML = `
    <div class="copilot-msg-avatar">✨</div>
    <div class="copilot-msg-bubble">
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="copilot-thinking-dots">
          <span></span><span></span><span></span>
        </div>
        <span style="font-size:0.78rem; color:var(--text-secondary);">Consultando o conteúdo da obra...</span>
      </div>
    </div>
  `;
  messagesList.appendChild(assistantRow);
  if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;

  state.chatHistorico.push({ role: "user", content: pergunta });

  // Monta contexto completo
  let contexto = "";
  if (state.skillAtual?.skillMd) {
    contexto = `${state.skillAtual.skillMd}\n\n${state.skillAtual.cheatsheet || ""}\n\n${state.skillAtual.glossary || ""}`;
  } else if (state.livroSelecionado) {
    contexto = `Obra: ${state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo}\nAutor: ${state.livroSelecionado.autor}\nFormato: ${state.livroSelecionado.extensao}\nProgresso de leitura: Pág. ${state.livroSelecionado.progresso?.paginaAtual || 0}/${state.livroSelecionado.progresso?.totalPaginas || 0}\nAnotações: ${state.livroSelecionado.progresso?.anotacoes || "Nenhuma"}`;
  }

  const res = await window.api?.perguntarGroq?.({
    pergunta,
    contexto,
    historico: state.chatHistorico
  });

  if (res?.success && res.resposta) {
    state.chatHistorico.push({ role: "assistant", content: res.resposta });
    const formattedHtml = formatarMarkdownSimples(res.resposta);
    assistantRow.querySelector(".copilot-msg-bubble").innerHTML = `
      <div class="copilot-msg-content">${formattedHtml}</div>
      <div class="copilot-msg-actions">
        <button type="button" class="btn-msg-copy" title="Copiar resposta">
          <span>📋</span> <span>Copiar</span>
        </button>
      </div>
    `;

    // Ação do Botão Copiar
    assistantRow.querySelector(".btn-msg-copy")?.addEventListener("click", () => {
      navigator.clipboard.writeText(res.resposta);
      showToast("Resposta copiada para a área de transferência!");
    });
  } else {
    assistantRow.querySelector(".copilot-msg-bubble").innerHTML = `
      <p style="color:#f43f5e; font-weight:600;">⚠️ ${res?.error || "Não foi possível obter resposta da IA."}</p>
    `;
  }

  if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function executarBookToSkillCopiloto() {
  if (!state.livroSelecionado) return;
  const cfg = await window.api?.obterConfigIA?.();
  if (!cfg?.apiKey) {
    showToast("Configure sua chave da API Groq antes de indexar.");
    abrirModalConfigIA();
    return;
  }

  const progressTrack = document.getElementById("copilotIndexProgressTrack");
  const progressFill = document.getElementById("copilotIndexProgressFill");
  const progressText = document.getElementById("copilotIndexProgressText");
  const btnIndexar = document.getElementById("lblCopilotIndexarBtn");
  const badgeStatus = document.getElementById("copilotStatusBadge");

  if (btnIndexar) btnIndexar.textContent = "Extraindo...";
  if (progressTrack) progressTrack.hidden = false;
  if (progressFill) progressFill.style.width = "20%";
  if (progressText) progressText.textContent = "Lendo páginas da obra para indexação...";

  try {
    const caminho = state.livroSelecionado.caminho;
    const titulo = state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo || state.livroSelecionado.nome;
    let textoAmostra = "";

    if (state.livroSelecionado.extensao === ".pdf" && window.pdfjsLib) {
      const buffer = await window.api?.lerArquivoBuffer?.(caminho);
      if (buffer) {
        const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        const totalPag = Math.min(pdf.numPages, 30);
        let textos = [];
        for (let p = 1; p <= totalPag; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const strings = content.items.map(it => it.str).join(" ");
          if (strings.trim().length > 30) {
            textos.push(`[Pág ${p}] ${strings.slice(0, 1000)}`);
          }
          if (progressFill) progressFill.style.width = `${20 + Math.round((p / totalPag) * 45)}%`;
        }
        textoAmostra = textos.join("\n\n");
      }
    }

    if (!textoAmostra) {
      const nomeBase = (caminho || "").split(/[\\/]/).pop();
      textoAmostra = `Obra: ${titulo}. Autor: ${state.livroSelecionado.autor || "Não informado"}. Tamanho: ${state.livroSelecionado.tamanho} bytes. Arquivo: ${nomeBase}.`;
    }

    if (progressFill) progressFill.style.width = "75%";
    if (progressText) progressText.textContent = "Destilando conhecimento modular com a Groq...";

    const promptDestilacao = `Você é o compilador da arquitetura book-to-skill para a obra "${titulo}".
Gere uma destilação modular técnica e profunda nos 3 blocos abaixo rigorosamente separados:

===SKILL.MD===
# Livro: ${titulo}
## Visão Geral e Tópicos Fundamentais
(Escreva os 5 princípios mais importantes da obra)

===CHEATSHEET.MD===
# Cola Rápida e Regras Práticas
(Tópicos práticos, comandos ou regras do livro)

===GLOSSARY.MD===
# Glossário de Termos e Conceitos
(Definições dos termos-chave)

TEXTO DA OBRA EXTRAÍDO:
${textoAmostra.slice(0, 8000)}`;

    const resIA = await window.api?.perguntarGroq?.({
      pergunta: promptDestilacao,
      contexto: "",
      modelo: cfg.model || "qwen/qwen3.8-27b"
    });

    if (resIA?.success && resIA.resposta) {
      const resp = resIA.resposta;
      let skillMd = "";
      let cheatsheet = "";
      let glossary = "";

      const p1 = resp.indexOf("===SKILL.MD===");
      const p2 = resp.indexOf("===CHEATSHEET.MD===");
      const p3 = resp.indexOf("===GLOSSARY.MD===");

      if (p1 !== -1 && p2 !== -1 && p3 !== -1) {
        skillMd = resp.slice(p1 + 14, p2).trim();
        cheatsheet = resp.slice(p2 + 19, p3).trim();
        glossary = resp.slice(p3 + 17).trim();
      } else {
        skillMd = resp;
      }

      await window.api?.salvarSkillLivro?.({
        caminho,
        titulo,
        skillMd,
        cheatsheet,
        glossary
      });

      if (progressFill) progressFill.style.width = "100%";
      showToast("Obra indexada com sucesso pelo Copiloto IA!");
      state.skillAtual = { temSkill: true, skillMd, cheatsheet, glossary };
      if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot"></span> Obra Indexada (30 págs)`;
      if (btnIndexar) btnIndexar.textContent = "Reindexar";
    } else {
      throw new Error(resIA?.error || "Falha ao sintetizar com o Groq.");
    }
  } catch (err) {
    console.error("Erro no book-to-skill:", err);
    showToast(`Erro na indexação: ${err.message}`);
  } finally {
    if (btnIndexar && btnIndexar.textContent === "Extraindo...") {
      btnIndexar.textContent = state.skillAtual?.temSkill ? "Reindexar" : "Indexar Livro";
    }
    setTimeout(() => { if (progressTrack) progressTrack.hidden = true; }, 1600);
  }
}

async function atualizarStatusLeitura(status) {
  if (!state.livroSelecionado) return;

  state.livroSelecionado.status = status;
  await window.api?.salvarStatusLeitura?.(state.livroSelecionado.caminho, status);

  // Se marcar como concluído diretamente e houver total de páginas, completa o progresso
  if (status === "concluidos" && state.livroSelecionado.progresso?.totalPaginas > 0) {
    const tot = state.livroSelecionado.progresso.totalPaginas;
    const inputPagina = document.getElementById("inputPaginaAtual");
    if (inputPagina) inputPagina.value = tot;
    atualizarProgressoVisual(tot, tot);
    await window.api?.salvarProgressoLeitura?.(state.livroSelecionado.caminho, {
      paginaAtual: tot,
      totalPaginas: tot,
      porcentagem: 100,
      anotacoes: document.getElementById("inputAnotacoes")?.value || ""
    });
    state.livroSelecionado.progresso.paginaAtual = tot;
    state.livroSelecionado.progresso.porcentagem = 100;
  }

  // Atualiza botões na interface do modal
  document.querySelectorAll(".btn-status").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.status === status);
  });

  aplicarFiltrosEOrdenacao();
  showToast("Status da obra atualizado!");
}

// ============================================================
// 6. FAVORITOS E ABAS
// ============================================================

function alternarFavorito(caminho, btn) {
  if (state.favoritos.has(caminho)) {
    state.favoritos.delete(caminho);
    btn?.classList.remove("active");
    if (btn) btn.querySelector("svg").setAttribute("fill", "rgba(255,255,255,0.7)");
    showToast("Removido dos Favoritos.");
  } else {
    state.favoritos.add(caminho);
    btn?.classList.add("active");
    if (btn) btn.querySelector("svg").setAttribute("fill", "#e5a93b");
    showToast("Adicionado aos Favoritos!");
  }

  salvarFavoritos();
  if (state.abaAtiva === "favoritos") aplicarFiltrosEOrdenacao();
}

function alternarAba(aba) {
  state.abaAtiva = aba;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === aba);
  });

  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.action === aba);
  });

  aplicarFiltrosEOrdenacao();
}

function limparBusca() {
  const input = document.getElementById("inputBusca");
  const btnLimpar = document.getElementById("btnLimparBusca");
  if (input) input.value = "";
  if (btnLimpar) btnLimpar.hidden = true;
  state.termoBusca = "";
  aplicarFiltrosEOrdenacao();
}

// ============================================================
// 7. POPUP E DROPDOWN
// ============================================================

let backdropMenu = null;

function abrirMenu() {
  const dropdown = document.getElementById("menuDropdown");
  if (!dropdown) return;
  dropdown.hidden = false;

  backdropMenu = document.createElement("div");
  backdropMenu.className = "menu-backdrop";
  document.body.appendChild(backdropMenu);

  backdropMenu.addEventListener("click", fecharMenu);
}

function fecharMenu() {
  const dropdown = document.getElementById("menuDropdown");
  if (dropdown) dropdown.hidden = true;
  if (backdropMenu) {
    backdropMenu.remove();
    backdropMenu = null;
  }
}

function abrirPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = false;
}

function fecharPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = true;
}

// ============================================================
// 8. INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const inputBusca = document.getElementById("inputBusca");
  const btnLimparBusca = document.getElementById("btnLimparBusca");
  let timerBusca = null;

  inputBusca?.addEventListener("input", (e) => {
    const val = e.target.value;
    if (btnLimparBusca) btnLimparBusca.hidden = !val;

    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => {
      state.termoBusca = val;
      aplicarFiltrosEOrdenacao();
    }, 250);
  });

  btnLimparBusca?.addEventListener("click", limparBusca);

  // Abas de Estantes
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => alternarAba(btn.dataset.tab));
  });

  // Ordenação
  document.getElementById("selectOrdenacao")?.addEventListener("change", (e) => {
    state.ordenacaoAtual = e.target.value;
    aplicarFiltrosEOrdenacao();
  });

  // Troca de Pasta e Seleção de Arquivos
  const acaoTrocarPasta = async () => {
    fecharMenu();
    fecharPopupPasta();
    const novaPasta = await window.api?.escolherPasta?.();
    if (novaPasta) {
      state.pastaAtual = novaPasta;
      showToast("Pasta de e-books selecionada!");
      carregarBiblioteca();
    }
  };

  const acaoEscolherArquivos = async () => {
    fecharMenu();
    fecharPopupPasta();
    const novaPasta = await window.api?.escolherArquivos?.();
    if (novaPasta) {
      state.pastaAtual = novaPasta;
      showToast("Pasta de e-books selecionada!");
      carregarBiblioteca();
    }
  };

  document.getElementById("btnTrocarPastaHeader")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("currentPathInfo")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("btnToggleSubpastas")?.addEventListener("click", alternarSubpastas);
  document.getElementById("popupSelecionar")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("popupSelecionarArquivos")?.addEventListener("click", acaoEscolherArquivos);
  document.getElementById("popupCancelar")?.addEventListener("click", fecharPopupPasta);

  // Drag and Drop global para carregar pastas ou PDFs arrastados
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const overlay = document.getElementById("dropOverlay");
    if (overlay) overlay.hidden = false;
  });

  window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null) {
      const overlay = document.getElementById("dropOverlay");
      if (overlay) overlay.hidden = true;
    }
  });

  window.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const overlay = document.getElementById("dropOverlay");
    if (overlay) overlay.hidden = true;

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const caminho = file.path;
      if (caminho) {
        const novaPasta = await window.api?.definirPasta?.(caminho);
        if (novaPasta) {
          state.pastaAtual = novaPasta;
          showToast(`Pasta configurada: ${truncarCaminho(novaPasta)}`);
          carregarBiblioteca();
        }
      }
    }
  });

  // Menu Dropdown
  document.getElementById("menuToggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("menuDropdown");
    dropdown?.hidden ? abrirMenu() : fecharMenu();
  });

  document.getElementById("menuDropdown")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "all") { alternarAba("todos"); fecharMenu(); }
    else if (action === "fav") { alternarAba("favoritos"); fecharMenu(); }
    else if (action === "lendo") { alternarAba("lendo"); fecharMenu(); }
    else if (action === "concluidos") { alternarAba("concluidos"); fecharMenu(); }
    else if (action === "quero-ler") { alternarAba("quero-ler"); fecharMenu(); }
    else if (action === "trocar-pasta") { acaoTrocarPasta(); }
    else if (action === "recarregar") { fecharMenu(); carregarBiblioteca(); showToast("Biblioteca recarregada!"); }
    else if (action === "toggle-recursivo") { fecharMenu(); alternarSubpastas(); }
    else if (action === "sobre") { fecharMenu(); showToast("EbookFinder v1.0 — Licença GNU GPLv3."); }
    else if (action === "dev") { fecharMenu(); window.api?.openExternal?.("https://joadsonrocha.github.io/"); }
  });

  // Modal do Livro
  document.getElementById("btnFecharModal")?.addEventListener("click", fecharModalLivro);
  document.getElementById("modalLivro")?.addEventListener("click", (e) => {
    if (e.target.id === "modalLivro") fecharModalLivro();
  });

  // Botões de Status no Modal
  document.querySelectorAll(".btn-status").forEach(btn => {
    btn.addEventListener("click", () => atualizarStatusLeitura(btn.dataset.status));
  });

  // Ações de Progresso de Leitura no Modal
  const inputPaginaAtual = document.getElementById("inputPaginaAtual");
  const inputTotalPaginas = document.getElementById("inputTotalPaginas");
  const inputAnotacoes = document.getElementById("inputAnotacoes");

  const onPageInputChange = () => {
    atualizarProgressoVisual(inputPaginaAtual?.value, inputTotalPaginas?.value);
  };
  inputPaginaAtual?.addEventListener("input", onPageInputChange);
  inputTotalPaginas?.addEventListener("input", onPageInputChange);

  // Botões de Passo Rápido (-1, +1, +5, +10)
  document.querySelectorAll(".btn-step").forEach(btn => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.step, 10) || 0;
      let pag = parseInt(inputPaginaAtual?.value, 10) || 0;
      pag = Math.max(0, pag + step);
      const tot = parseInt(inputTotalPaginas?.value, 10) || 0;
      if (tot > 0 && pag > tot) pag = tot;
      if (inputPaginaAtual) inputPaginaAtual.value = pag;
      atualizarProgressoVisual(pag, tot);
    });
  });

  // Salvar Progresso
  document.getElementById("btnSalvarProgresso")?.addEventListener("click", () => {
    salvarProgressoModal(false);
  });

  // Concluir Livro (100%)
  document.getElementById("btnConcluirLeitura")?.addEventListener("click", () => {
    salvarProgressoModal(true);
  });

  // Tecla Enter nos campos de progresso salva diretamente
  [inputPaginaAtual, inputTotalPaginas, inputAnotacoes].forEach(inp => {
    inp?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        salvarProgressoModal(false);
      }
    });
  });

  // Abrir no Windows
  document.getElementById("btnAbrirLeitorWindows")?.addEventListener("click", () => {
    if (state.livroSelecionado?.caminho) {
      window.api?.abrirNoWindows?.(state.livroSelecionado.caminho);
      showToast("Abrindo no leitor do Windows... Boas leituras!");
      // Registra timestamp de última leitura
      salvarProgressoModal(false);
    }
  });

  // Revelar no Explorer
  document.getElementById("btnRevelarExplorer")?.addEventListener("click", () => {
    if (state.livroSelecionado?.caminho) {
      window.api?.revelarNoExplorer?.(state.livroSelecionado.caminho);
      showToast("Arquivo destacado na pasta.");
    }
  });

  // Link do Autor
  document.getElementById("linkAutor")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.api?.openExternal?.("https://joadsonrocha.github.io/");
  });

  // Alternadores de Modo de Visualização (Normal, Compacto, Lista)
  document.querySelectorAll(".btn-view-mode").forEach(btn => {
    btn.addEventListener("click", () => {
      aplicarModoVisualizacao(btn.dataset.mode);
    });
  });
  aplicarModoVisualizacao(state.modoVisualizacao);

  // ============================================================
  // EVENTOS DE TEMA (CLARO / ESCURO)
  // ============================================================
  aplicarTema(state.tema);

  document.getElementById("btnToggleTema")?.addEventListener("click", () => {
    const proximoTema = state.tema === "light" ? "dark" : "light";
    aplicarTema(proximoTema);
    showToast(proximoTema === "light" ? "Modo Claro ativado ☀️" : "Modo Escuro ativado 🌙");
  });

  // ============================================================
  // EVENTOS DO MODAL DE CONFIGURAÇÃO DA IA (GROQ)
  // ============================================================
  document.getElementById("btnConfigIA")?.addEventListener("click", abrirModalConfigIA);
  document.getElementById("btnFecharConfigIA")?.addEventListener("click", fecharModalConfigIA);
  document.getElementById("modalConfigIA")?.addEventListener("click", (e) => {
    if (e.target.id === "modalConfigIA") fecharModalConfigIA();
  });

  document.getElementById("btnToggleShowKey")?.addEventListener("click", () => {
    const inp = document.getElementById("inputGroqKey");
    if (!inp) return;
    inp.type = inp.type === "password" ? "text" : "password";
  });

  document.getElementById("btnTestarConexaoIA")?.addEventListener("click", async () => {
    const key = document.getElementById("inputGroqKey")?.value?.trim();
    const lbl = document.getElementById("lblStatusConexao");
    if (!key) {
      if (lbl) { lbl.textContent = "⚠️ Digite uma chave para testar"; lbl.className = "status-indicator erro"; }
      return;
    }
    if (lbl) { lbl.textContent = "⏳ Conectando à Groq API..."; lbl.className = "status-indicator"; }
    const res = await window.api?.testarConexaoGroq?.(key);
    if (res?.success) {
      if (lbl) { lbl.textContent = "🟢 Conexão com Groq validada com sucesso!"; lbl.className = "status-indicator ok"; }
      showToast("Groq API conectada com sucesso!");
    } else {
      if (lbl) { lbl.textContent = `🔴 ${res?.error || "Erro de autenticação"}`; lbl.className = "status-indicator erro"; }
    }
  });

  document.getElementById("btnSalvarConfigIA")?.addEventListener("click", async () => {
    const key = document.getElementById("inputGroqKey")?.value?.trim();
    const model = document.getElementById("selectModeloIA")?.value || "qwen/qwen3.8-27b";
    const ok = await window.api?.salvarConfigIA?.({ apiKey: key, model });
    if (ok) {
      showToast("Configurações da IA salvas com segurança!");
      fecharModalConfigIA();
    } else {
      showToast("Erro ao gravar configurações.");
    }
  });

  document.getElementById("linkObterChaveGroq")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.api?.openExternal?.("https://console.groq.com/keys");
  });

  // ============================================================
  // EVENTOS DAS ABAS DO MODAL E TUTOR IA
  // ============================================================
  document.getElementById("tabBtnDetalhes")?.addEventListener("click", () => alternarTabModal("detalhes"));
  document.getElementById("tabBtnTutorIA")?.addEventListener("click", () => alternarTabModal("tutor"));

  document.getElementById("btnGerarSkillLivro")?.addEventListener("click", executarBookToSkill);
  document.getElementById("btnEnviarPerguntaChat")?.addEventListener("click", () => enviarPerguntaChat());

  document.getElementById("inputChatPergunta")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      enviarPerguntaChat();
    }
  });

  document.querySelectorAll(".chat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      enviarPerguntaChat(chip.dataset.query);
    });
  });

  // ============================================================
  // EVENTOS DO COPILOTO IA DEDICADO (WORKBENCH CHATGPT STYLE)
  // ============================================================
  document.getElementById("btnAbrirCopilotoModal")?.addEventListener("click", () => {
    if (state.livroSelecionado) {
      const livro = state.livroSelecionado;
      fecharModalLivro();
      abrirCopilotoIA(livro);
    }
  });

  document.getElementById("btnFecharCopiloto")?.addEventListener("click", fecharCopilotoIA);
  document.getElementById("modalCopilotoIA")?.addEventListener("click", (e) => {
    if (e.target.id === "modalCopilotoIA") fecharCopilotoIA();
  });

  const copilotInput = document.getElementById("copilotChatInput");
  const btnCopilotSend = document.getElementById("btnCopilotEnviar");

  if (copilotInput) {
    copilotInput.addEventListener("input", () => {
      copilotInput.style.height = "auto";
      copilotInput.style.height = Math.min(copilotInput.scrollHeight, 120) + "px";
      if (btnCopilotSend) btnCopilotSend.classList.toggle("active", copilotInput.value.trim().length > 0);
    });

    copilotInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviarPerguntaCopiloto();
      }
    });
  }

  btnCopilotSend?.addEventListener("click", () => enviarPerguntaCopiloto());

  document.querySelectorAll(".copilot-prompt-card").forEach(card => {
    card.addEventListener("click", () => {
      enviarPerguntaCopiloto(card.dataset.prompt);
    });
  });

  document.querySelectorAll(".copilot-mini-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      enviarPerguntaCopiloto(chip.dataset.prompt);
    });
  });

  document.getElementById("btnCopilotLimparChat")?.addEventListener("click", () => {
    state.chatHistorico = [];
    const heroState = document.getElementById("copilotHeroState");
    const messagesList = document.getElementById("copilotMessagesList");
    const quickChips = document.getElementById("copilotQuickChipsBar");
    if (heroState) heroState.hidden = false;
    if (messagesList) { messagesList.hidden = true; messagesList.innerHTML = ""; }
    if (quickChips) quickChips.hidden = true;
    showToast("Nova conversa iniciada!");
  });

  document.getElementById("btnCopilotIndexarObra")?.addEventListener("click", executarBookToSkillCopiloto);
  document.getElementById("btnCopilotConfigPill")?.addEventListener("click", abrirModalConfigIA);

  window.alternarAba = alternarAba;
  window.abrirPopupPasta = abrirPopupPasta;
  window.alternarSubpastas = alternarSubpastas;
  window.aplicarModoVisualizacao = aplicarModoVisualizacao;
  window.aplicarTema = aplicarTema;
  window.abrirModalConfigIA = abrirModalConfigIA;
  window.abrirCopilotoIA = abrirCopilotoIA;

  carregarBiblioteca();
});