/**
 * ============================================================================
 * EbookFinder - Mobile Bridge (Ponte de Compatibilidade para Capacitor / Web)
 * ============================================================================
 * @description Substitui a camada de IPC do Electron quando o app roda no
 *              celular (Capacitor) ou navegador web, utilizando localStorage,
 *              IndexedDB e chamadas diretas à API da Groq.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

(function () {
  // Se já estiver rodando dentro do Electron com window.api injetada pelo preload, não faz nada
  if (window.api) {
    console.log("⚡ [Bridge] Ambiente Electron detectado. Usando IPC nativo.");
    return;
  }

  console.log("📱 [Bridge] Ambiente Mobile/Web detectado. Ativando Mobile Bridge.");

  // Memória local de arquivos carregados na sessão mobile
  const bibliotecaMobile = {
    livros: [],
    buffers: new Map() // caminho/id -> Uint8Array
  };

  // Inicializa livros salvos no localStorage
  try {
    const salvos = localStorage.getItem("ef_mobile_biblioteca");
    if (salvos) {
      bibliotecaMobile.livros = JSON.parse(salvos);
    }
  } catch (e) {
    console.warn("Aviso ao carregar biblioteca mobile salva:", e);
  }

  function salvarBibliotecaLocal() {
    try {
      localStorage.setItem("ef_mobile_biblioteca", JSON.stringify(bibliotecaMobile.livros));
    } catch (e) {}
  }

  // Seletor invisível de arquivos para mobile
  let fileInput = null;
  function obterFileInput() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.accept = ".pdf,.epub,.mobi,.cbz,.cbr";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
    }
    return fileInput;
  }

  // Cria a API mock compatível com o renderer.js
  window.api = {
    getPastaAtual: async () => {
      return "📱 Armazenamento do Dispositivo";
    },

    escolherPasta: async () => {
      return window.api.escolherArquivos();
    },

    escolherArquivos: () => {
      return new Promise((resolve) => {
        const input = obterFileInput();
        input.onchange = async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) {
            resolve({ canceled: true, filePaths: [] });
            return;
          }

          const caminhos = [];
          for (const file of files) {
            const id = "mobile_" + file.name + "_" + file.size;
            const buffer = await file.arrayBuffer();
            const uint8 = new Uint8Array(buffer);
            bibliotecaMobile.buffers.set(id, uint8);

            const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
            const novoLivro = {
              caminho: id,
              nome: file.name,
              titulo: file.name.replace(/\.[^/.]+$/, ""),
              tituloHumanizado: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
              autor: "Desconhecido",
              tamanho: file.size,
              dataModificacao: new Date(file.lastModified).toISOString(),
              extensao: ext,
              statusLeitura: "nenhum",
              progresso: { paginaAtual: 1, totalPaginas: 1, porcentagem: 0, anotacoes: "" }
            };

            // Evita duplicatas
            const idx = bibliotecaMobile.livros.findIndex(l => l.caminho === id);
            if (idx >= 0) {
              bibliotecaMobile.livros[idx] = novoLivro;
            } else {
              bibliotecaMobile.livros.push(novoLivro);
            }
            caminhos.push(id);
          }

          salvarBibliotecaLocal();
          input.value = "";
          resolve({ canceled: false, filePaths: caminhos });
        };
        input.click();
      });
    },

    definirPasta: async () => {
      return "📱 Armazenamento do Dispositivo";
    },

    definirPastaDireta: async () => {
      return "📱 Armazenamento do Dispositivo";
    },

    lerArquivoBuffer: async (caminho) => {
      if (!caminho) return null;
      if (bibliotecaMobile.buffers.has(caminho)) {
        return bibliotecaMobile.buffers.get(caminho);
      }
      return null;
    },

    salvarCapaCache: async (caminho, dataUrl) => {
      try {
        localStorage.setItem("ef_cover_" + caminho, dataUrl);
        return true;
      } catch (e) {
        return false;
      }
    },

    obterStatusSistema: async () => {
      return {
        sistema: "Capacitor Mobile",
        versaoElectron: "N/A (Mobile)",
        versaoNode: "N/A",
        plataforma: navigator.userAgent
      };
    },

    salvarStatusLeitura: async (caminho, status) => {
      const livro = bibliotecaMobile.livros.find(l => l.caminho === caminho);
      if (livro) {
        livro.statusLeitura = status;
        salvarBibliotecaLocal();
      }
      try {
        localStorage.setItem("ef_status_" + caminho, status);
      } catch (e) {}
      return status;
    },

    salvarProgressoLeitura: async (caminho, dados) => {
      const livro = bibliotecaMobile.livros.find(l => l.caminho === caminho);
      if (livro) {
        livro.progresso = { ...(livro.progresso || {}), ...dados };
        salvarBibliotecaLocal();
      }
      try {
        localStorage.setItem("ef_progresso_" + caminho, JSON.stringify(dados));
      } catch (e) {}
      return dados;
    },

    obterProgressoLeitura: async (caminho) => {
      try {
        const raw = localStorage.getItem("ef_progresso_" + caminho);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    buscarEbooks: async (termo = "") => {
      const termoLower = (termo || "").toLowerCase().trim();
      if (!termoLower) return bibliotecaMobile.livros;
      return bibliotecaMobile.livros.filter(l => 
        (l.titulo && l.titulo.toLowerCase().includes(termoLower)) ||
        (l.autor && l.autor.toLowerCase().includes(termoLower)) ||
        (l.nome && l.nome.toLowerCase().includes(termoLower))
      );
    },

    abrirNoWindows: async (caminho) => {
      // No mobile, abre direto no leitor interno
      const livro = bibliotecaMobile.livros.find(l => l.caminho === caminho);
      if (livro && window.abrirLeitorInterno) {
        window.abrirLeitorInterno(livro);
      }
    },

    revelarNoExplorer: async () => {
      return true;
    },

    openExternal: async (url) => {
      if (url) window.open(url, "_blank");
    },

    obterConfigIA: async () => {
      try {
        const raw = localStorage.getItem("ef_ia_config");
        if (raw) return JSON.parse(raw);
        // Busca de bundle local se disponível (ignorado pelo git)
        const res = await fetch("ia_config_bundle.json").catch(() => null);
        if (res && res.ok) {
          const bundle = await res.json().catch(() => null);
          if (bundle && bundle.apiKey) {
            return { apiKey: bundle.apiKey.trim(), model: bundle.model || "openai/gpt-oss-20b", isBundled: true };
          }
        }
      } catch (e) {}
      return {
        apiKey: "",
        model: "openai/gpt-oss-20b",
        isBundled: false
      };
    },

    salvarConfigIA: async (config) => {
      try {
        localStorage.setItem("ef_ia_config", JSON.stringify(config));
        return true;
      } catch (e) {
        return false;
      }
    },

    testarConexaoGroq: async (apiKey) => {
      try {
        const key = (apiKey || (await window.api.obterConfigIA()).apiKey || "").trim();
        if (!key) return { success: false, error: "Chave de API não informada." };

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 2
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          return { success: false, error: errBody.error?.message || `Erro HTTP ${res.status}` };
        }

        return { success: true };
      } catch (err) {
        return { success: false, error: err.message || "Erro de conexão com a API Groq." };
      }
    },

    perguntarGroq: async ({ pergunta, contexto, historico = [], modelo = null }) => {
      try {
        const cfg = await window.api.obterConfigIA();
        const key = (cfg.apiKey || "").trim();
        if (!key) return { success: false, error: "Chave da API não configurada." };

        const modelToUse = modelo || cfg.model || "openai/gpt-oss-20b";
        const systemPrompt = `Você é o SkillBook, a inteligência artificial especialista e mentora de leitura integrada ao EbookFinder.
Seu papel é responder com máxima clareza, profundidade pedagógica e excelência analítica sobre a obra que o leitor está explorando.
Responda sempre em Português do Brasil com primorosa formatação Markdown.

${contexto ? `--- CONTEXTO DA OBRA ---\n${contexto}\n-----------------------` : ""}`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...historico.slice(-6).map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: pergunta }
        ];

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            temperature: 0.35,
            max_tokens: 1800
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          return { success: false, error: errBody.error?.message || `Erro HTTP ${res.status}` };
        }

        const data = await res.json();
        const resposta = data.choices?.[0]?.message?.content || "Sem resposta da IA.";
        return { success: true, resposta };
      } catch (err) {
        return { success: false, error: err.message || "Erro ao consultar a API." };
      }
    },

    obterSkillLivro: async (caminho) => {
      try {
        const raw = localStorage.getItem("ef_skill_" + caminho);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    salvarSkillLivro: async ({ caminho, titulo, slug, skillMd, cheatsheet, glossary }) => {
      try {
        const dados = { titulo, slug, skillMd, cheatsheet, glossary, atualizadoEm: new Date().toISOString() };
        localStorage.setItem("ef_skill_" + caminho, JSON.stringify(dados));
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    detectarLocaisDrive: async () => [],

    exportarSkillLivro: async ({ titulo, caminho }) => {
      const skill = await window.api.obterSkillLivro(caminho);
      if (!skill) return { success: false, error: "Skill não encontrada." };
      
      // No mobile/web, baixa o arquivo SKILL.md
      const blob = new Blob([skill.skillMd || ""], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `SKILL-${titulo || "obra"}.md`;
      a.click();
      return { success: true };
    },

    abrirPastaSkill: async () => false
  };
})();
