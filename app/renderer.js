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
  chatHistorico: [],
  leitor: {
    ativo: false,
    livro: null,
    pdfDoc: null,
    paginaAtual: 1,
    totalPaginas: 1,
    paginaObj: null,
    escala: 1.2,
    renderizando: false,
    currentRenderTask: null,
    sidebarAberta: true
  }
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

        <button class="card-copilot-badge" title="Conversar com o SkillBook deste livro">
          <span class="copilot-sparkle-icon">✨</span>
          <span class="copilot-badge-text">SkillBook</span>
        </button>

        <button class="fav-btn ${isFav ? "active" : ""}" title="${isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}">
          <svg width="14" height="14" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>

        <div class="cover-hover-overlay">
          <button class="btn-cover-info" title="Ver detalhes da obra">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
          <button class="btn-cover-read" title="Abrir e ler no Windows">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Ler</span>
          </button>
          <button class="btn-cover-copilot" title="Conversar com o SkillBook deste livro">
            <span>✨</span>
            <span>SkillBook</span>
          </button>
          <button class="btn-cover-skill" title="Criar Skill deste livro (Book-to-Skill)">
            <span>⚡</span>
            <span>Criar Skill</span>
          </button>
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

    // Ação do Botão SkillBook no Card (Badge Direto e Hover)
    card.querySelector(".card-copilot-badge")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirCopilotoIA(livro);
    });

    card.querySelector(".btn-cover-copilot")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirCopilotoIA(livro);
    });

    // Ação Criar Skill Diretamente do Card (Book-to-Skill)
    card.querySelector(".btn-cover-skill")?.addEventListener("click", (e) => {
      e.stopPropagation();
      criarSkillDiretoDoCard(livro);
    });

    // Ação do Botão Flutuante de Leitura na Capa (Abre no Leitor Interno)
    card.querySelector(".btn-cover-read")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirLeitorInterno(livro);
    });

    // Ação do Botão de Detalhes na Capa
    card.querySelector(".btn-cover-info")?.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirModalLivro(livro);
    });

    // Duplo clique no Card: Abre no Leitor Interno
    card.addEventListener("dblclick", () => {
      abrirLeitorInterno(livro);
    });

    // Clique no Card: Abre o Modal de Detalhes
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn") || e.target.closest(".btn-cover-read") || e.target.closest(".btn-cover-copilot") || e.target.closest(".btn-cover-skill") || e.target.closest(".card-copilot-badge") || e.target.closest(".btn-cover-info")) return;
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

async function criarSkillDiretoDoCard(livro) {
  if (!livro) return;
  state.livroSelecionado = livro;
  await abrirCopilotoIA(livro);
  if (state.skillAtual?.temSkill) {
    showToast(`O livro "${livro.tituloHumanizado || livro.titulo}" já possui Skill modular criada!`);
  } else {
    showToast(`Iniciando Book-to-Skill para "${livro.tituloHumanizado || livro.titulo}"...`);
    executarBookToSkillCopiloto();
  }
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

function abrirModalSobre() {
  const modal = document.getElementById("modalSobre");
  if (!modal) return;
  modal.hidden = false;
  document.addEventListener("keydown", lidarTeclasModal);
}

function fecharModalSobre() {
  const modal = document.getElementById("modalSobre");
  if (modal) modal.hidden = true;
}

function lidarTeclasModal(e) {
  if (e.key === "Escape") {
    fecharModalLivro();
    fecharModalConfigIA();
    fecharCopilotoIA();
    fecharModalSobre();
    fecharLeitorInterno();
  }
}

// ============================================================================
// 5.0 LEITOR INTERNO DE PDF COM SKILLBOOK LATERAL (SPLIT-VIEW)
// ============================================================================

async function abrirLeitorInterno(livro) {
  if (!livro || !livro.caminho) return;

  const ext = (livro.extensao || "").toLowerCase();
  const isPdf = ext === ".pdf" || ext === "pdf" || livro.caminho.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    showToast(`O formato ${ext.toUpperCase() || "da obra"} abre no leitor externo do Windows.`);
    window.api?.abrirNoWindows?.(livro.caminho);
    return;
  }

  const overlay = document.getElementById("viewLeitorIntegrado");
  const loading = document.getElementById("readerPdfLoading");
  if (!overlay) return;

  fecharModalLivro();
  fecharCopilotoIA();

  const tituloLimpo = livro.tituloHumanizado || formatarTituloHumanizado(livro.titulo, livro.nome);
  const tituloEl = document.getElementById("leitorTituloLivro");
  const autorEl = document.getElementById("leitorAutorLivro");
  if (tituloEl) {
    tituloEl.textContent = tituloLimpo;
    tituloEl.title = tituloLimpo;
  }
  if (autorEl) {
    autorEl.textContent = livro.autor !== "Desconhecido" ? livro.autor : "Autor Não Informado";
  }

  overlay.hidden = false;
  if (loading) loading.hidden = false;

  state.leitor.ativo = true;
  state.leitor.livro = livro;
  state.leitor.pdfDoc = null;
  state.leitor.paginaObj = null;
  state.leitor.paginaAtual = Math.max(1, livro.progresso?.paginaAtual || 1);
  state.leitor.totalPaginas = livro.progresso?.totalPaginas || 1;
  state.leitor.escala = 1.2;

  // Atualiza indicador do modelo na barra lateral do leitor
  const cfg = await window.api?.obterConfigIA?.() || { model: "openai/gpt-oss-20b" };
  const lblModel = document.getElementById("lblReaderModeloIA");
  if (lblModel) {
    const isPro = (cfg.model || "").includes("120b") || (cfg.model || "").includes("70b");
    lblModel.textContent = isPro ? "Pro" : "Turbo";
  }

  // Carrega histórico de chat desta obra
  carregarHistoricoChatLeitor(livro.caminho, tituloLimpo);

  try {
    const buffer = await window.api?.lerArquivoBuffer?.(livro.caminho);
    if (!buffer) {
      showToast("Não foi possível carregar o arquivo PDF.");
      fecharLeitorInterno();
      return;
    }

    const pdfjs = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
    if (!pdfjs) {
      showToast("Mecanismo PDF.js indisponível.");
      fecharLeitorInterno();
      return;
    }

    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdfDoc = await loadingTask.promise;

    state.leitor.pdfDoc = pdfDoc;
    state.leitor.totalPaginas = pdfDoc.numPages;

    const totalEl = document.getElementById("leitorTotalPaginas");
    if (totalEl) totalEl.textContent = pdfDoc.numPages;

    if (state.leitor.paginaAtual > pdfDoc.numPages) {
      state.leitor.paginaAtual = 1;
    }

    await renderizarPaginaLeitor(state.leitor.paginaAtual);
    ajustarLarguraLeitor();
  } catch (err) {
    console.error("Erro ao abrir PDF no leitor interno:", err);
    showToast("Abrindo no leitor do Windows...");
    fecharLeitorInterno();
    window.api?.abrirNoWindows?.(livro.caminho);
  } finally {
    if (loading) loading.hidden = true;
  }
}

