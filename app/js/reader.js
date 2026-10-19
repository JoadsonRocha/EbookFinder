/**
 * EbookFinder — Módulo do Leitor Interno (PDF, EPUB, TXT, Marcadores)
 */
function aplicarFiltroLeitura(filtro) {
  const f = filtro || state.filtroLeitura || "normal";
  state.filtroLeitura = f;
  localStorage.setItem("ef_reader_filter", f);

  const viewport = document.getElementById("readerPdfViewport");
  if (viewport) {
    viewport.setAttribute("data-reader-filter", f);
  }

  const icone = f === "night" ? "🌙" : (f === "sepia" ? "📜" : "☀️");
  const iconEl = document.getElementById("iconFiltroLeitor");
  const dockIconEl = document.getElementById("lblDockFiltro");
  if (iconEl) iconEl.textContent = icone;
  if (dockIconEl) dockIconEl.textContent = icone;
}

function alternarFiltroLeitura() {
  const modos = ["normal", "sepia", "night"];
  const atualIdx = modos.indexOf(state.filtroLeitura || "normal");
  const prox = modos[(atualIdx + 1) % modos.length];
  aplicarFiltroLeitura(prox);

  const rotulos = {
    normal: "Normal (Padrão) ☀️",
    sepia: "Sépia (Conforto Térmico) 📜",
    night: "Noturno Invertido 🌙"
  };
  showToast(`Modo de Leitura: ${rotulos[prox]}`, 1600);
}

function registrarEstadoHistorico() {
  try {
    window.history.pushState({ modalAtivo: true }, "");
  } catch (e) {}
}

function tratarVoltarNativo() {
  const barraBusca = document.getElementById("leitorBarraBusca");
  if (state.leitor.ativo && barraBusca && !barraBusca.hidden) {
    alternarBarraBuscaLeitor(false);
    return true;
  }
  if (state.leitor.ativo) {
    fecharLeitorInterno();
    return true;
  }
  const modalMetricas = document.getElementById("modalMetricasBiblioteca");
  if (modalMetricas && !modalMetricas.hidden) {
    fecharModalMetricas();
    return true;
  }
  const modalCopiloto = document.getElementById("modalCopilotoIA");
  if (modalCopiloto && !modalCopiloto.hidden) {
    fecharCopilotoIA();
    return true;
  }
  const modalLivro = document.getElementById("modalLivro");
  if (modalLivro && !modalLivro.hidden) {
    fecharModalLivro();
    return true;
  }
  const modalConfig = document.getElementById("modalConfigIA");
  if (modalConfig && !modalConfig.hidden) {
    fecharModalConfigIA();
    return true;
  }
  const modalSobre = document.getElementById("modalSobre");
  if (modalSobre && !modalSobre.hidden) {
    fecharModalSobre();
    return true;
  }
  const popupPasta = document.getElementById("popupPasta");
  if (popupPasta && !popupPasta.hidden) {
    fecharPopupPasta();
    return true;
  }
  const menuDropdown = document.getElementById("menuDropdown");
  if (menuDropdown && !menuDropdown.hidden) {
    fecharMenu();
    return true;
  }
  return false;
}

