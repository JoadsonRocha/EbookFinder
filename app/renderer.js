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
  buscaRecursiva: false,
  favoritos: new Set(JSON.parse(localStorage.getItem("ef_favoritos") || "[]")),
  livroSelecionado: null
};

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
    state.todosLivros = Array.isArray(livros) ? livros : [];

    aplicarFiltrosEOrdenacao();
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

  // 2. Busca por Título ou Autor
  const termo = state.termoBusca.trim().toLowerCase();
  if (termo) {
    lista = lista.filter(l => 
      (l.titulo && l.titulo.toLowerCase().includes(termo)) ||
      (l.autor && l.autor.toLowerCase().includes(termo)) ||
      (l.nome && l.nome.toLowerCase().includes(termo))
    );
  }

  // 3. Ordenação
  lista.sort((a, b) => {
    switch (state.ordenacaoAtual) {
      case "titulo-desc":
        return (b.titulo || b.nome).localeCompare(a.titulo || a.nome, undefined, { numeric: true });
      case "autor-asc":
        return (a.autor || "").localeCompare(b.autor || "");
      case "data-desc":
        return (b.modificadoEm || 0) - (a.modificadoEm || 0);
      case "tamanho-desc":
        return (b.tamanho || 0) - (a.tamanho || 0);
      case "titulo-asc":
      default:
        return (a.titulo || a.nome).localeCompare(b.titulo || b.nome, undefined, { numeric: true });
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

    if (state.abaAtiva === "favoritos") {
      tituloVazio = "Nenhum livro favoritado";
      descVazio = "Clique na estrela de qualquer livro para salvar na sua lista de favoritos.";
    } else if (state.abaAtiva === "lendo") {
      tituloVazio = "Nenhuma leitura em andamento";
      descVazio = "Abra um livro e marque seu status como 'Lendo' para acompanhar seu progresso.";
    }

    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3 class="empty-title">${tituloVazio}</h3>
        <p class="empty-desc">${descVazio}</p>
        <button class="btn-empty-action" onclick="alternarAba('todos')">Ver Todos os Livros</button>
      </div>
    `;
    return;
  }

  lista.forEach(livro => {
    const card = document.createElement("div");
    card.className = "book-card";

    const isFav = state.favoritos.has(livro.caminho);
    const formato = (livro.extensao || "").replace(".", "").toUpperCase();
    const tamanho = formatarTamanho(livro.tamanho);

    // Label do status de leitura
    let statusBadge = "";
    if (livro.status === "lendo") {
      statusBadge = `<span class="badge-reading-status lendo">📖 Lendo</span>`;
    } else if (livro.status === "concluidos") {
      statusBadge = `<span class="badge-reading-status concluidos">✅ Concluído</span>`;
    } else if (livro.status === "quero-ler") {
      statusBadge = `<span class="badge-reading-status quero-ler">📌 Quero Ler</span>`;
    }

    // Capa ou Fallback
    const capaConteudo = livro.thumbnail
      ? `<img class="book-cover-image" src="${livro.thumbnail}" alt="${livro.titulo}" loading="lazy" />`
      : `
        <div class="book-cover-fallback">
          <div class="fallback-book-header">
            <span style="font-size:0.7rem; letter-spacing:1px; color:#e5a93b; font-weight:700;">${formato}</span>
          </div>
          <h4 class="fallback-book-title">${livro.titulo}</h4>
          <p class="fallback-book-author">${livro.autor !== "Desconhecido" ? livro.autor : ""}</p>
          <div class="fallback-book-footer">📖</div>
        </div>
      `;

    // Progresso de Leitura no Card
    const prog = livro.progresso || { paginaAtual: 0, totalPaginas: 0, porcentagem: 0 };
    const paginaAtual = prog.paginaAtual || 0;
    const totalPaginas = prog.totalPaginas || 0;
    const porcentagem = totalPaginas > 0
      ? Math.min(100, Math.round((paginaAtual / totalPaginas) * 100))
      : (prog.porcentagem || 0);

    let progressHtml = "";
    if (paginaAtual > 0 || totalPaginas > 0) {
      const isConcluido = porcentagem >= 100;
      progressHtml = `
        <div class="card-reading-progress" title="Página ${paginaAtual}${totalPaginas ? ` de ${totalPaginas}` : ''} (${porcentagem}%)">
          <div class="card-progress-bar-bg">
            <div class="card-progress-bar-fill ${isConcluido ? 'concluido' : ''}" style="width: ${porcentagem}%"></div>
          </div>
          <div class="card-progress-info">
            <span>Pág. ${paginaAtual}${totalPaginas ? ` / ${totalPaginas}` : ''}</span>
            <span class="card-progress-pct">${porcentagem}%</span>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? "#e5a93b" : "rgba(255,255,255,0.7)"}">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </div>

      <div class="book-card-body">
        <h3 class="book-title" title="${livro.titulo}">${livro.titulo}</h3>
        <p class="book-author" title="${livro.autor}">${livro.autor}</p>
        <div class="book-meta">
          <span>${formato}</span>
          <span>${tamanho}</span>
        </div>
        ${progressHtml}
      </div>
    `;

    // Clique no Card: Abre o Modal de Detalhes
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-btn")) return;
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
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📁</div>
      <h3 class="empty-title">Nenhuma pasta selecionada</h3>
      <p class="empty-desc">Escolha a pasta do seu computador onde seus e-books (.epub, .pdf, etc.) estão localizados.</p>
      <button class="btn-empty-action" onclick="abrirPopupPasta()">Selecionar Pasta Agora</button>
    </div>
  `;
}

// ============================================================
// 5. MODAL DE DETALHES DO LIVRO
// ============================================================

function abrirModalLivro(livro) {
  const modal = document.getElementById("modalLivro");
  if (!modal) return;

  state.livroSelecionado = livro;

  document.getElementById("modalTitulo").textContent = livro.titulo;
  document.getElementById("modalAutor").textContent = livro.autor || "Autor Desconhecido";
  document.getElementById("modalBadgeFormato").textContent = (livro.extensao || "").replace(".", "").toUpperCase();

  const specs = document.getElementById("modalSpecs");
  if (specs) {
    specs.innerHTML = `
      <p><strong>Formato:</strong> ${(livro.extensao || "").toUpperCase()}</p>
      <p><strong>Tamanho:</strong> ${formatarTamanho(livro.tamanho)}</p>
      <p><strong>Caminho:</strong> <span style="font-size:0.75rem; word-break:break-all; color:#aba5cd;">${livro.caminho}</span></p>
    `;
  }

  const coverContainer = document.getElementById("modalCapaContainer");
  if (coverContainer) {
    if (livro.thumbnail) {
      coverContainer.innerHTML = `<img src="${livro.thumbnail}" alt="${livro.titulo}">`;
    } else {
      coverContainer.innerHTML = `
        <div class="book-cover-fallback" style="height:100%;">
          <h4 class="fallback-book-title">${livro.titulo}</h4>
          <p class="fallback-book-author">${livro.autor}</p>
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

  // Troca de Pasta
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

  document.getElementById("btnTrocarPastaHeader")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("currentPathInfo")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("popupSelecionar")?.addEventListener("click", acaoTrocarPasta);
  document.getElementById("popupCancelar")?.addEventListener("click", fecharPopupPasta);

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
    else if (action === "toggle-recursivo") {
      state.buscaRecursiva = !state.buscaRecursiva;
      const lbl = document.getElementById("lblRecursivo");
      if (lbl) lbl.textContent = state.buscaRecursiva ? "Ativado" : "Desativado";
      showToast(state.buscaRecursiva ? "Subpastas ativadas." : "Subpastas desativadas.");
      carregarBiblioteca();
    }
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

  window.alternarAba = alternarAba;
  window.abrirPopupPasta = abrirPopupPasta;

  carregarBiblioteca();
});