function fecharLeitorInterno() {
  const overlay = document.getElementById("viewLeitorIntegrado");
  if (overlay) overlay.hidden = true;

  if (state.leitor.currentRenderTask) {
    try { state.leitor.currentRenderTask.cancel(); } catch (e) {}
  }

  if (state.leitor.ativo && state.leitor.livro) {
    salvarProgressoLeitor(state.leitor.livro, state.leitor.paginaAtual, state.leitor.totalPaginas);
  }

  state.leitor.ativo = false;
  state.leitor.livro = null;
  state.leitor.pdfDoc = null;
  state.leitor.paginaObj = null;

  carregarBiblioteca();
}

async function renderizarPaginaLeitor(num) {
  if (!state.leitor.pdfDoc || state.leitor.renderizando) return;
  state.leitor.renderizando = true;

  const canvas = document.getElementById("readerPdfCanvas");
  const loading = document.getElementById("readerPdfLoading");
  if (loading) loading.hidden = false;

  try {
    const page = await state.leitor.pdfDoc.getPage(num);
    state.leitor.paginaAtual = num;
    state.leitor.paginaObj = page;

    const inputPag = document.getElementById("inputLeitorPagina");
    if (inputPag) inputPag.value = num;

    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: state.leitor.escala });

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
      viewport: viewport
    };

    if (state.leitor.currentRenderTask) {
      try { state.leitor.currentRenderTask.cancel(); } catch (e) {}
    }
    state.leitor.currentRenderTask = page.render(renderContext);
    await state.leitor.currentRenderTask.promise;

    const lblZoom = document.getElementById("lblLeitorZoom");
    if (lblZoom) lblZoom.textContent = `${Math.round(state.leitor.escala * 100)}%`;

    salvarProgressoLeitor(state.leitor.livro, num, state.leitor.totalPaginas);

    const viewportElem = document.getElementById("readerPdfViewport");
    if (viewportElem) viewportElem.scrollTop = 0;
  } catch (err) {
    if (err?.name !== "RenderingCancelledException") {
      console.error("Erro ao renderizar página:", err);
    }
  } finally {
    state.leitor.renderizando = false;
    if (loading) loading.hidden = true;
  }
}

function mudarPaginaLeitor(delta) {
  if (!state.leitor.pdfDoc) return;
  const nova = state.leitor.paginaAtual + delta;
  if (nova >= 1 && nova <= state.leitor.totalPaginas) {
    renderizarPaginaLeitor(nova);
  }
}

function irParaPaginaLeitor(num) {
  if (!state.leitor.pdfDoc) return;
  const pag = Math.max(1, Math.min(state.leitor.totalPaginas, parseInt(num, 10) || 1));
  renderizarPaginaLeitor(pag);
}

