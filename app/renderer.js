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
  livroSelecionado: null
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
      if (e.target.closest(".fav-btn") || e.target.closest(".btn-cover-read") || e.target.closest(".btn-cover-info")) return;
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
  if (e.key === "Escape") fecharModalLivro();
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

  window.alternarAba = alternarAba;
  window.abrirPopupPasta = abrirPopupPasta;
  window.alternarSubpastas = alternarSubpastas;
  window.aplicarModoVisualizacao = aplicarModoVisualizacao;

  carregarBiblioteca();
});