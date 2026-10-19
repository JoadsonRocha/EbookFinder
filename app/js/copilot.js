/**
 * EbookFinder — Módulo do Copiloto IA & Tutor Book-to-Skill
 */
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
      modelo: normalizarModeloIA(cfg.model)
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

  // Adiciona balão do Tutor com cursor de digitação em streaming
  const tutorMsgEl = document.createElement("div");
  tutorMsgEl.className = "chat-msg tutor";
  tutorMsgEl.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-content"><span class="typing-cursor"></span></div>
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

  const contentEl = tutorMsgEl.querySelector(".msg-content");
  let streamedText = "";

  if (window.api?.perguntarGroqStream) {
    window.api.perguntarGroqStream({
      pergunta,
      contexto,
      historico: state.chatHistorico.slice(0, -1),
      modelo: normalizarModeloIA(cfg.model),
      onChunk: (chunk) => {
        streamedText += chunk;
        contentEl.innerHTML = formatarMarkdownSimples(streamedText) + `<span class="typing-cursor"></span>`;
        messagesArea.scrollTop = messagesArea.scrollHeight;
      },
      onDone: (full) => {
        const finalTxt = full || streamedText;
        state.chatHistorico.push({ role: "assistant", content: finalTxt });
        contentEl.innerHTML = formatarMarkdownSimples(finalTxt);
        messagesArea.scrollTop = messagesArea.scrollHeight;
      },
      onError: (err) => {
        contentEl.innerHTML = `<p style="color:#f43f5e;">⚠️ ${err || "Não foi possível obter resposta da IA."}</p>`;
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    });
  } else {
    const res = await window.api?.perguntarGroq?.({
      pergunta,
      contexto,
      historico: state.chatHistorico
    });

    if (res?.success && res.resposta) {
      state.chatHistorico.push({ role: "assistant", content: res.resposta });
      contentEl.innerHTML = formatarMarkdownSimples(res.resposta);
    } else {
      contentEl.innerHTML = `<p style="color:#f43f5e;">⚠️ ${res?.error || "Não foi possível obter resposta da IA."}</p>`;
    }
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }
}