function ajustarZoom(delta, definirFixo) {
  if (definirFixo) {
    state.leitor.escala = Math.max(0.5, Math.min(3.0, definirFixo));
  } else {
    state.leitor.escala = Math.max(0.5, Math.min(3.0, state.leitor.escala + delta));
  }
  if (state.leitor.paginaAtual) {
    renderizarPaginaLeitor(state.leitor.paginaAtual);
  }
}

function ajustarLarguraLeitor() {
  const viewport = document.getElementById("readerPdfViewport");
  if (!viewport || !state.leitor.paginaObj) return;

  const unscaled = state.leitor.paginaObj.getViewport({ scale: 1 });
  const larguraDisponivel = viewport.clientWidth - 56;
  if (larguraDisponivel > 200 && unscaled.width > 0) {
    const novaEscala = Math.max(0.6, Math.min(2.5, larguraDisponivel / unscaled.width));
    ajustarZoom(0, novaEscala);
  }
}

function toggleSkillSidebar(forcarEstado) {
  const sidebar = document.getElementById("readerSkillSidebar");
  const overlay = document.getElementById("viewLeitorIntegrado");
  const btnToggle = document.getElementById("btnToggleSkillSidebar");
  if (!sidebar) return;

  const novoEstado = forcarEstado !== undefined ? forcarEstado : !state.leitor.sidebarAberta;
  state.leitor.sidebarAberta = novoEstado;

  if (novoEstado) {
    sidebar.classList.remove("collapsed");
    overlay?.classList.remove("sidebar-fechada");
    btnToggle?.classList.add("active");
  } else {
    sidebar.classList.add("collapsed");
    overlay?.classList.add("sidebar-fechada");
    btnToggle?.classList.remove("active");
  }
}

async function salvarProgressoLeitor(livro, paginaAtual, totalPaginas) {
  if (!livro || !livro.caminho) return;
  const porcentagem = totalPaginas > 0 ? Math.round((paginaAtual / totalPaginas) * 100) : 0;
  const dados = {
    paginaAtual,
    totalPaginas,
    porcentagem,
    anotacoes: livro.progresso?.anotacoes || ""
  };
  const resultado = await window.api?.salvarProgressoLeitura?.(livro.caminho, dados);
  if (resultado) {
    livro.progresso = resultado;
    const idx = state.todosLivros.findIndex(l => l.caminho === livro.caminho);
    if (idx !== -1) state.todosLivros[idx].progresso = resultado;
  }
}

function carregarHistoricoChatLeitor(caminhoLivro, tituloObra) {
  const feed = document.getElementById("readerChatFeed");
  if (!feed) return;

  const historico = carregarHistoricoChatStorage(caminhoLivro);
  if (historico && historico.length > 0) {
    feed.innerHTML = "";
    historico.forEach(msg => {
      const el = document.createElement("div");
      el.className = `copilot-msg ${msg.role === "user" ? "usuario" : "assistente"}`;
      el.innerHTML = `
        <div class="copilot-avatar">${msg.role === "user" ? "👤" : "✨"}</div>
        <div class="copilot-msg-content">${formatarMarkdownSimples(msg.content)}</div>
      `;
      feed.appendChild(el);
    });
    feed.scrollTop = feed.scrollHeight;
  } else {
    feed.innerHTML = `
      <div class="copilot-msg assistente">
        <div class="copilot-avatar">✨</div>
        <div class="copilot-msg-content">
          <p>Olá! Sou o <strong>SkillBook</strong>, acompanhando sua leitura de <em>${tituloObra}</em>.</p>
          <p>Estou conectado a cada página desta obra. Pergunte qualquer dúvida sobre o que está lendo ou clique nos atalhos acima para análises instantâneas!</p>
        </div>
      </div>
    `;
  }
}