async function abrirLeitorInterno(livro) {
  if (!livro || !livro.caminho) return;

  const ext = (livro.extensao || "").toLowerCase();
  const isPdf = ext === ".pdf" || ext === "pdf" || livro.caminho.toLowerCase().endsWith(".pdf");
  const isEpub = ext === ".epub" || ext === "epub" || livro.caminho.toLowerCase().endsWith(".epub");
  const isTxt = ext === ".txt" || ext === "txt" || livro.caminho.toLowerCase().endsWith(".txt");

  if (!isPdf && !isEpub && !isTxt) {
    showToast(`O formato ${ext.toUpperCase() || "da obra"} abre no leitor externo.`);
    window.api?.abrirNoWindows?.(livro.caminho);
    return;
  }

  const overlay = document.getElementById("viewLeitorIntegrado");
  const loading = document.getElementById("readerPdfLoading");
  const containerPdf = document.getElementById("readerPdfContainer");
  const containerTexto = document.getElementById("readerTextContainer");
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
  registrarEstadoHistorico();
  aplicarFiltroLeitura(state.filtroLeitura);

  state.leitor.ativo = true;
  state.leitor.livro = livro;
  state.leitor.tipoArquivo = isEpub ? "epub" : (isTxt ? "txt" : "pdf");
  state.leitor.pdfDoc = null;
  state.leitor.epubDoc = null;
  state.leitor.txtPaginas = [];
  state.leitor.paginaObj = null;
  state.leitor.conteudoTextoAtual = "";
  state.leitor.paginaAtual = Math.max(1, livro.progresso?.paginaAtual || 1);
  state.leitor.totalPaginas = livro.progresso?.totalPaginas || 1;
  state.leitor.escala = 1.0;
  state.leitor.tabSidebar = "chat";
  state.leitor.busca = {
    ativa: false,
    termo: "",
    ocorrencias: [],
    indiceAtual: -1,
    cacheTexto: new Map()
  };

  alternarBarraBuscaLeitor(false);
  alternarTabSidebarLeitor("chat");
  atualizarIndicadorMarcadorToolbar();

  // No mobile, a barra lateral do SkillBook inicia recolhida para dar 100% de visão ao livro
  const isMobile = window.innerWidth <= 768 || document.body.classList.contains("is-mobile-app");
  if (isMobile) {
    toggleSkillSidebar(false);
  }

  // Atualiza indicador do modelo na barra lateral do leitor
  const cfg = await window.api?.obterConfigIA?.() || { model: "llama-3.1-8b-instant" };
  const lblModel = document.getElementById("lblReaderModeloIA");
  if (lblModel) {
    const isPro = (cfg.model || "").includes("120b") || (cfg.model || "").includes("70b");
    lblModel.textContent = isPro ? "Pro" : "Turbo";
  }

  // Carrega histórico de chat desta obra com proteção
  try {
    carregarHistoricoChatLeitor(livro.caminho, tituloLimpo);
  } catch (errChat) {
    console.warn("Aviso ao carregar histórico de chat do leitor:", errChat);
  }

  try {
    if (isEpub) {
      if (containerPdf) containerPdf.hidden = true;
      if (containerTexto) containerTexto.hidden = false;

      const epubData = await window.api?.lerConteudoEpub?.(livro.caminho);
      if (!epubData || !epubData.capitulos || epubData.capitulos.length === 0) {
        showToast("Não foi possível carregar os capítulos do EPUB.");
        fecharLeitorInterno();
        return;
      }

      state.leitor.epubDoc = epubData;
      state.leitor.totalPaginas = epubData.totalCapitulos;

      const totalEl = document.getElementById("leitorTotalPaginas");
      if (totalEl) totalEl.textContent = epubData.totalCapitulos;

      if (state.leitor.paginaAtual > epubData.totalCapitulos) {
        state.leitor.paginaAtual = 1;
      }

      aplicarZoomTexto();
      await renderizarPaginaLeitor(state.leitor.paginaAtual);
    } else if (isTxt) {
      if (containerPdf) containerPdf.hidden = true;
      if (containerTexto) containerTexto.hidden = false;

      const buffer = await window.api?.lerArquivoBuffer?.(livro.caminho);
      if (!buffer) {
        showToast("Não foi possível ler o arquivo de texto.");
        fecharLeitorInterno();
        return;
      }

      const decoder = new TextDecoder("utf-8");
      const fullText = decoder.decode(buffer);
      const paginas = paginarTextoSimples(fullText, 2500);

      state.leitor.txtPaginas = paginas;
      state.leitor.totalPaginas = Math.max(1, paginas.length);

      const totalEl = document.getElementById("leitorTotalPaginas");
      if (totalEl) totalEl.textContent = state.leitor.totalPaginas;

      if (state.leitor.paginaAtual > state.leitor.totalPaginas) {
        state.leitor.paginaAtual = 1;
      }

      aplicarZoomTexto();
      await renderizarPaginaLeitor(state.leitor.paginaAtual);
    } else {
      if (containerTexto) containerTexto.hidden = true;
      if (containerPdf) containerPdf.hidden = false;

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

      const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const loadingTask = pdfjs.getDocument({ data: uint8Array });
      const pdfDoc = await loadingTask.promise;

      state.leitor.pdfDoc = pdfDoc;
      state.leitor.totalPaginas = pdfDoc.numPages;

      const totalEl = document.getElementById("leitorTotalPaginas");
      if (totalEl) totalEl.textContent = pdfDoc.numPages;

      if (state.leitor.paginaAtual > pdfDoc.numPages) {
        state.leitor.paginaAtual = 1;
      }

      // Pré-calcula a escala ideal para a tela (evita render duplo e piscas)
      try {
        const pageInit = await pdfDoc.getPage(state.leitor.paginaAtual);
        state.leitor.paginaObj = pageInit;
        const unscaled = pageInit.getViewport({ scale: 1 });
        const viewportEl = document.getElementById("readerPdfViewport");
        const margem = isMobile ? 0 : 40;
        const larguraDisponivel = (viewportEl?.clientWidth || window.innerWidth) - margem;
        if (larguraDisponivel > 50 && unscaled.width > 0) {
          state.leitor.escala = Math.max(0.35, Math.min(3.5, larguraDisponivel / unscaled.width));
        }
      } catch (eCalc) {
        console.warn("Aviso no pré-cálculo da escala:", eCalc);
      }

      await renderizarPaginaLeitor(state.leitor.paginaAtual);
      configurarGestosTouchLeitor();
    }
  } catch (err) {
    console.error("Erro ao abrir obra no leitor interno:", err);
    if (isMobile) {
      showToast("Erro ao abrir este documento no aparelho.");
    } else {
      showToast("Abrindo no leitor do Windows...");
      window.api?.abrirNoWindows?.(livro.caminho);
    }
    fecharLeitorInterno();
  } finally {
    if (loading) loading.hidden = true;
  }
}