async function abrirCopilotoIA(livro) {
  if (!livro) return;
  state.livroSelecionado = livro;

  const modal = document.getElementById("modalCopilotoIA");
  if (!modal) return;
  registrarEstadoHistorico();

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
    const temThumbCopilot = typeof livro.thumbnail === "string" && livro.thumbnail.length > 15 && livro.thumbnail !== "true" && livro.thumbnail !== "false";
    if (temThumbCopilot) {
      thumbContainer.innerHTML = `<img src="${livro.thumbnail}" alt="${tituloLimpo}" onerror="this.remove()">`;
    } else {
      thumbContainer.innerHTML = `
        <div class="theme-${paleta.tema}" style="width:100%;height:100%;background:${paleta.bg};border-left:2px solid ${paleta.borda};display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#fff;">
          📖
        </div>
      `;
    }
  }

  // Identifica o modelo ativo
  const cfg = await window.api?.obterConfigIA?.() || { apiKey: "", model: "llama-3.1-8b-instant" };
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

  // 2. Balão de Resposta do Copiloto IA (com cursor de streaming em tempo real)
  const assistantRow = document.createElement("div");
  assistantRow.className = "copilot-msg-row assistant";
  assistantRow.innerHTML = `
    <div class="copilot-msg-avatar">✨</div>
    <div class="copilot-msg-bubble">
      <div class="copilot-msg-content"><span class="typing-cursor"></span></div>
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

  const bubble = assistantRow.querySelector(".copilot-msg-bubble");
  const contentEl = assistantRow.querySelector(".copilot-msg-content");
  let streamedText = "";

  const finalizarRespostaCopiloto = (finalTxt) => {
    state.chatHistorico.push({ role: "assistant", content: finalTxt });
    salvarHistoricoChatStorage(state.livroSelecionado?.caminho, state.chatHistorico);
    contentEl.innerHTML = formatarMarkdownSimples(finalTxt);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "copilot-msg-actions";
    actionsDiv.innerHTML = `
      <button type="button" class="btn-msg-copy" title="Copiar resposta">
        <span>📋</span> <span>Copiar</span>
      </button>
    `;
    bubble.appendChild(actionsDiv);

    actionsDiv.querySelector(".btn-msg-copy")?.addEventListener("click", () => {
      navigator.clipboard.writeText(finalTxt);
      showToast("Resposta copiada para a área de transferência!");
    });

    if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
  };

  if (window.api?.perguntarGroqStream) {
    window.api.perguntarGroqStream({
      pergunta,
      contexto,
      historico: state.chatHistorico.slice(0, -1),
      modelo: normalizarModeloIA(cfg.model),
      onChunk: (chunk) => {
        streamedText += chunk;
        contentEl.innerHTML = formatarMarkdownSimples(streamedText) + `<span class="typing-cursor"></span>`;
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      },
      onDone: (full) => {
        finalizarRespostaCopiloto(full || streamedText);
      },
      onError: (err) => {
        bubble.innerHTML = `
          <p style="color:#f43f5e; font-weight:600;">⚠️ ${err || "Não foi possível obter resposta da IA."}</p>
        `;
        if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
      }
    });
  } else {
    const res = await window.api?.perguntarGroq?.({
      pergunta,
      contexto,
      historico: state.chatHistorico
    });

    if (res?.success && res.resposta) {
      finalizarRespostaCopiloto(res.resposta);
    } else {
      bubble.innerHTML = `
        <p style="color:#f43f5e; font-weight:600;">⚠️ ${res?.error || "Não foi possível obter resposta da IA."}</p>
      `;
    }
    if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
  }
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
      modelo: normalizarModeloIA(cfg.model)
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
  state.livroSelecionado.statusLeitura = status;
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
  } else if (status !== "concluidos") {
    // Se o usuário desmarcar de "concluidos" para outro status ("lendo", "quero-ler", "nenhum"),
    // e o livro estava com 100% ou com totalPaginas fictício (<= 1), ajustamos o progresso:
    if (state.livroSelecionado.progresso) {
      if (state.livroSelecionado.progresso.totalPaginas <= 1) {
        state.livroSelecionado.progresso.paginaAtual = 0;
        state.livroSelecionado.progresso.totalPaginas = 0;
        state.livroSelecionado.progresso.porcentagem = 0;
      } else if (state.livroSelecionado.progresso.porcentagem >= 100) {
        state.livroSelecionado.progresso.paginaAtual = 1;
        state.livroSelecionado.progresso.porcentagem = Math.round((1 / state.livroSelecionado.progresso.totalPaginas) * 100);
      }
      const inputPagina = document.getElementById("inputPaginaAtual");
      if (inputPagina) inputPagina.value = state.livroSelecionado.progresso.paginaAtual;
      atualizarProgressoVisual(state.livroSelecionado.progresso.paginaAtual, state.livroSelecionado.progresso.totalPaginas);
      await window.api?.salvarProgressoLeitura?.(state.livroSelecionado.caminho, {
        paginaAtual: state.livroSelecionado.progresso.paginaAtual,
        totalPaginas: state.livroSelecionado.progresso.totalPaginas,
        porcentagem: state.livroSelecionado.progresso.porcentagem,
        anotacoes: state.livroSelecionado.progresso.anotacoes || ""
      });
    }
  }

  // Sincroniza também na lista global state.todosLivros
  const idx = state.todosLivros.findIndex(l => l.caminho === state.livroSelecionado.caminho);
  if (idx !== -1) {
    state.todosLivros[idx].status = status;
    state.todosLivros[idx].statusLeitura = status;
    if (state.livroSelecionado.progresso) {
      state.todosLivros[idx].progresso = { ...state.livroSelecionado.progresso };
    }
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


window.abrirCopilotoIA = abrirCopilotoIA;
window.fecharCopilotoIA = fecharCopilotoIA;
window.enviarPerguntaCopiloto = enviarPerguntaCopiloto;
window.executarBookToSkillCopiloto = executarBookToSkillCopiloto;
window.executarBookToSkill = executarBookToSkill;
window.enviarPerguntaChat = enviarPerguntaChat;
window.atualizarStatusLeitura = atualizarStatusLeitura;