async function enviarPerguntaChatLeitor(perguntaManual, contextoManual) {
  const input = document.getElementById("inputReaderChat");
  const feed = document.getElementById("readerChatFeed");
  const pergunta = (perguntaManual || input?.value || "").trim();
  if (!pergunta || !state.leitor.livro) return;

  if (input && !perguntaManual) input.value = "";

  if (!state.leitor.sidebarAberta) {
    toggleSkillSidebar(true);
  }

  // Extrai o texto da página corrente para contextualizar o SkillBook
  let contexto = contextoManual;
  if (!contexto && state.leitor.paginaObj) {
    try {
      const textContent = await state.leitor.paginaObj.getTextContent();
      const txt = textContent.items.map(item => item.str).join(" ").trim();
      if (txt.length > 20) {
        contexto = `Página atual do leitor: ${state.leitor.paginaAtual} de ${state.leitor.totalPaginas}\nTrecho da página:\n"${txt.slice(0, 3500)}"`;
      }
    } catch (e) {
      console.warn("Falha ao extrair texto da página atual:", e);
    }
  }

  // Renderiza pergunta do usuário no feed
  if (feed) {
    const userMsg = document.createElement("div");
    userMsg.className = "copilot-msg usuario";
    userMsg.innerHTML = `
      <div class="copilot-avatar">👤</div>
      <div class="copilot-msg-content">${formatarMarkdownSimples(pergunta)}</div>
    `;
    feed.appendChild(userMsg);

    const loadingMsg = document.createElement("div");
    loadingMsg.className = "copilot-msg assistente loading-msg";
    loadingMsg.innerHTML = `
      <div class="copilot-avatar">✨</div>
      <div class="copilot-msg-content"><span class="copilot-typing">Consultando o SkillBook na pág. ${state.leitor.paginaAtual}...</span></div>
    `;
    feed.appendChild(loadingMsg);
    feed.scrollTop = feed.scrollHeight;

    const cfg = await window.api?.obterConfigIA?.() || { model: "openai/gpt-oss-20b" };
    const historicoAtual = carregarHistoricoChatStorage(state.leitor.livro.caminho) || [];

    const res = await window.api?.perguntarGroq?.({
      pergunta,
      contexto: contexto || `Leitura em andamento: Página ${state.leitor.paginaAtual} de ${state.leitor.totalPaginas}`,
      historico: historicoAtual,
      modelo: cfg.model || "openai/gpt-oss-20b"
    });

    loadingMsg.remove();

    if (res?.success && res.resposta) {
      const respMsg = document.createElement("div");
      respMsg.className = "copilot-msg assistente";
      respMsg.innerHTML = `
        <div class="copilot-avatar">✨</div>
        <div class="copilot-msg-content">${formatarMarkdownSimples(res.resposta)}</div>
      `;
      feed.appendChild(respMsg);

      historicoAtual.push({ role: "user", content: pergunta });
      historicoAtual.push({ role: "assistant", content: res.resposta });
      salvarHistoricoChatStorage(state.leitor.livro.caminho, historicoAtual);
    } else {
      const errMsg = document.createElement("div");
      errMsg.className = "copilot-msg assistente";
      errMsg.innerHTML = `
        <div class="copilot-avatar">⚠️</div>
        <div class="copilot-msg-content"><p style="color: #fb7185;">${res?.error || "Não foi possível obter resposta do SkillBook."}</p></div>
      `;
      feed.appendChild(errMsg);
    }

    feed.scrollTop = feed.scrollHeight;
  }
}

async function explicarPaginaAtual() {
  if (!state.leitor.paginaObj) return;
  try {
    const textContent = await state.leitor.paginaObj.getTextContent();
    const textoPagina = textContent.items.map(item => item.str).join(" ").trim();
    const prompt = `Explique de maneira didática, rica e analítica o conteúdo da Página ${state.leitor.paginaAtual} desta obra. Destaque os pontos cruciais e como o leitor deve interpretar este trecho.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA PÁGINA ${state.leitor.paginaAtual}:\n"${textoPagina}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Explique o que é abordado na página ${state.leitor.paginaAtual} deste livro.`);
  }
}

async function resumirPaginaAtual() {
  if (!state.leitor.paginaObj) return;
  try {
    const textContent = await state.leitor.paginaObj.getTextContent();
    const textoPagina = textContent.items.map(item => item.str).join(" ").trim();
    const prompt = `Faça um resumo executivo com as melhores lições, regras práticas e ideias essenciais da Página ${state.leitor.paginaAtual}.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA PÁGINA ${state.leitor.paginaAtual}:\n"${textoPagina}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Faça um resumo dos principais pontos da página ${state.leitor.paginaAtual}.`);
  }
}

