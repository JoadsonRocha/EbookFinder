/**
 * ============================================================================
 * EbookFinder - Mobile Bridge (Ponte de Compatibilidade para Capacitor / Web)
 * ============================================================================
 * @description Substitui a camada de IPC do Electron quando o app roda no
 *              celular (Capacitor) ou navegador web, utilizando IndexedDB para
 *              armazenamento binário de PDFs, localStorage e chamadas diretas
 *              à API da Groq.
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

  console.log("📱 [Bridge] Ambiente Mobile/Web detectado. Ativando Mobile Bridge com IndexedDB.");

  const NOME_PASTA_MOBILE = "📱 Armazenamento Local";
  const DB_NAME = "EbookFinderMobileDB";
  const DB_VERSION = 1;
  const STORE_BUFFERS = "pdf_buffers";

  // Inicializa o banco IndexedDB para armazenar PDFs binários
  function abrirIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BUFFERS)) {
          db.createObjectStore(STORE_BUFFERS);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function salvarBufferNoDB(id, buffer) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BUFFERS, "readwrite");
        const store = tx.objectStore(STORE_BUFFERS);
        store.put(buffer, id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("❌ Erro ao salvar buffer no IndexedDB:", e);
      return false;
    }
  }

  async function obterBufferDoDB(id) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BUFFERS, "readonly");
        const store = tx.objectStore(STORE_BUFFERS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error("❌ Erro ao recuperar buffer do IndexedDB:", e);
      return null;
    }
  }

  // Cache em memória de livros para acesso síncrono rápido
  let livrosSalvos = [];
  try {
    const raw = localStorage.getItem("ef_mobile_biblioteca");
    if (raw) livrosSalvos = JSON.parse(raw);
  } catch (e) {
    livrosSalvos = [];
  }

  function persistirMetadadosLivros() {
    try {
      localStorage.setItem("ef_mobile_biblioteca", JSON.stringify(livrosSalvos));
    } catch (e) {
      console.warn("Aviso ao salvar metadados dos livros:", e);
    }
  }

  // Cria ou reaproveita o seletor nativo de arquivos do celular
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

  // API COMPLETA COMPATÍVEL COM O RENDERER.JS
  window.api = {
    getPastaAtual: async () => NOME_PASTA_MOBILE,

    escolherPasta: async () => window.api.escolherArquivos(),

    escolherArquivos: () => {
      return new Promise((resolve) => {
        const input = obterFileInput();
        input.onchange = async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) {
            resolve(livrosSalvos.length > 0 ? NOME_PASTA_MOBILE : null);
            return;
          }

          for (const file of files) {
            // Cria um identificador único e consistente para o arquivo
            const id = "mobile_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_") + "_" + file.size;
            const arrayBuffer = await file.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);

            // Grava o arquivo binário no IndexedDB
            await salvarBufferNoDB(id, uint8);

            const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
            const nomeSemExt = file.name.replace(/\.[^/.]+$/, "");
            const novoLivro = {
              caminho: id,
              nome: file.name,
              titulo: nomeSemExt,
              tituloHumanizado: nomeSemExt.replace(/[-_]/g, " "),
              autor: "Desconhecido",
              tamanho: file.size,
              dataModificacao: new Date(file.lastModified || Date.now()).toISOString(),
              extensao: ext,
              statusLeitura: "nenhum",
              progresso: { paginaAtual: 1, totalPaginas: 1, porcentagem: 0, anotacoes: "" }
            };

            const idx = livrosSalvos.findIndex(l => l.caminho === id);
            if (idx >= 0) {
              livrosSalvos[idx] = novoLivro;
            } else {
              livrosSalvos.push(novoLivro);
            }
          }

          persistirMetadadosLivros();
          input.value = "";
          // Retorna o nome da pasta para o renderer.js atualizar o estado
          resolve(NOME_PASTA_MOBILE);
        };
        input.click();
      });
    },

    definirPasta: async () => NOME_PASTA_MOBILE,
    definirPastaDireta: async () => NOME_PASTA_MOBILE,

    lerArquivoBuffer: async (caminho) => {
      if (!caminho) return null;
      const buffer = await obterBufferDoDB(caminho);
      return buffer;
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
        pastaAtual: livrosSalvos.length > 0 ? NOME_PASTA_MOBILE : null,
        sistema: "Capacitor Mobile",
        versaoElectron: "N/A (Mobile)",
        versaoNode: "N/A",
        plataforma: navigator.userAgent
      };
    },

    salvarStatusLeitura: async (caminho, status) => {
      const livro = livrosSalvos.find(l => l.caminho === caminho);
      if (livro) {
        livro.statusLeitura = status;
        persistirMetadadosLivros();
      }
      try {
        localStorage.setItem("ef_status_" + caminho, status);
      } catch (e) {}
      return status;
    },

    salvarProgressoLeitura: async (caminho, dados) => {
      const livro = livrosSalvos.find(l => l.caminho === caminho);
      if (livro) {
        livro.progresso = { ...(livro.progresso || {}), ...dados };
        persistirMetadadosLivros();
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
      if (!termoLower) return livrosSalvos;
      return livrosSalvos.filter(l => 
        (l.titulo && l.titulo.toLowerCase().includes(termoLower)) ||
        (l.autor && l.autor.toLowerCase().includes(termoLower)) ||
        (l.nome && l.nome.toLowerCase().includes(termoLower))
      );
    },

    abrirNoWindows: async (caminho) => {
      const livro = livrosSalvos.find(l => l.caminho === caminho);
      if (livro && window.abrirLeitorInterno) {
        window.abrirLeitorInterno(livro);
      }
    },

    revelarNoExplorer: async () => true,

    openExternal: async (url) => {
      if (url) window.open(url, "_blank");
    },

    obterConfigIA: async () => {
      try {
        const raw = localStorage.getItem("ef_ia_config");
        if (raw) return JSON.parse(raw);
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
        const cfg = await window.api.obterConfigIA();
        const key = (apiKey || cfg.apiKey || "").trim();
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
