/**
 * ============================================================================
 * EbookFinder — Orquestrador do Processo de Renderização (Electron & Capacitor)
 * ============================================================================
 * Coordena o ciclo de vida do frontend, atalhos globais de teclado,
 * delegação de eventos da estante e drag & drop.
 * Módulos especializados carregados em app/js/:
 * - state.js (Estado global reativo e temas)
 * - utils.js (Sanitização HTML, formatações e toasts)
 * - shelf.js (Estante, capas, busca, filtros e ordenação)
 * - reader.js (PDF.js viewer, EPUB/TXT reader, marcadores e Split-View)
 * - copilot.js (Tutor IA Book-to-Skill e Copiloto Groq)
 * - modals.js (Diálogos de configuração, métricas e detalhes)
 * ============================================================================
 */

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

document.addEventListener("DOMContentLoaded", () => {
  // Adaptações automáticas de texto e visibilidade no mobile
  const isMobile = window.isMobileEnvironment || !!window.Capacitor || window.innerWidth <= 768 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) {
    document.body.classList.add("is-mobile-app");
    const lblAbrir = document.getElementById("lblBtnAbrirExterno");
    if (lblAbrir) lblAbrir.textContent = "Abrir no Celular";
    const btnAbrir = document.getElementById("btnAbrirLeitorWindows");
    if (btnAbrir) btnAbrir.title = "Abrir leitor no celular";
    const btnExplorer = document.getElementById("btnRevelarExplorer");
    if (btnExplorer) btnExplorer.style.display = "none";
  }

  // Atalho para recarregar a interface em desenvolvimento
  window.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
      window.location.reload();
    }
  });

  // Suporte a navegação por histórico e botão Voltar nativo do Android / Navegador
  window.addEventListener("popstate", () => {
    tratarVoltarNativo();
  });

  document.addEventListener("backbutton", (e) => {
    e.preventDefault();
    const tratado = tratarVoltarNativo();
    if (!tratado && window.Capacitor?.Plugins?.App?.exitApp) {
      window.Capacitor.Plugins.App.exitApp();
    }
  });

  if (window.Capacitor?.Plugins?.App?.addListener) {
    try {
      window.Capacitor.Plugins.App.addListener("backButton", ({ canGoBack }) => {
        const tratado = tratarVoltarNativo();
        if (!tratado) {
          if (canGoBack) {
            window.history.back();
          } else {
            window.Capacitor.Plugins.App.exitApp();
          }
        }
      });
    } catch (e) {}
  }

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

  // Event Delegation no Grid da Estante (unificado, alta performance, zero memory leaks)
  const grid = document.getElementById("grid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      const caminho = card.dataset.caminho;
      const livro = (state.livrosFiltrados && state.livrosFiltrados.find(l => l.caminho === caminho)) ||
                    (state.todosLivros && state.todosLivros.find(l => l.caminho === caminho));
      if (!livro) return;

      if (e.target.closest(".fav-btn")) {
        e.stopPropagation();
        const btnFav = card.querySelector(".fav-btn");
        alternarFavorito(livro.caminho, btnFav);
      } else if (e.target.closest(".card-copilot-badge") || e.target.closest(".btn-cover-copilot")) {
        e.stopPropagation();
        abrirCopilotoIA(livro);
      } else if (e.target.closest(".btn-cover-skill")) {
        e.stopPropagation();
        criarSkillDiretoDoCard(livro);
      } else if (e.target.closest(".btn-cover-read")) {
        e.stopPropagation();
        abrirLeitorInterno(livro);
      } else if (e.target.closest(".btn-cover-info") || card.contains(e.target)) {
        abrirModalLivro(livro);
      }
    });

    grid.addEventListener("dblclick", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      const caminho = card.dataset.caminho;
      const livro = (state.livrosFiltrados && state.livrosFiltrados.find(l => l.caminho === caminho)) ||
                    (state.todosLivros && state.todosLivros.find(l => l.caminho === caminho));
      if (livro) abrirLeitorInterno(livro);
    });

    grid.addEventListener("contextmenu", (e) => {
      const card = e.target.closest(".book-card");
      if (!card) return;
      e.preventDefault();
      const caminho = card.dataset.caminho;
      const livro = (state.livrosFiltrados && state.livrosFiltrados.find(l => l.caminho === caminho)) ||
                    (state.todosLivros && state.todosLivros.find(l => l.caminho === caminho));
      if (livro) abrirMenuContextoLivro(livro, e.clientX, e.clientY);
    });
  }

  // Menu de Contexto da Obra (clique direito na estante)
  const bookContextMenu = document.getElementById("bookContextMenu");
  if (bookContextMenu) {
    bookContextMenu.addEventListener("click", async (e) => {
      e.stopPropagation();
      const livro = state.livroMenuContexto || state.livroSelecionado;
      if (!livro) {
        fecharMenuContextoLivro();
        return;
      }

      const statusBtn = e.target.closest(".context-status-pill");
      if (statusBtn) {
        const novoStatus = statusBtn.dataset.status;
        fecharMenuContextoLivro();
        if (typeof window.atualizarStatusLeitura === "function") {
          state.livroSelecionado = livro;
          await window.atualizarStatusLeitura(novoStatus);
        } else {
          livro.statusLeitura = novoStatus;
          livro.status = novoStatus;
          await window.api?.salvarStatusLeitura?.(livro.caminho, novoStatus);
          aplicarFiltrosEOrdenacao();
        }
        showToast(`Status definido como: ${novoStatus}`);
        return;
      }

      const actionBtn = e.target.closest(".context-menu-item");
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      fecharMenuContextoLivro();

      switch (action) {
        case "ler":
          abrirLeitorInterno(livro);
          break;
        case "skillbook":
          abrirCopilotoIA(livro);
          break;
        case "book-to-skill":
          criarSkillDiretoDoCard(livro);
          break;
        case "favorito": {
          const card = Array.from(document.querySelectorAll(".book-card")).find(c => c.dataset.caminho === livro.caminho);
          const favBtn = card ? card.querySelector(".fav-btn") : null;
          alternarFavorito(livro.caminho, favBtn);
          break;
        }
        case "detalhes":
          abrirModalLivro(livro);
          break;
        case "explorer":
          window.api?.revelarNoExplorer?.(livro.caminho);
          break;
        case "remover":
          removerLivroDaEstante(livro);
          break;
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#bookContextMenu")) {
        fecharMenuContextoLivro();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        fecharMenuContextoLivro();
      }
    });
  }

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
    else if (action === "metricas") { fecharMenu(); abrirModalMetricas(); }
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

  // Abrir no Leitor (Windows ou Celular)
  document.getElementById("btnAbrirLeitorWindows")?.addEventListener("click", () => {
    if (state.livroSelecionado) {
      const isMobile = window.isMobileEnvironment || !!window.Capacitor || window.innerWidth <= 768;
      if (isMobile) {
        abrirLeitorInterno(state.livroSelecionado);
      } else {
        window.api?.abrirNoWindows?.(state.livroSelecionado.caminho);
        showToast("Abrindo no leitor... Boas leituras!");
        salvarProgressoModal(false);
      }
    }
  });

  // Revelar no Explorer
  document.getElementById("btnRevelarExplorer")?.addEventListener("click", () => {
    if (state.livroSelecionado?.caminho) {
      window.api?.revelarNoExplorer?.(state.livroSelecionado.caminho);
      showToast("Arquivo destacado na pasta.");
    }
  });

  // Remover da Estante / Biblioteca
  document.getElementById("btnRemoverLivroModal")?.addEventListener("click", removerLivroSelecionado);

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
    if (!inp.value) {
      showToast("Sua chave ativa está protegida e não é exibida na tela por privacidade.");
      return;
    }
    inp.type = inp.type === "password" ? "text" : "password";
  });

  document.getElementById("btnTestarConexaoIA")?.addEventListener("click", async () => {
    const key = document.getElementById("inputGroqKey")?.value?.trim();
    const lbl = document.getElementById("lblStatusConexao");
    const cfg = await window.api?.obterConfigIA?.();
    const temChave = Boolean(key || cfg?.hasKey || cfg?.apiKey);

    if (!temChave) {
      if (lbl) { lbl.textContent = "⚠️ Digite uma chave para testar"; lbl.className = "status-indicator erro"; }
      return;
    }
    if (lbl) { lbl.textContent = "⏳ Conectando à API do SkillBook..."; lbl.className = "status-indicator"; }
    // Envia a nova chave ou vazio para usar a chave já salva no sistema
    const res = await window.api?.testarConexaoGroq?.(key || "");
    if (res?.success) {
      if (lbl) { lbl.textContent = "🟢 Conexão com SkillBook validada com sucesso!"; lbl.className = "status-indicator ok"; }
      showToast("SkillBook conectado com sucesso!");
    } else {
      if (lbl) { lbl.textContent = `🔴 ${res?.error || "Erro de autenticação"}`; lbl.className = "status-indicator erro"; }
    }
  });

  document.getElementById("btnSalvarConfigIA")?.addEventListener("click", async () => {
    const key = document.getElementById("inputGroqKey")?.value?.trim();
    const model = normalizarModeloIA(document.getElementById("selectModeloIA")?.value);
    // Se o usuário não digitou uma nova chave, preserva com segurança a chave existente no sistema
    const ok = await window.api?.salvarConfigIA?.({ apiKey: key || "", model });
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
  document.getElementById("btnLeitorTelaCheia")?.addEventListener("click", () => alternarTelaCheiaLeitor());

  // Eventos do Dock Flutuante de Leitura & Zoom
  document.getElementById("btnDockZoomOut")?.addEventListener("click", () => ajustarZoom(-0.2));
  document.getElementById("btnDockAjustar")?.addEventListener("click", () => ajustarLarguraLeitor());
  document.getElementById("btnDockZoomIn")?.addEventListener("click", () => ajustarZoom(0.2));
  document.getElementById("btnDockTelaCheia")?.addEventListener("click", () => alternarTelaCheiaLeitor());

  // Eventos do Filtro de Leitura (Normal, Sépia, Noturno)
  document.getElementById("btnLeitorFiltroCor")?.addEventListener("click", alternarFiltroLeitura);
  document.getElementById("btnDockFiltroCor")?.addEventListener("click", alternarFiltroLeitura);
  aplicarFiltroLeitura(state.filtroLeitura);

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
      const barraBusca = document.getElementById("leitorBarraBusca");
      if (barraBusca && !barraBusca.hidden) {
        alternarBarraBuscaLeitor(false);
      } else {
        fecharLeitorInterno();
      }
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      mudarPaginaLeitor(-1);
    } else if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && tag !== "INPUT")) {
      e.preventDefault();
      mudarPaginaLeitor(1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      alternarBarraBuscaLeitor(true);
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
  // EVENTOS DA FASE 2: BUSCA NO LEITOR, MARCADORES, EXPORTAÇÃO E MÉTRICAS
  // ============================================================
  // 1. Busca Textual no Leitor
  document.getElementById("btnLeitorAbrirBusca")?.addEventListener("click", () => alternarBarraBuscaLeitor());
  document.getElementById("btnDockBusca")?.addEventListener("click", () => alternarBarraBuscaLeitor());
  document.getElementById("btnLeitorFecharBusca")?.addEventListener("click", () => alternarBarraBuscaLeitor(false));
  document.getElementById("btnLeitorBuscaProxima")?.addEventListener("click", () => executarBuscaNoLivro(1));
  document.getElementById("btnLeitorBuscaAnterior")?.addEventListener("click", () => executarBuscaNoLivro(-1));
  document.getElementById("inputLeitorBusca")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executarBuscaNoLivro(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      alternarBarraBuscaLeitor(false);
    }
  });

  // 2. Marcadores & Anotações
  document.getElementById("btnLeitorMarcador")?.addEventListener("click", () => alternarMarcadorPaginaAtual());
  document.getElementById("btnDockMarcador")?.addEventListener("click", () => {
    const sidebar = document.getElementById("readerSkillSidebar");
    if (sidebar && sidebar.classList.contains("collapsed")) {
      toggleSkillSidebar(true);
      alternarTabSidebarLeitor("marcadores");
    } else {
      alternarMarcadorPaginaAtual();
    }
  });
  document.getElementById("tabBtnReaderIA")?.addEventListener("click", () => alternarTabSidebarLeitor("chat"));
  document.getElementById("tabBtnReaderMarcadores")?.addEventListener("click", () => alternarTabSidebarLeitor("marcadores"));

  const adicionarMarcadorComNota = () => {
    const input = document.getElementById("inputNotaMarcador");
    const nota = input?.value || "";
    alternarMarcadorPaginaAtual(nota);
    if (input) input.value = "";
  };
  document.getElementById("btnAdicionarMarcador")?.addEventListener("click", adicionarMarcadorComNota);
  document.getElementById("inputNotaMarcador")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      adicionarMarcadorComNota();
    }
  });

  // 3. Exportação de Conversas com o SkillBook
  document.getElementById("btnCopilotExportarChat")?.addEventListener("click", () => exportarConversaIA("copiloto"));
  document.getElementById("btnExportarChatLeitor")?.addEventListener("click", () => exportarConversaIA("leitor"));

  // 4. Modal de Métricas da Biblioteca
  document.getElementById("btnAbrirMetricasTab")?.addEventListener("click", abrirModalMetricas);
  document.getElementById("btnFecharModalMetricas")?.addEventListener("click", fecharModalMetricas);
  document.getElementById("modalMetricasBiblioteca")?.addEventListener("click", (e) => {
    if (e.target.id === "modalMetricasBiblioteca") fecharModalMetricas();
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
  window.alternarTelaCheiaLeitor = alternarTelaCheiaLeitor;
  window.abrirModalSobre = abrirModalSobre;
  window.fecharModalSobre = fecharModalSobre;
  window.criarSkillDiretoDoCard = criarSkillDiretoDoCard;
  window.alternarFiltroLeitura = alternarFiltroLeitura;
  window.removerLivroSelecionado = removerLivroSelecionado;
  window.abrirModalMetricas = abrirModalMetricas;
  window.fecharModalMetricas = fecharModalMetricas;
  window.exportarConversaIA = exportarConversaIA;
  window.alternarBarraBuscaLeitor = alternarBarraBuscaLeitor;
  window.executarBuscaNoLivro = executarBuscaNoLivro;
  window.alternarTabSidebarLeitor = alternarTabSidebarLeitor;
  window.alternarMarcadorPaginaAtual = alternarMarcadorPaginaAtual;

  carregarBiblioteca();
});