async function extrairConceitosPaginaAtual() {
  if (!state.leitor.paginaObj) return;
  try {
    const textContent = await state.leitor.paginaObj.getTextContent();
    const textoPagina = textContent.items.map(item => item.str).join(" ").trim();
    const prompt = `Quais são os conceitos fundamentais, princípios ou termos técnicos apresentados na Página ${state.leitor.paginaAtual}? Elenque cada um com uma definição direta.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA PÁGINA ${state.leitor.paginaAtual}:\n"${textoPagina}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Quais são os conceitos centrais da página ${state.leitor.paginaAtual}?`);
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

  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "openai/gpt-oss-20b", isBundled: false };
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

  if (selectModel) selectModel.value = cfg.model || "openai/gpt-oss-20b";

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
          <p>Olá! Eu sou seu <strong>Tutor de Leitura</strong> da obra <em>${nomeObra}</em> alimentado pelo SkillBook. Pergunte qualquer dúvida sobre os conceitos, regras práticas ou peça resumos desta obra!</p>
        </div>
      </div>
    `;
  }

  // Verifica se o livro já possui Skill gerada
  const skillInfo = await window.api?.obterSkillLivro?.(state.livroSelecionado.caminho);
  const btnExportar = document.getElementById("btnExportarSkillDetalhes");
  const btnAbrirPasta = document.getElementById("btnAbrirPastaSkill");

  if (skillInfo?.temSkill) {
    state.skillAtual = skillInfo;
    if (lblTitulo) lblTitulo.textContent = "⚡ Skill de IA Ativa (Conhecimento Destilado)";
    if (lblDesc) lblDesc.textContent = "O conteúdo desta obra está indexado em formato modular para respostas imediatas e precisas.";
    if (btnGerar) btnGerar.textContent = "🔄 Re-destilar Livro";
    if (btnExportar) btnExportar.hidden = false;
    if (btnAbrirPasta) btnAbrirPasta.hidden = false;
  } else {
    state.skillAtual = null;
    if (lblTitulo) lblTitulo.textContent = "⚡ Skill de IA Não Gerada";
    if (lblDesc) lblDesc.textContent = "Destile os capítulos desta obra em uma Skill modular para respostas instantâneas sem alucinações.";
    if (btnGerar) btnGerar.textContent = "⚡ Gerar Skill do Livro";
    if (btnExportar) btnExportar.hidden = true;
    if (btnAbrirPasta) btnAbrirPasta.hidden = true;
  }
}

async function executarBookToSkill() {
  if (!state.livroSelecionado) return;
  const cfg = await window.api?.obterConfigIA?.();
  if (!cfg?.apiKey) {
    showToast("Configure sua chave de API no botão ⚡ SkillBook antes de gerar a skill.");
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

    if (lblDesc) lblDesc.textContent = "Sintetizando Skill com modelos mentais via SkillBook...";
    if (progressFill) progressFill.style.width = "75%";

    const promptSkill = `Você é um gerador de Agent Skills (padrão SKILL.md).
Analise os dados e trechos da seguinte obra para gerar a documentação modular:
Obra: "${titulo}"
Autor: "${state.livroSelecionado.autor || "Desconhecido"}"
Trechos da obra:
${textoAmostra.slice(0, 12000)}

Gere 3 seções estruturadas rigorosamente no formato abaixo:

===SKILL.MD===
---
name: "${titulo}"
description: "Modelos mentais, princípios fundamentais e regras práticas da obra ${titulo}."
---
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
      modelo: cfg.model || "openai/gpt-oss-20b"
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
      throw new Error(resIA?.error || "Falha ao sintetizar com o SkillBook.");
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
    showToast("Configure sua chave de API no botão ⚡ SkillBook.");
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