function fecharLeitorInterno() {
  alternarTelaCheiaLeitor(false);
  alternarBarraBuscaLeitor(false);
  const overlay = document.getElementById("viewLeitorIntegrado");
  if (overlay) overlay.hidden = true;

  const containerPdf = document.getElementById("readerPdfContainer");
  const containerTexto = document.getElementById("readerTextContainer");
  if (containerPdf) containerPdf.hidden = false;
  if (containerTexto) containerTexto.hidden = true;

  if (state.leitor.currentRenderTask) {
    try { state.leitor.currentRenderTask.cancel(); } catch (e) {}
  }

  if (state.leitor.ativo && state.leitor.livro) {
    salvarProgressoLeitor(state.leitor.livro, state.leitor.paginaAtual, state.leitor.totalPaginas);
  }

  state.leitor.ativo = false;
  state.leitor.livro = null;
  state.leitor.pdfDoc = null;
  state.leitor.epubDoc = null;
  state.leitor.txtPaginas = [];
  state.leitor.paginaObj = null;
  state.leitor.conteudoTextoAtual = "";

  carregarBiblioteca();
}

/**
 * Gestos de toque aprimorados para celular (Padrão Kindle / Google Play Livros):
 * - Pinça (Pinch-to-zoom com 2 dedos em tempo real)
 * - Toque duplo para zoom rápido (1.8x ou Ajustar à tela)
 * - Toque único: laterais mudam de página, centro alterna Tela Cheia / Modo Imersivo
 * - Swipe horizontal para passar páginas quando sem zoom
 */
function configurarGestosTouchLeitor() {
  const viewport = document.getElementById("readerPdfViewport");
  const container = document.getElementById("readerPdfContainer");
  if (!viewport || viewport._touchAtivo) return;
  viewport._touchAtivo = true;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastTapTime = 0;
  let singleTapTimer = null;

  // Variáveis para Pinça (Pinch)
  let isPinching = false;
  let startDist = 0;
  let baseScale = 1.0;
  let currentPinchScale = 1.0;

  viewport.addEventListener("touchstart", (e) => {
    // Não intercepta se o toque foi em botões flutuantes, inputs, textarea ou dock
    if (e.target.closest("button, input, textarea, .reader-quick-dock, .leitor-toolbar")) {
      return;
    }

    if (e.touches.length === 2) {
      if (singleTapTimer) {
        clearTimeout(singleTapTimer);
        singleTapTimer = null;
      }
      isPinching = true;
      startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      baseScale = state.leitor.escala || 1.0;
      currentPinchScale = baseScale;
    } else if (e.touches.length === 1) {
      isPinching = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (isPinching && e.touches.length === 2 && startDist > 0) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / startDist;
      currentPinchScale = Math.max(0.35, Math.min(3.5, baseScale * ratio));

      // Efeito visual imediato e fluido a 60 FPS
      if (container) {
        container.style.transform = `scale(${ratio})`;
      }
    }
  }, { passive: true });

  viewport.addEventListener("touchend", (e) => {
    if (isPinching) {
      isPinching = false;
      startDist = 0;
      if (container) container.style.transform = "";
      if (Math.abs(currentPinchScale - baseScale) > 0.06) {
        ajustarZoom(0, currentPinchScale);
      }
      return;
    }

    if (e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      const timeElapsed = Date.now() - startTime;
      const dist = Math.hypot(diffX, diffY);
      const tapX = e.changedTouches[0].clientX;
      const screenW = window.innerWidth;

      // 1. SWIPE HORIZONTAL (Passar página caso não esteja com super zoom)
      if (dist > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && timeElapsed < 450) {
        if (state.leitor.escala <= 1.25) {
          if (diffX < 0) {
            mudarPaginaLeitor(1); // Deslizar para esquerda -> próxima página
          } else {
            mudarPaginaLeitor(-1); // Deslizar para direita -> página anterior
          }
          return;
        }
      }

      // 2. TOQUE NA TELA (TAP): Toque Duplo ou Toque Único
      if (dist < 12 && timeElapsed < 280) {
        const now = Date.now();
        const interval = now - lastTapTime;

        if (interval < 300) {
          // TOQUE DUPLO DETECTADO: Alterna entre Ajustar à Tela e 180% Zoom
          if (singleTapTimer) {
            clearTimeout(singleTapTimer);
            singleTapTimer = null;
          }
          lastTapTime = 0;

          if (state.leitor.escala > 1.25) {
            ajustarLarguraLeitor();
            showToast("Zoom: Ajustado à tela", 1500);
          } else {
            ajustarZoom(0, 1.8);
            showToast("Zoom: 180%", 1500);
          }
        } else {
          // PODE SER TOQUE ÚNICO: Aguarda 240ms para descartar segundo toque
          lastTapTime = now;
          singleTapTimer = setTimeout(() => {
            singleTapTimer = null;

            // Zonas de toque inteligentes:
            // Esquerda (15%): Página anterior
            // Direita (15%): Próxima página
            // Centro (70%): Alternar Tela Cheia / Modo Imersivo
            if (tapX < screenW * 0.15) {
              mudarPaginaLeitor(-1);
            } else if (tapX > screenW * 0.85) {
              mudarPaginaLeitor(1);
            } else {
              alternarTelaCheiaLeitor();
            }
          }, 240);
        }
      }
    }
  }, { passive: true });
}

