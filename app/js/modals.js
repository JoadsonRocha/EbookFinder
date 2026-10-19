/**
 * EbookFinder — Módulo de Diálogos e Modais
 */
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
    const temCapaModal = typeof livro.thumbnail === "string" && livro.thumbnail.length > 15 && livro.thumbnail !== "true" && livro.thumbnail !== "false";
    if (temCapaModal) {
      coverContainer.innerHTML = `<img src="${livro.thumbnail}" alt="${tituloLimpo}" class="cover-fade-in" onerror="this.remove()">`;
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
  registrarEstadoHistorico();
  document.addEventListener("keydown", lidarTeclasModal);
}

function fecharModalLivro() {
  const modal = document.getElementById("modalLivro");
  if (modal) modal.hidden = true;
  state.livroSelecionado = null;
  document.removeEventListener("keydown", lidarTeclasModal);
}

async function removerLivroSelecionado() {
  if (!state.livroSelecionado) return;
  const livro = state.livroSelecionado;
  const tit = livro.tituloHumanizado || formatarTituloHumanizado(livro.titulo, livro.nome);

  const confirmar = confirm(`Tem certeza que deseja remover "${tit}" da sua estante?`);
  if (!confirmar) return;

  fecharModalLivro();
  try {
    const ok = await window.api?.removerLivro?.(livro.caminho);
    if (ok !== false) {
      state.todosLivros = state.todosLivros.filter(l => l.caminho !== livro.caminho);
      state.livrosFiltrados = state.livrosFiltrados.filter(l => l.caminho !== livro.caminho);
      state.favoritos.delete(livro.caminho);
      localStorage.setItem("ef_favoritos", JSON.stringify([...state.favoritos]));
      aplicarFiltrosEOrdenacao();
      showToast(`"${tit}" foi removido da estante.`);
    } else {
      showToast("Não foi possível remover a obra.");
    }
  } catch (e) {
    showToast("Erro ao remover obra.");
  }
}

