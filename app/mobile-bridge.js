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
  const DB_VERSION = 2;
  const STORE_BUFFERS = "pdf_buffers";
  const STORE_COVERS = "pdf_covers";

  // Flag global para o frontend reconhecer ambiente mobile
  window.isMobileEnvironment = true;

  // Inicializa o banco IndexedDB para armazenar PDFs binários e capas em alta resolução
  function abrirIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_BUFFERS)) {
          db.createObjectStore(STORE_BUFFERS);
        }
        if (!db.objectStoreNames.contains(STORE_COVERS)) {
          db.createObjectStore(STORE_COVERS);
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

  async function salvarCapaNoDB(id, dataUrl) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_COVERS, "readwrite");
        const store = tx.objectStore(STORE_COVERS);
        store.put(dataUrl, id);
        tx.oncomplete = () => resolve(dataUrl);
        tx.onerror = () => resolve(dataUrl);
      });
    } catch (e) {
      return dataUrl;
    }
  }

  async function obterCapaDoDB(id) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_COVERS, "readonly");
        const store = tx.objectStore(STORE_COVERS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function removerBufferDoDB(id) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_BUFFERS, "readwrite");
        const store = tx.objectStore(STORE_BUFFERS);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async function removerCapaDoDB(id) {
    try {
      const db = await abrirIndexedDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_COVERS, "readwrite");
        const store = tx.objectStore(STORE_COVERS);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  // Cache em memória de livros para acesso síncrono rápido
  let livrosSalvos = [];
  try {
    const raw = localStorage.getItem("ef_mobile_biblioteca");
    if (raw) {
      livrosSalvos = JSON.parse(raw);
      // Sanitiza livros com thumbnails booleanas antigas e corrige status preso por bug de totalPaginas fictício
      livrosSalvos.forEach(l => {
        if (typeof l.thumbnail !== "string" || l.thumbnail === "true" || l.thumbnail === "false" || l.thumbnail.length < 15) {
          l.thumbnail = null;
        }
        // Cura livros que foram importados com totalPaginas: 1 e ficaram presos em "concluidos"
        if (l.progresso && l.progresso.totalPaginas <= 1 && l.progresso.paginaAtual <= 1) {
          l.progresso.paginaAtual = 0;
          l.progresso.totalPaginas = 0;
          l.progresso.porcentagem = 0;
          if (l.status === "concluidos" || l.statusLeitura === "concluidos") {
            const statusManual = localStorage.getItem("ef_status_" + l.caminho);
            if (!statusManual || statusManual === "concluidos") {
              l.status = "nenhum";
              l.statusLeitura = "nenhum";
              try { localStorage.removeItem("ef_status_" + l.caminho); } catch (e) {}
            }
          }
        }
      });
    }
  } catch (e) {
    livrosSalvos = [];
  }

  function persistirMetadadosLivros() {
    try {
      // Salva metadados leves no localStorage para não estourar os 5MB com base64
      const metadadosLeves = livrosSalvos.map(l => {
        const clone = { ...l };
        if (clone.thumbnail && clone.thumbnail.length > 500) {
          delete clone.thumbnail;
        }
        return clone;
      });
      localStorage.setItem("ef_mobile_biblioteca", JSON.stringify(metadadosLeves));
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

  // Função privada para recuperar as credenciais reais da IA sem expor à camada DOM
  async function obterConfigIAPrivada() {
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
              status: "nenhum",
              statusLeitura: "nenhum",
              progresso: { paginaAtual: 0, totalPaginas: 0, porcentagem: 0, anotacoes: "" }
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
      if (!caminho || !dataUrl) return null;
      try {
        await salvarCapaNoDB(caminho, dataUrl);
        const livro = livrosSalvos.find(l => l.caminho === caminho);
        if (livro) {
          livro.thumbnail = dataUrl;
        }
        return dataUrl;
      } catch (e) {
        return dataUrl;
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
        livro.status = status;
        livro.statusLeitura = status;

        // Se o usuário desmarcar de "concluidos", reseta o progresso para evitar travamento em 100%
        if (status !== "concluidos" && livro.progresso) {
          if (livro.progresso.totalPaginas <= 1 || livro.progresso.porcentagem >= 100) {
            if (livro.progresso.totalPaginas <= 1) {
              livro.progresso.paginaAtual = 0;
              livro.progresso.totalPaginas = 0;
              livro.progresso.porcentagem = 0;
            } else {
              livro.progresso.paginaAtual = 1;
              livro.progresso.porcentagem = Math.round((1 / livro.progresso.totalPaginas) * 100);
            }
            try {
              localStorage.setItem("ef_progresso_" + caminho, JSON.stringify(livro.progresso));
            } catch (e) {}
          }
        }
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
        // SÓ marca como concluído automaticamente se o livro tiver mais de 1 página e atingir o fim
        if (dados.totalPaginas > 1 && dados.paginaAtual >= dados.totalPaginas && dados.porcentagem >= 100) {
          livro.status = "concluidos";
          livro.statusLeitura = "concluidos";
        } else if (dados.paginaAtual > 1 && dados.totalPaginas > 1 && (!livro.status || livro.status === "nenhum")) {
          livro.status = "lendo";
          livro.statusLeitura = "lendo";
        }
        persistirMetadadosLivros();
      }
      try {
        localStorage.setItem("ef_progresso_" + caminho, JSON.stringify(dados));
        if (livro?.status) {
          localStorage.setItem("ef_status_" + caminho, livro.status);
        }
      } catch (e) {}
      return {
        ...dados,
        status: livro?.status || "nenhum"
      };
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
      // Garante que cada livro recupera seu status, progresso e capa do IndexedDB
      for (const l of livrosSalvos) {
        if (!l.status || l.status === "nenhum") {
          l.status = l.statusLeitura || localStorage.getItem("ef_status_" + l.caminho) || "nenhum";
        }
        if (!l.progresso) {
          try {
            const rawP = localStorage.getItem("ef_progresso_" + l.caminho);
            if (rawP) l.progresso = JSON.parse(rawP);
          } catch (e) {}
        }
        if (!l.progresso) {
          l.progresso = { paginaAtual: 0, totalPaginas: 0, porcentagem: 0, anotacoes: "" };
        } else if (l.progresso.totalPaginas <= 1 && l.progresso.paginaAtual <= 1 && l.status !== "concluidos") {
          l.progresso.paginaAtual = 0;
          l.progresso.totalPaginas = 0;
          l.progresso.porcentagem = 0;
        }

        if (!l.thumbnail || typeof l.thumbnail !== "string" || l.thumbnail === "true" || l.thumbnail === "false" || l.thumbnail.length < 15) {
          const capaDB = await obterCapaDoDB(l.caminho);
          if (capaDB) {
            l.thumbnail = capaDB;
          } else {
            l.thumbnail = null;
          }
        }
      }

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

    exportarArquivoTexto: async ({ nomeSugerido = "analise.md", conteudo = "" }) => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: nomeSugerido,
            text: conteudo
          });
          return { success: true };
        }
      } catch (e) {}

      try {
        const blob = new Blob([conteudo], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomeSugerido;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    obterConfigIA: async () => {
      const privada = await obterConfigIAPrivada();
      const hasKey = Boolean(privada.apiKey && privada.apiKey.trim());
      return {
        ...privada,
        hasKey,
        apiKey: hasKey ? "••••••••" : "" // Proteção absoluta: nunca envia a chave em texto plano para a tela
      };
    },

    salvarConfigIA: async (config) => {
      try {
        let configAtual = {};
        try {
          const raw = localStorage.getItem("ef_ia_config");
          if (raw) configAtual = JSON.parse(raw) || {};
        } catch (e) {}

        const novaChave = (config.apiKey || "").trim();
        const chaveFinal = (novaChave && !novaChave.includes("•")) ? novaChave : (configAtual.apiKey || "");

        const cfgFinal = {
          apiKey: chaveFinal,
          model: config.model || configAtual.model || "openai/gpt-oss-20b"
        };
        localStorage.setItem("ef_ia_config", JSON.stringify(cfgFinal));
        return true;
      } catch (e) {
        return false;
      }
    },

    testarConexaoGroq: async (apiKey) => {
      try {
        const inputKey = (apiKey || "").trim();
        const cfg = await obterConfigIAPrivada();
        const key = (inputKey && !inputKey.includes("•") ? inputKey : cfg.apiKey || "").trim();
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
        const cfg = await obterConfigIAPrivada();
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

    perguntarGroqStream: async ({ pergunta, contexto, historico = [], modelo = null, onChunk, onDone, onError }) => {
      try {
        const cfg = await obterConfigIAPrivada();
        const key = (cfg.apiKey || "").trim();
        if (!key) {
          if (onError) onError("Chave da API não configurada.");
          return;
        }

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
            max_tokens: 1800,
            stream: true
          })
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody.error?.message || `Erro HTTP ${res.status}`;
          if (onError) onError(errMsg);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed === "data: [DONE]") {
              break;
            }
            if (trimmed.startsWith("data: ")) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content || "";
                if (delta) {
                  fullText += delta;
                  if (onChunk) onChunk(delta);
                }
              } catch (e) {
                // Fragmento incompleto
              }
            }
          }
        }

        if (onDone) onDone(fullText);
      } catch (err) {
        if (onError) onError(err.message || "Erro de conexão ao transmitir resposta.");
      }
    },

    removerLivro: async (caminho) => {
      if (!caminho) return false;
      try {
        await removerBufferDoDB(caminho);
        await removerCapaDoDB(caminho);
        localStorage.removeItem("ef_status_" + caminho);
        localStorage.removeItem("ef_progresso_" + caminho);
        localStorage.removeItem("ef_skill_" + caminho);
        localStorage.removeItem("ef_chat_" + caminho);

        livrosSalvos = livrosSalvos.filter(l => l.caminho !== caminho);
        persistirMetadadosLivros();
        return true;
      } catch (e) {
        console.error("Erro ao remover livro mobile:", e);
        return false;
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

    abrirPastaSkill: async () => false,

    exportarArquivoTexto: async ({ nomeSugerido, conteudo, extensao = "md" }) => {
      if (!conteudo) return { success: false, error: "Conteúdo vazio" };
      const nomeFinal = nomeSugerido || `Analise_SkillBook.${extensao || "md"}`;

      if (navigator.share) {
        try {
          const file = new File([conteudo], nomeFinal, { type: "text/markdown;charset=utf-8" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: nomeFinal,
              text: `Exportação de Análise EbookFinder: ${nomeFinal}`
            });
            return { success: true, compartilhado: true };
          } else {
            await navigator.share({
              title: nomeFinal,
              text: conteudo
            });
            return { success: true, compartilhado: true };
          }
        } catch (shareErr) {
          if (shareErr.name === "AbortError") {
            return { success: false, canceled: true };
          }
        }
      }

      try {
        const blob = new Blob([conteudo], { type: "text/markdown;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = nomeFinal;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        return { success: true, download: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  };
})();