function paginarTextoSimples(texto, tamanhoPagina = 2500) {
  if (!texto) return [""];
  const paragrafos = texto.split(/\r?\n\r?\n/);
  const paginas = [];
  let buffer = "";

  for (const p of paragrafos) {
    const pLimpo = p.trim();
    if (!pLimpo) continue;
    if ((buffer.length + pLimpo.length) > tamanhoPagina && buffer.length > 0) {
      paginas.push(buffer.trim());
      buffer = pLimpo + "\n\n";
    } else {
      buffer += pLimpo + "\n\n";
    }
  }
  if (buffer.trim().length > 0) {
    paginas.push(buffer.trim());
  }
  return paginas.length > 0 ? paginas : [texto];
}


function aplicarZoomTexto() {
  const contentEl = document.getElementById("readerTextContent");
  if (contentEl) {
    contentEl.style.fontSize = `${state.leitor.tamanhoFonte || 18}px`;
  }
  const pct = `${state.leitor.tamanhoFonte || 18}px`;
  const lblZoom = document.getElementById("lblLeitorZoom");
  if (lblZoom) lblZoom.textContent = pct;
  const lblDockZoom = document.getElementById("lblDockZoom");
  if (lblDockZoom) lblDockZoom.textContent = pct;
}

async function renderizarPaginaLeitor(num) {
  if (state.leitor.renderizando) return;
  state.leitor.renderizando = true;

  const loading = document.getElementById("readerPdfLoading");
  if (loading) loading.hidden = false;

  try {
    const inputPag = document.getElementById("inputLeitorPagina");
    if (inputPag) inputPag.value = num;
    state.leitor.paginaAtual = num;

    if (state.leitor.tipoArquivo === "epub" && state.leitor.epubDoc) {
      const cap = state.leitor.epubDoc.capitulos[num - 1] || state.leitor.epubDoc.capitulos[0];
      const headerEl = document.getElementById("readerTextHeader");
      const contentEl = document.getElementById("readerTextContent");

      if (headerEl) headerEl.textContent = cap.titulo || `Capítulo ${num}`;
      if (contentEl) contentEl.innerHTML = sanitizarHtmlEpub(cap.conteudoHtml || "");
      state.leitor.conteudoTextoAtual = cap.textoPuro || "";

      aplicarZoomTexto();
      salvarProgressoLeitor(state.leitor.livro, num, state.leitor.totalPaginas);
      atualizarIndicadorMarcadorToolbar();

      const viewportElem = document.getElementById("readerPdfViewport");
      if (viewportElem) viewportElem.scrollTop = 0;
    } else if (state.leitor.tipoArquivo === "txt" && state.leitor.txtPaginas.length > 0) {
      const txt = state.leitor.txtPaginas[num - 1] || "";
      const headerEl = document.getElementById("readerTextHeader");
      const contentEl = document.getElementById("readerTextContent");

      if (headerEl) headerEl.textContent = `Página ${num} de ${state.leitor.totalPaginas}`;
      if (contentEl) {
        contentEl.innerHTML = txt
          .split("\n\n")
          .filter(Boolean)
          .map(p => `<p>${escapeHtml(p.trim())}</p>`)
          .join("");
      }
      state.leitor.conteudoTextoAtual = txt;

      aplicarZoomTexto();
      salvarProgressoLeitor(state.leitor.livro, num, state.leitor.totalPaginas);
      atualizarIndicadorMarcadorToolbar();

      const viewportElem = document.getElementById("readerPdfViewport");
      if (viewportElem) viewportElem.scrollTop = 0;
    } else if (state.leitor.pdfDoc) {
      const canvas = document.getElementById("readerPdfCanvas");
      const page = await state.leitor.pdfDoc.getPage(num);
      state.leitor.paginaObj = page;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: state.leitor.escala });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";
      canvas.style.maxWidth = "none";

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

      const pct = `${Math.round(state.leitor.escala * 100)}%`;
      const lblZoom = document.getElementById("lblLeitorZoom");
      if (lblZoom) lblZoom.textContent = pct;

      const lblDockZoom = document.getElementById("lblDockZoom");
      if (lblDockZoom) lblDockZoom.textContent = pct;

      salvarProgressoLeitor(state.leitor.livro, num, state.leitor.totalPaginas);
      atualizarIndicadorMarcadorToolbar();

      const viewportElem = document.getElementById("readerPdfViewport");
      if (viewportElem) viewportElem.scrollTop = 0;
    }
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
  const temConteudo = state.leitor.pdfDoc || state.leitor.epubDoc || state.leitor.txtPaginas.length > 0;
  if (!temConteudo) return;
  const nova = state.leitor.paginaAtual + delta;
  if (nova >= 1 && nova <= state.leitor.totalPaginas) {
    renderizarPaginaLeitor(nova);
  }
}

function irParaPaginaLeitor(num) {
  const temConteudo = state.leitor.pdfDoc || state.leitor.epubDoc || state.leitor.txtPaginas.length > 0;
  if (!temConteudo) return;
  const pag = Math.max(1, Math.min(state.leitor.totalPaginas, parseInt(num, 10) || 1));
  renderizarPaginaLeitor(pag);
}