function abrirModalSobre() {
  const modal = document.getElementById("modalSobre");
  if (!modal) return;
  modal.hidden = false;
  registrarEstadoHistorico();
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

function abrirModalMetricas() {
  const modal = document.getElementById("modalMetricasBiblioteca");
  if (!modal) return;

  const totalLivros = state.todosLivros.length;
  const concluidos = state.todosLivros.filter(l => l.status === "concluidos").length;
  const lendo = state.todosLivros.filter(l => l.status === "lendo").length;
  const queroLer = state.todosLivros.filter(l => l.status === "quero-ler").length;
  const naoLidos = Math.max(0, totalLivros - concluidos - lendo - queroLer);

  let paginasLidas = 0;
  let totalPaginasEstante = 0;

  state.todosLivros.forEach(l => {
    const pag = l.progresso?.paginaAtual || 0;
    const tot = l.progresso?.totalPaginas || 0;
    paginasLidas += pag;
    totalPaginasEstante += tot;
  });

  const percGlobal = totalPaginasEstante > 0 
    ? Math.min(100, Math.round((paginasLidas / totalPaginasEstante) * 100))
    : (totalLivros > 0 ? Math.round((concluidos / totalLivros) * 100) : 0);

  const elTotalLivros = document.getElementById("statTotalLivros");
  const elPaginasLidas = document.getElementById("statPaginasLidas");
  const elLivrosLidos = document.getElementById("statLivrosLidos");
  const elPercGlobal = document.getElementById("statPercentualGlobal");

  if (elTotalLivros) elTotalLivros.textContent = totalLivros;
  if (elPaginasLidas) elPaginasLidas.textContent = paginasLidas.toLocaleString("pt-BR");
  if (elLivrosLidos) elLivrosLidos.textContent = concluidos;
  if (elPercGlobal) elPercGlobal.textContent = `${percGlobal}%`;

  const pctConcl = totalLivros > 0 ? (concluidos / totalLivros) * 100 : 0;
  const pctLendo = totalLivros > 0 ? (lendo / totalLivros) * 100 : 0;
  const pctQuero = totalLivros > 0 ? (queroLer / totalLivros) * 100 : 0;
  const pctNaoLido = totalLivros > 0 ? (naoLidos / totalLivros) * 100 : 100;

  const barConcluidos = document.getElementById("barConcluidos");
  const barLendo = document.getElementById("barLendo");
  const barQueroLer = document.getElementById("barQueroLer");
  const barNaoLido = document.getElementById("barNaoLido");

  if (barConcluidos) barConcluidos.style.width = `${pctConcl}%`;
  if (barLendo) barLendo.style.width = `${pctLendo}%`;
  if (barQueroLer) barQueroLer.style.width = `${pctQuero}%`;
  if (barNaoLido) barNaoLido.style.width = `${pctNaoLido}%`;

  const legConcl = document.getElementById("lblLegendaConcluidos");
  const legLendo = document.getElementById("lblLegendaLendo");
  const legQuero = document.getElementById("lblLegendaQueroLer");
  const legNao = document.getElementById("lblLegendaNaoLidos");

  if (legConcl) legConcl.textContent = concluidos;
  if (legLendo) legLendo.textContent = lendo;
  if (legQuero) legQuero.textContent = queroLer;
  if (legNao) legNao.textContent = naoLidos;

  registrarEstadoHistorico();
  modal.hidden = false;
}

function fecharModalMetricas() {
  const modal = document.getElementById("modalMetricasBiblioteca");
  if (modal) modal.hidden = true;
}

window.irParaPaginaLeitor = irParaPaginaLeitor;
window.removerMarcadorPorId = removerMarcadorPorId;

// ============================================================================
// 5.1 TEMA CLARO / ESCURO & CONFIGURAÇÃO DA IA (GROQ)
// ============================================================================

async function abrirModalConfigIA() {
  const modal = document.getElementById("modalConfigIA");
  if (!modal) return;

  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "llama-3.1-8b-instant", isBundled: false, hasKey: false };
  const inputKey = document.getElementById("inputGroqKey");
  const selectModel = document.getElementById("selectModeloIA");
  const lblStatus = document.getElementById("lblStatusConexao");
  const boxStatusChave = document.getElementById("boxStatusChaveSegura");
  const txtChaveSegura = document.getElementById("txtChaveSegura");

  const temChaveAtiva = Boolean(cfg.hasKey || (cfg.apiKey && cfg.apiKey.trim()));

  if (inputKey) {
    // NUNCA expõe a chave real no valor do input (proteção total da privacidade)
    inputKey.value = "";
    inputKey.type = "password";
    if (temChaveAtiva) {
      inputKey.placeholder = "🔒 Chave ativa e oculta por segurança (digite apenas para trocar)";
    } else {
      inputKey.placeholder = "gsk_...";
    }
  }

  if (boxStatusChave) {
    if (temChaveAtiva) {
      boxStatusChave.style.display = "inline-flex";
      if (txtChaveSegura) {
        txtChaveSegura.textContent = cfg.isBundled
          ? "Chave oficial do SkillBook ativa e protegida"
          : "Chave configurada e oculta por segurança";
      }
    } else {
      boxStatusChave.style.display = "none";
    }
  }

  if (selectModel) selectModel.value = normalizarModeloIA(cfg.model);

  if (lblStatus) {
    if (temChaveAtiva) {
      lblStatus.textContent = cfg.isBundled
        ? "🟢 Chave de IA ativa via Instalador MSI"
        : "🟢 Chave configurada no perfil do usuário";
      lblStatus.className = "status-indicator ok";
    } else {
      lblStatus.textContent = "⚪ Nenhuma chave configurada";
      lblStatus.className = "status-indicator";
    }
  }

  registrarEstadoHistorico();
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


window.abrirModalLivro = abrirModalLivro;
window.fecharModalLivro = fecharModalLivro;
window.abrirModalConfigIA = abrirModalConfigIA;
window.fecharModalConfigIA = fecharModalConfigIA;
window.abrirModalSobre = abrirModalSobre;
window.fecharModalSobre = fecharModalSobre;
window.abrirModalMetricas = abrirModalMetricas;
window.fecharModalMetricas = fecharModalMetricas;
window.alternarTabModal = alternarTabModal;
window.removerLivroSelecionado = removerLivroSelecionado;
window.tratarVoltarNativo = tratarVoltarNativo;