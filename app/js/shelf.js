/**
 * EbookFinder — Módulo da Estante e Grid de Livros
 */
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
    if (typeof caminhoCache === "string" && caminhoCache.length > 15 && caminhoCache !== "true") {
      return caminhoCache;
    }
    return dataUrl;
  } catch (err) {
    console.error("Falha ao renderizar capa do PDF:", livro.caminho, err);
    return null;
  }
}

/**
 * Atualiza o elemento no DOM em tempo real com fade-in suave assim que a capa é extraída.
 */
function atualizarCapaNoDom(caminho, thumbUrl, titulo) {
  if (typeof thumbUrl !== "string" || !thumbUrl || thumbUrl === "true" || thumbUrl === "false" || thumbUrl.length < 15) {
    return;
  }
  const card = document.querySelector(`.book-card[data-caminho="${CSS.escape(caminho)}"]`);
  if (card) {
    const wrapper = card.querySelector(".book-cover-wrapper");
    if (wrapper) {
      const fallback = wrapper.querySelector(".book-cover-fallback");

      let img = wrapper.querySelector(".book-cover-image");
      if (!img) {
        img = document.createElement("img");
        img.className = "book-cover-image cover-fade-in";
        img.alt = titulo;
        img.loading = "lazy";
        img.onerror = () => {
          img.remove();
          if (fallback) fallback.style.display = "";
        };
        wrapper.prepend(img);
      }
      img.src = thumbUrl;
      if (fallback) fallback.style.display = "none";
    }
  }

  if (state.livroSelecionado && state.livroSelecionado.caminho === caminho) {
    const modalCapa = document.getElementById("modalCapaContainer");
    if (modalCapa) {
      modalCapa.innerHTML = `<img src="${thumbUrl}" alt="${titulo}" class="cover-fade-in" onerror="this.style.display='none'">`;
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

    // Progresso de Leitura no Card (sincronizado para Windows e Celular)
    const prog = livro.progresso || { paginaAtual: 0, totalPaginas: 0, porcentagem: 0 };
    const paginaAtual = prog.paginaAtual || 0;
    const totalPaginas = prog.totalPaginas || 0;
    const porcentagem = (totalPaginas > 1)
      ? Math.min(100, Math.round((paginaAtual / totalPaginas) * 100))
      : (prog.porcentagem || 0);

    // Determinação robusta de status de leitura (respeita a escolha soberana do usuário)
    let statusClass = "nao-lido";
    let statusLabel = "Não Lido";
    let statusIcon = "⚪";

    const statusAtual = livro.status || livro.statusLeitura || "nenhum";

    if (statusAtual === "concluidos") {
      statusClass = "concluido";
      statusLabel = "Lido";
      statusIcon = "✅";
    } else if (statusAtual === "lendo") {
      statusClass = "lendo";
      statusLabel = porcentagem > 0 ? `Lendo ${porcentagem}%` : "Lendo";
      statusIcon = "📖";
    } else if (statusAtual === "quero-ler") {
      statusClass = "quero-ler";
      statusLabel = "Quero Ler";
      statusIcon = "📌";
    } else {
      // Nenhum status explicitamente marcado pelo usuário:
      // Só deduz se o livro tiver contagem real de páginas (> 1)
      if (totalPaginas > 1 && paginaAtual >= totalPaginas && porcentagem >= 100) {
        statusClass = "concluido";
        statusLabel = "Lido";
        statusIcon = "✅";
      } else if (totalPaginas > 1 && paginaAtual > 1) {
        statusClass = "lendo";
        statusLabel = porcentagem > 0 ? `Lendo ${porcentagem}%` : "Lendo";
        statusIcon = "📖";
      } else {
        statusClass = "nao-lido";
        statusLabel = "Não Lido";
        statusIcon = "⚪";
      }
    }

    const statusBadge = `<span class="badge-reading-status ${statusClass}" title="Status: ${statusLabel}">${statusIcon} ${statusLabel}</span>`;

    // Capa Extraída ou Fallback Estilo Capa Dura Clássica
    const temCapaValida = typeof livro.thumbnail === "string" && livro.thumbnail.length > 15 && livro.thumbnail !== "true" && livro.thumbnail !== "false";
    const tituloEscapado = escapeHtml(tituloExibicao);
    const autorEscapado = livro.autor !== "Desconhecido" ? escapeHtml(livro.autor) : "";

    const capaConteudo = temCapaValida
      ? `
        <img class="book-cover-image" src="${escapeHtml(livro.thumbnail)}" alt="${tituloEscapado}" loading="lazy" onerror="this.remove();" />
        <div class="book-cover-fallback theme-${paleta.tema}" style="background: ${paleta.bg}; border-left-color: ${paleta.borda};">
          <div class="fallback-book-ribbon" style="background: ${paleta.borda};"></div>
          <h4 class="fallback-book-title">${tituloEscapado}</h4>
          <p class="fallback-book-author" style="color: ${paleta.borda};">${autorEscapado}</p>
        </div>
      `
      : `
        <div class="book-cover-fallback theme-${paleta.tema}" style="background: ${paleta.bg}; border-left-color: ${paleta.borda};">
          <div class="fallback-book-ribbon" style="background: ${paleta.borda};"></div>
          <h4 class="fallback-book-title">${tituloEscapado}</h4>
          <p class="fallback-book-author" style="color: ${paleta.borda};">${autorEscapado}</p>
        </div>
      `;

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
        <span class="badge-format">${escapeHtml(formato)}</span>

        <button class="fav-btn ${isFav ? "active" : ""}" title="${isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}">
          <svg width="14" height="14" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>

        <div class="cover-hover-overlay">
          <button class="btn-cover-read" title="Abrir e ler no leitor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Ler</span>
          </button>
          <button class="btn-cover-copilot" title="Conversar com o SkillBook deste livro">
            <span>✨</span>
            <span>SkillBook</span>
          </button>
        </div>
        ${progressHtml}
      </div>

      <div class="book-card-body">
        <h3 class="book-title" title="${escapeHtml(livro.titulo || '')} (${escapeHtml(livro.nome || '')})">${tituloEscapado}</h3>
        ${autorEscapado ? `<p class="book-author" title="${autorEscapado}">${autorEscapado}</p>` : ''}
        <div class="card-reading-meta-bar">
          <span class="card-status-pill ${statusClass}">${statusIcon} ${statusLabel}</span>
          <span class="meta-size">${tamanho}</span>
        </div>
        ${paginaAtual > 0 ? `
          <div class="card-progress-indicator" title="Página ${paginaAtual} de ${totalPaginas || '?'} (${porcentagem}%)">
            <div class="progress-track">
              <div class="progress-fill ${statusClass === 'concluido' ? 'concluido' : ''}" style="width: ${porcentagem}%"></div>
            </div>
            <span class="progress-text">${paginaAtual}${totalPaginas ? `/${totalPaginas} pág` : ' pág'}</span>
          </div>
        ` : ''}
      </div>
    `;

    // Eventos são tratados centralizadamente via Event Delegation no container #grid
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
  const isMobile = window.isMobileEnvironment || window.innerWidth <= 768;

  if (resultsCount) {
    resultsCount.textContent = isMobile ? "Sua estante móvel" : "Nenhuma pasta selecionada";
  }
  if (!grid) return;

  if (isMobile) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3 class="empty-title">Sua Biblioteca Digital</h3>
        <p class="empty-desc">Adicione seus e-books (.pdf, .epub) do seu celular ou tablet para começar a ler com o leitor inteligente e o SkillBook IA.</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 16px;">
          <button class="btn-empty-action" id="btnEscolherArquivosVazio" style="background: linear-gradient(135deg, #e5a93b, #d97706); border: none; color: #12101c; font-weight: 700; font-size: 0.95rem; padding: 12px 24px; border-radius: 10px; box-shadow: 0 4px 15px rgba(229,169,59,0.35); cursor: pointer;">📲 Adicionar Livros / PDFs</button>
        </div>
      </div>
    `;
  } else {
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
  }

  document.getElementById("btnEscolherArquivosVazio")?.addEventListener("click", () => {
    window.api?.escolherArquivos?.().then(novaPasta => {
      if (novaPasta) {
        state.pastaAtual = novaPasta;
        showToast("Livros adicionados à biblioteca!");
        carregarBiblioteca();
      }
    });
  });
}

// ============================================================
// 5. MODAL DE DETALHES DO LIVRO
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
  registrarEstadoHistorico();

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
  registrarEstadoHistorico();

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

window.carregarBiblioteca = carregarBiblioteca;
window.renderizarGrade = renderizarGrade;
window.aplicarFiltrosEOrdenacao = aplicarFiltrosEOrdenacao;
window.alternarFavorito = alternarFavorito;
window.alternarAba = alternarAba;
window.limparBusca = limparBusca;
window.abrirMenu = abrirMenu;
window.fecharMenu = fecharMenu;
window.abrirPopupPasta = abrirPopupPasta;
window.fecharPopupPasta = fecharPopupPasta;
window.alternarSubpastas = alternarSubpastas;