function ajustarZoom(delta, definirFixo) {
  if (state.leitor.tipoArquivo === "epub" || state.leitor.tipoArquivo === "txt") {
    if (definirFixo !== undefined) {
      state.leitor.tamanhoFonte = Math.max(14, Math.min(32, Math.round(definirFixo)));
    } else {
      state.leitor.tamanhoFonte = Math.max(14, Math.min(32, (state.leitor.tamanhoFonte || 18) + (delta > 0 ? 2 : -2)));
    }
    aplicarZoomTexto();
    return;
  }

  // PDF
  if (definirFixo !== undefined) {
    state.leitor.escala = Math.max(0.35, Math.min(3.5, definirFixo));
  } else {
    state.leitor.escala = Math.max(0.35, Math.min(3.5, state.leitor.escala + delta));
  }

  const pct = `${Math.round(state.leitor.escala * 100)}%`;
  const lblZoom = document.getElementById("lblLeitorZoom");
  if (lblZoom) lblZoom.textContent = pct;

  const lblDockZoom = document.getElementById("lblDockZoom");
  if (lblDockZoom) lblDockZoom.textContent = pct;

  if (state.leitor.paginaAtual) {
    renderizarPaginaLeitor(state.leitor.paginaAtual);
  }
}

function ajustarLarguraLeitor() {
  if (state.leitor.tipoArquivo === "epub" || state.leitor.tipoArquivo === "txt") {
    state.leitor.tamanhoFonte = 18;
    aplicarZoomTexto();
    return;
  }

  const viewport = document.getElementById("readerPdfViewport");
  if (!viewport || !state.leitor.paginaObj) return;

  const unscaled = state.leitor.paginaObj.getViewport({ scale: 1 });
  const isMobile = window.innerWidth <= 768 || document.body.classList.contains("is-mobile-app");
  const margem = isMobile ? 0 : 40; // 0px no mobile para 100% de largura
  const larguraDisponivel = (viewport.clientWidth || window.innerWidth) - margem;
  if (larguraDisponivel > 50 && unscaled.width > 0) {
    const novaEscala = Math.max(0.35, Math.min(3.5, larguraDisponivel / unscaled.width));
    ajustarZoom(0, novaEscala);

    const lblDockZoom = document.getElementById("lblDockZoom");
    if (lblDockZoom) lblDockZoom.textContent = "Ajustado";
  }
}

function alternarTelaCheiaLeitor(forcarEstado) {
  const overlay = document.getElementById("viewLeitorIntegrado");
  const btnFullscreen = document.getElementById("btnLeitorTelaCheia");
  const btnDockFullscreen = document.getElementById("btnDockTelaCheia");
  if (!overlay) return;

  const estaImersivo = overlay.classList.contains("modo-imersivo");
  const novoEstado = forcarEstado !== undefined ? forcarEstado : !estaImersivo;

  if (novoEstado) {
    overlay.classList.add("modo-imersivo");
    btnFullscreen?.classList.add("active");
    btnDockFullscreen?.classList.add("active");

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}

    showToast("Modo Tela Cheia: toque no meio da tela para ver os controles.", 2500);
  } else {
    overlay.classList.remove("modo-imersivo");
    btnFullscreen?.classList.remove("active");
    btnDockFullscreen?.classList.remove("active");

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
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
    anotacoes: livro.progresso?.anotacoes || "",
    marcadores: livro.progresso?.marcadores || []
  };
  const resultado = await window.api?.salvarProgressoLeitura?.(livro.caminho, dados);
  if (resultado) {
    livro.progresso = resultado;
    if (resultado.status) livro.status = resultado.status;
    const idx = state.todosLivros.findIndex(l => l.caminho === livro.caminho);
    if (idx !== -1) {
      state.todosLivros[idx].progresso = resultado;
      if (resultado.status) state.todosLivros[idx].status = resultado.status;
    }
  }
}