async function abrirCopilotoIA(livro) {
  if (!livro) return;
  state.livroSelecionado = livro;

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
  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "openai/gpt-oss-20b" };
  if (modelName) {
    const isPro = (cfg.model || "").includes("120b") || (cfg.model || "").includes("70b");
    modelName.textContent = isPro ? "SkillBook Pro" : "SkillBook Turbo";
  }

  // Verifica se o livro já possui Skill gerada
  const skillInfo = await window.api?.obterSkillLivro?.(livro.caminho);
  const btnExportarCopilot = document.getElementById("btnCopilotExportarSkill");
  const heroIndexBanner = document.getElementById("copilotHeroIndexBanner");
  const heroExportBanner = document.getElementById("copilotHeroExportBanner");

  if (skillInfo?.temSkill) {
    state.skillAtual = skillInfo;
    if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot"></span> Obra Indexada (30 págs)`;
    if (btnIndexar) btnIndexar.textContent = "Reindexar";
    if (btnExportarCopilot) btnExportarCopilot.hidden = false;
    if (heroIndexBanner) heroIndexBanner.hidden = true;
    if (heroExportBanner) heroExportBanner.hidden = false;
  } else {
    state.skillAtual = null;
    if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot" style="background:#e5a93b;box-shadow:0 0 6px #e5a93b;"></span> Obra Conectada`;
    if (btnIndexar) btnIndexar.textContent = "Criar Skill";
    if (btnExportarCopilot) btnExportarCopilot.hidden = true;
    if (heroIndexBanner) heroIndexBanner.hidden = false;
    if (heroExportBanner) heroExportBanner.hidden = true;
  }

  // Carrega histórico salvo desta obra
  const historicoSalvo = obterHistoricoChatStorage(livro.caminho);
  state.chatHistorico = historicoSalvo;

  const heroState = document.getElementById("copilotHeroState");
  const messagesList = document.getElementById("copilotMessagesList");
  const quickChips = document.getElementById("copilotQuickChipsBar");
  const input = document.getElementById("copilotChatInput");
  const chatFeed = document.getElementById("copilotChatFeed");

  if (historicoSalvo && historicoSalvo.length > 0) {
    if (heroState) heroState.hidden = true;
    if (messagesList) {
      messagesList.hidden = false;
      messagesList.innerHTML = "";
      historicoSalvo.forEach(msg => {
        if (msg.role === "user") {
          const userRow = document.createElement("div");
          userRow.className = "copilot-msg-row user";
          userRow.innerHTML = `
            <div class="copilot-msg-bubble">
              <p>${(msg.content || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
            </div>
            <div class="copilot-msg-avatar">👤</div>
          `;
          messagesList.appendChild(userRow);
        } else {
          const assistantRow = document.createElement("div");
          assistantRow.className = "copilot-msg-row assistant";
          const formattedHtml = formatarMarkdownSimples(msg.content || "");
          assistantRow.innerHTML = `
            <div class="copilot-msg-avatar">✨</div>
            <div class="copilot-msg-bubble">
              <div class="copilot-msg-content">${formattedHtml}</div>
              <div class="copilot-msg-actions">
                <button type="button" class="btn-msg-copy" title="Copiar resposta">
                  <span>📋</span> <span>Copiar</span>
                </button>
              </div>
            </div>
          `;
          assistantRow.querySelector(".btn-msg-copy")?.addEventListener("click", () => {
            navigator.clipboard.writeText(msg.content || "");
            showToast("Resposta copiada para a área de transferência!");
          });
          messagesList.appendChild(assistantRow);
        }
      });
    }
    if (quickChips) quickChips.hidden = false;
    setTimeout(() => {
      if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
    }, 60);
  } else {
    if (heroState) heroState.hidden = false;
    if (messagesList) {
      messagesList.hidden = true;
      messagesList.innerHTML = "";
    }
    if (quickChips) quickChips.hidden = true;
  }

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
    showToast("Configure sua chave de API no botão ⚡ SkillBook.");
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
    const tit = state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo || state.livroSelecionado.nome;
    const aut = state.livroSelecionado.autor !== "Desconhecido" ? state.livroSelecionado.autor : "Autor consagrado da obra";
    contexto = `Obra: ${tit}\nAutor: ${aut}\nFormato: ${state.livroSelecionado.extensao}\nInstrução: Entregue uma síntese executiva rica, técnica e completa sobre esta obra consagrada, explicando seus princípios fundamentais, métodos e aplicações práticas.`;
  }

  const res = await window.api?.perguntarGroq?.({
    pergunta,
    contexto,
    historico: state.chatHistorico
  });

  if (res?.success && res.resposta) {
    state.chatHistorico.push({ role: "assistant", content: res.resposta });
    salvarHistoricoChatStorage(state.livroSelecionado?.caminho, state.chatHistorico);
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
    showToast("Configure sua chave de API no botão ⚡ SkillBook antes de indexar.");
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
    if (progressText) progressText.textContent = "Destilando conhecimento modular com o SkillBook...";

    const promptDestilacao = `Você é o compilador da arquitetura book-to-skill para a obra "${titulo}".
Gere uma destilação modular técnica e profunda nos 3 blocos abaixo rigorosamente separados:

===SKILL.MD===
---
name: "${titulo}"
description: "Modelos mentais, princípios fundamentais e regras práticas da obra ${titulo}."
---
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
      modelo: cfg.model || "openai/gpt-oss-20b"
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
      showToast("Skill criada com sucesso pelo SkillBook!");
      state.skillAtual = { temSkill: true, skillMd, cheatsheet, glossary };
      if (badgeStatus) badgeStatus.innerHTML = `<span class="live-dot"></span> Obra Indexada (30 págs)`;
      if (btnIndexar) btnIndexar.textContent = "Reindexar";
      const btnExp = document.getElementById("btnCopilotExportarSkill");
      if (btnExp) btnExp.hidden = false;

      const heroIndexBanner = document.getElementById("copilotHeroIndexBanner");
      const heroExportBanner = document.getElementById("copilotHeroExportBanner");
      if (heroIndexBanner) heroIndexBanner.hidden = true;
      if (heroExportBanner) heroExportBanner.hidden = false;

      const messagesList = document.getElementById("copilotMessagesList");
      if (messagesList && !messagesList.hidden) {
        const exportPromptRow = document.createElement("div");
        exportPromptRow.className = "copilot-msg-row assistant";
        exportPromptRow.innerHTML = `
          <div class="copilot-msg-avatar">📦</div>
          <div class="copilot-msg-bubble" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div>
                <strong style="color: #10b981; font-size: 0.86rem; display: block;">🎉 Skill destilada com sucesso!</strong>
                <span style="font-size: 0.74rem; color: var(--text-secondary);">SKILL.md, cheatsheet.md e glossary.md gerados no formato oficial.</span>
              </div>
              <button type="button" class="btn-hero-action export btn-msg-export-now" style="font-size: 0.74rem; padding: 6px 14px;">
                <span>📦 Exportar Agora</span>
              </button>
            </div>
          </div>
        `;
        exportPromptRow.querySelector(".btn-msg-export-now")?.addEventListener("click", exportarSkillAtual);
        messagesList.appendChild(exportPromptRow);
        const chatFeed = document.getElementById("copilotChatFeed");
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      }
    } else {
      throw new Error(resIA?.error || "Falha ao sintetizar com o SkillBook.");
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
    btn?.setAttribute("title", "Adicionar aos Favoritos");
    showToast("Removido dos Favoritos.");
  } else {
    state.favoritos.add(caminho);
    btn?.classList.add("active");
    btn?.setAttribute("title", "Remover dos Favoritos");
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

async function abrirPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = false;

  const section = document.getElementById("cloudDriveSection");
  const chipsContainer = document.getElementById("cloudDriveChips");

  if (section && chipsContainer && window.api?.detectarLocaisDrive) {
    try {
      const locais = await window.api.detectarLocaisDrive();
      if (locais && locais.length > 0) {
        chipsContainer.innerHTML = "";
        locais.forEach(loc => {
          const chip = document.createElement("button");
          chip.className = "cloud-drive-chip";
          chip.type = "button";
          chip.title = loc.caminho;
          chip.innerHTML = `
            <span class="chip-icon">${loc.icone || "☁️"}</span>
            <span class="chip-name">${loc.nome}</span>
          `;
          chip.addEventListener("click", async () => {
            fecharPopupPasta();
            fecharMenu();
            const pastaDefinida = await window.api?.definirPastaDireta?.(loc.caminho);
            if (pastaDefinida) {
              state.pastaAtual = pastaDefinida;
              showToast(`Conectado a ${loc.nome}!`);
              carregarBiblioteca();
            }
          });
          chipsContainer.appendChild(chip);
        });
        section.hidden = false;
      } else {
        section.hidden = true;
      }
    } catch (err) {
      console.warn("Falha ao detectar unidades de nuvem:", err);
      section.hidden = true;
    }
  }
}

function fecharPopupPasta() {
  const popup = document.getElementById("popupPasta");
  if (popup) popup.hidden = true;
}

// ============================================================
// 8. INICIALIZAÇÃO
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Atalho para recarregar a interface em desenvolvimento
  window.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
      window.location.reload();
    }
  });

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
    else if (action === "config-ia") { fecharMenu(); abrirModalConfigIA(); }
    else if (action === "trocar-pasta") { acaoTrocarPasta(); }
    else if (action === "recarregar") { fecharMenu(); carregarBiblioteca(); showToast("Biblioteca recarregada!"); }
    else if (action === "toggle-recursivo") { fecharMenu(); alternarSubpastas(); }
    else if (action === "sobre") { fecharMenu(); abrirModalSobre(); }
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

  // Abrir no Leitor Interno (com SkillBook)
  document.getElementById("btnAbrirLeitorInterno")?.addEventListener("click", () => {
    if (state.livroSelecionado) {
      const l = state.livroSelecionado;
      abrirLeitorInterno(l);
    }
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
    if (lbl) { lbl.textContent = "⏳ Conectando à API do SkillBook..."; lbl.className = "status-indicator"; }
    const res = await window.api?.testarConexaoGroq?.(key);
    if (res?.success) {
      if (lbl) { lbl.textContent = "🟢 Conexão com SkillBook validada com sucesso!"; lbl.className = "status-indicator ok"; }
      showToast("SkillBook conectado com sucesso!");
    } else {
      if (lbl) { lbl.textContent = `🔴 ${res?.error || "Erro de autenticação"}`; lbl.className = "status-indicator erro"; }
    }
  });

  document.getElementById("btnSalvarConfigIA")?.addEventListener("click", async () => {
    const key = document.getElementById("inputGroqKey")?.value?.trim();
    const model = document.getElementById("selectModeloIA")?.value || "openai/gpt-oss-20b";
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
    limparHistoricoChatStorage(state.livroSelecionado?.caminho);
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

  // Ações de Exportação Fácil da Skill
  const exportarSkillAtual = async () => {
    if (!state.livroSelecionado) {
      showToast("Selecione uma obra primeiro.");
      return;
    }
    const titulo = state.livroSelecionado.tituloHumanizado || state.livroSelecionado.titulo || state.livroSelecionado.nome;
    showToast(`Escolha a pasta de destino para a Skill...`);
    const res = await window.api?.exportarSkillLivro?.({
      caminho: state.livroSelecionado.caminho,
      titulo
    });
    if (res?.success) {
      showToast("Skill exportada com sucesso! Pasta aberta no Explorer.");
    } else if (!res?.canceled) {
      showToast(res?.error || "Erro ao exportar Skill.");
    }
  };

  const abrirPastaSkillAtual = async () => {
    if (!state.livroSelecionado) return;
    const ok = await window.api?.abrirPastaSkill?.(state.livroSelecionado.caminho);
    if (!ok) {
      showToast("A pasta da Skill ainda não foi criada.");
    }
  };

  document.getElementById("btnCopilotExportarSkill")?.addEventListener("click", exportarSkillAtual);
  document.getElementById("btnExportarSkillDetalhes")?.addEventListener("click", exportarSkillAtual);
  document.getElementById("btnAbrirPastaSkill")?.addEventListener("click", abrirPastaSkillAtual);
  document.getElementById("btnHeroCriarSkill")?.addEventListener("click", executarBookToSkillCopiloto);
  document.getElementById("btnHeroExportarSkill")?.addEventListener("click", exportarSkillAtual);

  // ============================================================
  // EVENTOS DO LEITOR INTERNO DE PDF COM SKILLBOOK LATERAL
  // ============================================================
  document.getElementById("btnFecharLeitor")?.addEventListener("click", fecharLeitorInterno);
  document.getElementById("btnLeitorPagAnterior")?.addEventListener("click", () => mudarPaginaLeitor(-1));
  document.getElementById("btnLeitorPagProxima")?.addEventListener("click", () => mudarPaginaLeitor(1));
  document.getElementById("btnFloatPagAnterior")?.addEventListener("click", () => mudarPaginaLeitor(-1));
  document.getElementById("btnFloatPagProxima")?.addEventListener("click", () => mudarPaginaLeitor(1));

  document.getElementById("inputLeitorPagina")?.addEventListener("change", (e) => {
    irParaPaginaLeitor(e.target.value);
  });

  document.getElementById("inputLeitorPagina")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      irParaPaginaLeitor(e.target.value);
    }
  });

  document.getElementById("btnLeitorZoomMenos")?.addEventListener("click", () => ajustarZoom(-0.15));
  document.getElementById("btnLeitorZoomMais")?.addEventListener("click", () => ajustarZoom(0.15));
  document.getElementById("btnLeitorAjustarLargura")?.addEventListener("click", ajustarLarguraLeitor);

  document.getElementById("btnToggleSkillSidebar")?.addEventListener("click", () => toggleSkillSidebar());
  document.getElementById("btnFecharSkillSidebar")?.addEventListener("click", () => toggleSkillSidebar(false));

  document.getElementById("btnQuickExplicarPagina")?.addEventListener("click", explicarPaginaAtual);
  document.getElementById("btnQuickResumirPagina")?.addEventListener("click", resumirPaginaAtual);
  document.getElementById("btnQuickConceitosChave")?.addEventListener("click", extrairConceitosPaginaAtual);

  document.getElementById("btnEnviarReaderChat")?.addEventListener("click", () => enviarPerguntaChatLeitor());
  document.getElementById("inputReaderChat")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarPerguntaChatLeitor();
    }
  });

  // Atalhos de teclado no Leitor Interno
  window.addEventListener("keydown", (e) => {
    if (!state.leitor.ativo) return;

    // Não intercepta digitação nos campos de texto
    const tag = document.activeElement?.tagName;
    if (tag === "TEXTAREA" || (tag === "INPUT" && document.activeElement.id === "inputReaderChat")) {
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      fecharLeitorInterno();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      mudarPaginaLeitor(-1);
    } else if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && tag !== "INPUT")) {
      e.preventDefault();
      mudarPaginaLeitor(1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSkillSidebar();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      ajustarZoom(0.15);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
      e.preventDefault();
      ajustarZoom(-0.15);
    } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
      e.preventDefault();
      ajustarZoom(0, 1.2);
    }
  });

  // ============================================================
  // EVENTOS DO MODAL SOBRE O EBOOKFINDER
  // ============================================================
  document.getElementById("btnFecharSobre")?.addEventListener("click", fecharModalSobre);
  document.getElementById("btnFecharSobreFooter")?.addEventListener("click", fecharModalSobre);
  document.getElementById("modalSobre")?.addEventListener("click", (e) => {
    if (e.target.id === "modalSobre") fecharModalSobre();
  });

  document.getElementById("linkDevSite")?.addEventListener("click", () => {
    window.api?.openExternal?.("https://joadsonrocha.github.io/");
  });

  document.getElementById("linkBookToSkillRepo")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.api?.openExternal?.("https://github.com/virgiliojr94/book-to-skill");
  });

  document.getElementById("btnSobreConfigIA")?.addEventListener("click", () => {
    fecharModalSobre();
    abrirModalConfigIA();
  });

  // Abrir Sobre pelo logo do topo e tag de licença do rodapé
  document.getElementById("logoApp")?.addEventListener("click", abrirModalSobre);
  document.querySelector(".license-tag")?.addEventListener("click", abrirModalSobre);

  window.alternarAba = alternarAba;
  window.abrirPopupPasta = abrirPopupPasta;
  window.alternarSubpastas = alternarSubpastas;
  window.aplicarModoVisualizacao = aplicarModoVisualizacao;
  window.aplicarTema = aplicarTema;
  window.abrirModalConfigIA = abrirModalConfigIA;
  window.abrirCopilotoIA = abrirCopilotoIA;
  window.abrirSkillBook = abrirCopilotoIA;
  window.abrirLeitorInterno = abrirLeitorInterno;
  window.fecharLeitorInterno = fecharLeitorInterno;
  window.abrirModalSobre = abrirModalSobre;
  window.fecharModalSobre = fecharModalSobre;
  window.criarSkillDiretoDoCard = criarSkillDiretoDoCard;

  carregarBiblioteca();
});