function carregarHistoricoChatLeitor(caminhoLivro, tituloObra) {
  const feed = document.getElementById("readerChatFeed");
  if (!feed) return;

  const historico = obterHistoricoChatStorage(caminhoLivro);
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

async function obterTextoDaPaginaAtual() {
  if (state.leitor.tipoArquivo === "pdf" && state.leitor.paginaObj) {
    try {
      const textContent = await state.leitor.paginaObj.getTextContent();
      return textContent.items.map(item => item.str).join(" ").trim();
    } catch (e) {
      return "";
    }
  }
  if (state.leitor.tipoArquivo === "epub" || state.leitor.tipoArquivo === "txt") {
    return state.leitor.conteudoTextoAtual || "";
  }
  return "";
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
  if (!contexto) {
    try {
      const txt = await obterTextoDaPaginaAtual();
      if (txt && txt.length > 20) {
        const rotulo = state.leitor.tipoArquivo === "epub" ? "Capítulo" : "Página";
        contexto = `${rotulo} atual do leitor: ${state.leitor.paginaAtual} de ${state.leitor.totalPaginas}\nTrecho da obra:\n"${txt.slice(0, 3500)}"`;
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

    const respMsg = document.createElement("div");
    respMsg.className = "copilot-msg assistente";
    respMsg.innerHTML = `
      <div class="copilot-avatar">✨</div>
      <div class="copilot-msg-content"><span class="typing-cursor"></span></div>
    `;
    feed.appendChild(respMsg);
    feed.scrollTop = feed.scrollHeight;

    const contentEl = respMsg.querySelector(".copilot-msg-content");
    const cfg = await window.api?.obterConfigIA?.() || { model: "llama-3.1-8b-instant" };
    const historicoAtual = obterHistoricoChatStorage(state.leitor.livro.caminho) || [];

    let streamedText = "";
    if (window.api?.perguntarGroqStream) {
      window.api.perguntarGroqStream({
        pergunta,
        contexto: contexto || `Leitura em andamento: Página ${state.leitor.paginaAtual} de ${state.leitor.totalPaginas}`,
        historico: historicoAtual,
        modelo: normalizarModeloIA(cfg.model),
        onChunk: (chunk) => {
          streamedText += chunk;
          contentEl.innerHTML = formatarMarkdownSimples(streamedText) + `<span class="typing-cursor"></span>`;
          feed.scrollTop = feed.scrollHeight;
        },
        onDone: (full) => {
          const finalTxt = full || streamedText;
          contentEl.innerHTML = formatarMarkdownSimples(finalTxt);
          feed.scrollTop = feed.scrollHeight;
          historicoAtual.push({ role: "user", content: pergunta });
          historicoAtual.push({ role: "assistant", content: finalTxt });
          salvarHistoricoChatStorage(state.leitor.livro.caminho, historicoAtual);
        },
        onError: (err) => {
          contentEl.innerHTML = `<p style="color: #fb7185;">${err || "Não foi possível obter resposta do SkillBook."}</p>`;
          feed.scrollTop = feed.scrollHeight;
        }
      });
    } else {
      const res = await window.api?.perguntarGroq?.({
        pergunta,
        contexto: contexto || `Leitura em andamento: Página ${state.leitor.paginaAtual} de ${state.leitor.totalPaginas}`,
        historico: historicoAtual,
        modelo: normalizarModeloIA(cfg.model)
      });

      if (res?.success && res.resposta) {
        contentEl.innerHTML = formatarMarkdownSimples(res.resposta);
        historicoAtual.push({ role: "user", content: pergunta });
        historicoAtual.push({ role: "assistant", content: res.resposta });
        salvarHistoricoChatStorage(state.leitor.livro.caminho, historicoAtual);
      } else {
        contentEl.innerHTML = `<p style="color: #fb7185;">${res?.error || "Não foi possível obter resposta do SkillBook."}</p>`;
      }
      feed.scrollTop = feed.scrollHeight;
    }
  }
}

async function explicarPaginaAtual() {
  try {
    const textoPagina = await obterTextoDaPaginaAtual();
    const rotulo = state.leitor.tipoArquivo === "epub" ? "deste capítulo" : `da Página ${state.leitor.paginaAtual}`;
    const prompt = `Explique de maneira didática, rica e analítica o conteúdo ${rotulo} desta obra. Destaque os pontos cruciais e como o leitor deve interpretar este trecho.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA SEÇÃO:\n"${textoPagina.slice(0, 3500)}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Explique o que é abordado neste trecho do livro.`);
  }
}

async function resumirPaginaAtual() {
  try {
    const textoPagina = await obterTextoDaPaginaAtual();
    const rotulo = state.leitor.tipoArquivo === "epub" ? "deste capítulo" : `da Página ${state.leitor.paginaAtual}`;
    const prompt = `Faça um resumo executivo com as melhores lições, regras práticas e ideias essenciais ${rotulo}.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA SEÇÃO:\n"${textoPagina.slice(0, 3500)}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Faça um resumo dos principais pontos desta seção.`);
  }
}

async function extrairConceitosPaginaAtual() {
  try {
    const textoPagina = await obterTextoDaPaginaAtual();
    const rotulo = state.leitor.tipoArquivo === "epub" ? "neste capítulo" : `na Página ${state.leitor.paginaAtual}`;
    const prompt = `Quais são os conceitos fundamentais, princípios ou termos técnicos apresentados ${rotulo}? Elenque cada um com uma definição direta.`;
    if (textoPagina && textoPagina.length > 20) {
      enviarPerguntaChatLeitor(prompt, `CONTEÚDO DA SEÇÃO:\n"${textoPagina.slice(0, 3500)}"`);
    } else {
      enviarPerguntaChatLeitor(prompt);
    }
  } catch (err) {
    enviarPerguntaChatLeitor(`Quais são os conceitos centrais desta parte do livro?`);
  }
}

// ============================================================================
// 4.9 FASE 2: BUSCA TEXTUAL, MARCADORES, EXPORTAÇÃO E ESTATÍSTICAS
// ============================================================================

function alternarBarraBuscaLeitor(mostrar) {
  const bar = document.getElementById("leitorBarraBusca");
  const input = document.getElementById("inputLeitorBusca");
  if (!bar) return;
  const novoEstado = mostrar !== undefined ? mostrar : bar.hidden;
  bar.hidden = !novoEstado;
  state.leitor.busca.ativa = novoEstado;
  if (novoEstado && input) {
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }
}

async function obterTextoPaginaPdf(numPagina) {
  if (state.leitor.tipoArquivo === "epub" && state.leitor.epubDoc) {
    const cap = state.leitor.epubDoc.capitulos[numPagina - 1];
    return (cap?.textoPuro || "").toLowerCase();
  }
  if (state.leitor.tipoArquivo === "txt" && state.leitor.txtPaginas.length > 0) {
    const txt = state.leitor.txtPaginas[numPagina - 1] || "";
    return txt.toLowerCase();
  }
  if (state.leitor.busca.cacheTexto.has(numPagina)) {
    return state.leitor.busca.cacheTexto.get(numPagina);
  }
  try {
    if (!state.leitor.pdfDoc) return "";
    const page = await state.leitor.pdfDoc.getPage(numPagina);
    const content = await page.getTextContent();
    const texto = content.items.map(item => item.str).join(" ").toLowerCase();
    state.leitor.busca.cacheTexto.set(numPagina, texto);
    return texto;
  } catch (e) {
    return "";
  }
}

async function executarBuscaNoLivro(direcao = 1) {
  const input = document.getElementById("inputLeitorBusca");
  const lblContador = document.getElementById("lblLeitorBuscaContador");
  const termo = (input?.value || "").trim().toLowerCase();
  const temConteudo = state.leitor.pdfDoc || state.leitor.epubDoc || state.leitor.txtPaginas.length > 0;

  if (!termo || !temConteudo) {
    if (lblContador) lblContador.textContent = "0/0";
    state.leitor.busca.ocorrencias = [];
    state.leitor.busca.indiceAtual = -1;
    return;
  }

  if (termo !== state.leitor.busca.termo) {
    state.leitor.busca.termo = termo;
    state.leitor.busca.ocorrencias = [];
    state.leitor.busca.indiceAtual = -1;
    if (lblContador) lblContador.textContent = "...";

    const total = state.leitor.totalPaginas;
    const encontradas = [];
    for (let p = 1; p <= total; p++) {
      const texto = await obterTextoPaginaPdf(p);
      if (texto.includes(termo)) {
        encontradas.push(p);
      }
    }
    state.leitor.busca.ocorrencias = encontradas;

    if (encontradas.length === 0) {
      if (lblContador) lblContador.textContent = "0/0";
      showToast(`Nenhuma ocorrência encontrada para "${termo}".`);
      return;
    }

    let idxMaisProximo = encontradas.findIndex(p => p >= state.leitor.paginaAtual);
    if (idxMaisProximo === -1) idxMaisProximo = 0;
    state.leitor.busca.indiceAtual = idxMaisProximo;
  } else {
    if (state.leitor.busca.ocorrencias.length > 0) {
      const total = state.leitor.busca.ocorrencias.length;
      state.leitor.busca.indiceAtual = (state.leitor.busca.indiceAtual + direcao + total) % total;
    }
  }

  const ocorrencias = state.leitor.busca.ocorrencias;
  const idx = state.leitor.busca.indiceAtual;

  if (ocorrencias.length > 0 && idx >= 0) {
    const pagAlvo = ocorrencias[idx];
    if (lblContador) lblContador.textContent = `${idx + 1}/${ocorrencias.length}`;
    if (pagAlvo !== state.leitor.paginaAtual) {
      renderizarPaginaLeitor(pagAlvo);
    }
  } else {
    if (lblContador) lblContador.textContent = "0/0";
  }
}

function alternarTabSidebarLeitor(tab) {
  state.leitor.tabSidebar = tab;
  const tabIA = document.getElementById("tabBtnReaderIA");
  const tabMarcadores = document.getElementById("tabBtnReaderMarcadores");
  const panelChat = document.getElementById("panelReaderChat");
  const panelMarcadores = document.getElementById("panelReaderMarcadores");

  if (tabIA) tabIA.classList.toggle("active", tab === "chat");
  if (tabMarcadores) tabMarcadores.classList.toggle("active", tab === "marcadores");
  if (panelChat) panelChat.hidden = tab !== "chat";
  if (panelMarcadores) panelMarcadores.hidden = tab !== "marcadores";

  if (tab === "marcadores") {
    renderizarListaMarcadores();
  }
}

function obterMarcadoresObraAtual() {
  const l = state.leitor.livro;
  if (!l || !l.progresso) return [];
  if (!Array.isArray(l.progresso.marcadores)) {
    l.progresso.marcadores = [];
  }
  return l.progresso.marcadores;
}

function atualizarIndicadorMarcadorToolbar() {
  const btnMarcador = document.getElementById("btnLeitorMarcador");
  const lblPag = document.getElementById("lblMarcadorPagAtual");
  const pag = state.leitor.paginaAtual || 1;
  if (lblPag) lblPag.textContent = `Pág. ${pag}`;

  const marcadores = obterMarcadoresObraAtual();
  const jaMarcada = marcadores.some(m => m.pagina === pag);

  if (btnMarcador) {
    btnMarcador.classList.toggle("marcador-ativo", jaMarcada);
    btnMarcador.title = jaMarcada
      ? `Página ${pag} marcada! Clique para remover marcador.`
      : `Fixar marcador na página ${pag}`;
  }

  const badgeCount = document.getElementById("badgeCountMarcadores");
  if (badgeCount) badgeCount.textContent = marcadores.length;
}

async function alternarMarcadorPaginaAtual(nota = "") {
  const l = state.leitor.livro;
  if (!l) return;
  const pag = state.leitor.paginaAtual;
  const marcadores = obterMarcadoresObraAtual();
  const idx = marcadores.findIndex(m => m.pagina === pag);

  if (idx !== -1) {
    marcadores.splice(idx, 1);
    showToast(`Marcador da página ${pag} removido.`);
  } else {
    marcadores.push({
      id: "mk_" + Date.now(),
      pagina: pag,
      nota: (nota || "").trim() || `Página ${pag}`,
      data: new Date().toLocaleDateString("pt-BR")
    });
    showToast(`Página ${pag} fixada nos Marcadores!`);
  }

  marcadores.sort((a, b) => a.pagina - b.pagina);
  l.progresso.marcadores = marcadores;

  await window.api?.salvarProgressoLeitura?.(l.caminho, {
    ...(l.progresso || {}),
    marcadores
  });

  atualizarIndicadorMarcadorToolbar();
  renderizarListaMarcadores();
}

async function removerMarcadorPorId(id) {
  const l = state.leitor.livro;
  if (!l) return;
  const marcadores = obterMarcadoresObraAtual();
  const idx = marcadores.findIndex(m => m.id === id);
  if (idx !== -1) {
    const pag = marcadores[idx].pagina;
    marcadores.splice(idx, 1);
    l.progresso.marcadores = marcadores;
    await window.api?.salvarProgressoLeitura?.(l.caminho, {
      ...(l.progresso || {}),
      marcadores
    });
    atualizarIndicadorMarcadorToolbar();
    renderizarListaMarcadores();
    showToast(`Marcador da página ${pag} removido.`);
  }
}

function renderizarListaMarcadores() {
  const lista = document.getElementById("listaMarcadoresLeitor");
  if (!lista) return;
  const marcadores = obterMarcadoresObraAtual();

  if (marcadores.length === 0) {
    lista.innerHTML = `
      <div class="marcador-empty">
        <span style="font-size: 2rem; display:block; margin-bottom:8px;">🔖</span>
        Nenhum marcador salvo ainda.<br>
        Clique em <strong>+ Fixar</strong> acima para salvar páginas importantes desta obra.
      </div>
    `;
    return;
  }

  lista.innerHTML = marcadores.map(m => `
    <div class="marcador-item" data-pagina="${m.pagina}">
      <div class="marcador-info" onclick="window.irParaPaginaLeitor(${m.pagina})">
        <span class="marcador-pag-badge">📖 Página ${m.pagina}</span>
        <span class="marcador-texto">${m.nota || "Sem anotação"}</span>
        <span class="marcador-data">Salvo em ${m.data}</span>
      </div>
      <button class="btn-remover-marcador" title="Excluir marcador" onclick="event.stopPropagation(); window.removerMarcadorPorId('${m.id}')">&times;</button>
    </div>
  `).join("");
}

async function exportarConversaIA(origem = "copiloto") {
  const isCopiloto = origem === "copiloto";
  const livro = isCopiloto ? state.livroSelecionado : state.leitor.livro;
  const historico = isCopiloto ? state.chatHistorico : obterHistoricoChatStorage(livro?.caminho);

  if (!historico || historico.length === 0) {
    showToast("Nenhuma conversa com o SkillBook para exportar.");
    return;
  }

  const tituloObra = livro ? (livro.tituloHumanizado || livro.titulo || livro.nome) : "EbookFinder";
  const autorObra = livro && livro.autor !== "Desconhecido" ? livro.autor : "Biblioteca Digital";
  const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  let md = `# 📚 Análise & Mentor SkillBook\n\n`;
  md += `**Obra:** ${tituloObra}  \n`;
  md += `**Autor:** ${autorObra}  \n`;
  md += `**Data da Consulta:** ${dataHoje}  \n`;
  md += `**Exportado via:** EbookFinder AI  \n\n`;
  md += `---\n\n`;

  historico.forEach((msg) => {
    if (msg.role === "user") {
      md += `### 👤 Pergunta:\n${msg.content}\n\n`;
    } else {
      md += `### ✨ SkillBook:\n${msg.content}\n\n---\n\n`;
    }
  });

  const nomeArquivo = `Analise_${tituloObra.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;

  const res = await window.api?.exportarArquivoTexto?.({
    nomeSugerido: nomeArquivo,
    conteudo: md,
    extensao: "md"
  });

  if (res?.success) {
    showToast("Análise exportada com sucesso!");
  } else if (!res?.canceled) {
    try {
      await navigator.clipboard.writeText(md);
      showToast("Análise copiada para a área de transferência!");
    } catch (e) {
      showToast("Não foi possível exportar a análise.");
    }
  }
}


window.abrirLeitorInterno = abrirLeitorInterno;
window.fecharLeitorInterno = fecharLeitorInterno;
window.mudarPaginaLeitor = mudarPaginaLeitor;
window.irParaPaginaLeitor = irParaPaginaLeitor;
window.ajustarZoom = ajustarZoom;
window.alternarBarraBuscaLeitor = alternarBarraBuscaLeitor;
window.executarBuscaNoLivro = executarBuscaNoLivro;
window.alternarFiltroLeitura = alternarFiltroLeitura;
window.aplicarFiltroLeitura = aplicarFiltroLeitura;
window.toggleSkillSidebar = toggleSkillSidebar;
window.alternarTelaCheiaLeitor = alternarTelaCheiaLeitor;
window.alternarMarcadorPaginaAtual = alternarMarcadorPaginaAtual;
window.removerMarcadorPorId = removerMarcadorPorId;
window.exportarConversaIA = exportarConversaIA;