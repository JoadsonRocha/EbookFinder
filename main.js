/**
 * ============================================================================
 * EbookFinder - Processo Principal (Electron Main Process)
 * ============================================================================
 * @description Gerencia o ciclo de vida do aplicativo, leitura de e-books locais
 *              (.epub, .pdf, .mobi, .cbr, .cbz, .azw3, .fb2), extração ultrarrápida
 *              de capas e metadados via ZIP e canais IPC seguros.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Tenta importar adm-zip de forma segura com fallback caso ainda não esteja instalado
let AdmZip = null;
try {
  AdmZip = require("adm-zip");
} catch (e) {
  console.warn("⚠️ adm-zip ainda não instalado. Rode 'npm install' para extração automática de capas.");
}

// ============================================================================
// 1. DIRETÓRIOS E CONFIGURAÇÃO PERSISTENTE
// ============================================================================

app.name = "EbookFinder";
const userDataPath = path.join(app.getPath("appData"), "EbookFinder");
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath("userData", userDataPath);

// Pasta para armazenamento em cache das capas dos livros
const thumbsDir = path.join(userDataPath, "thumbs");
if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Pasta para armazenamento das Skills de IA dos livros
const skillsDir = path.join(userDataPath, "skills");
if (!fs.existsSync(skillsDir)) {
  fs.mkdirSync(skillsDir, { recursive: true });
}

// Arquivo de configuração da IA (Groq)
const iaConfigFile = path.join(userDataPath, "ia_config.json");

function obterConfigIA() {
  if (fs.existsSync(iaConfigFile)) {
    try {
      return JSON.parse(fs.readFileSync(iaConfigFile, "utf8")) || { apiKey: "", model: "llama-3.3-70b-versatile" };
    } catch (e) {
      console.error("❌ Erro ao ler ia_config.json:", e);
    }
  }
  return { apiKey: "", model: "llama-3.3-70b-versatile" };
}

function salvarConfigIA(cfg) {
  try {
    fs.writeFileSync(iaConfigFile, JSON.stringify(cfg, null, 2));
    return true;
  } catch (e) {
    console.error("❌ Erro ao gravar ia_config.json:", e);
    return false;
  }
}

// Arquivo de configuração da pasta de livros
const pastaConfigFile = path.join(userDataPath, "pasta_ebooks.json");
let pastaEbooks = null;

// Tenta ler do diretório oficial ou de diretórios legados
const possiveisCaminhosConfig = [
  pastaConfigFile,
  path.join(app.getPath("appData"), "ebookfinder", "pasta_ebooks.json"),
  path.join(app.getPath("appData"), "Electron", "pasta_ebooks.json")
];

for (const cfg of possiveisCaminhosConfig) {
  if (fs.existsSync(cfg)) {
    try {
      const data = JSON.parse(fs.readFileSync(cfg, "utf8"));
      if (data.pasta && fs.existsSync(data.pasta)) {
        pastaEbooks = data.pasta;
        console.log("📖 Pasta de e-books carregada:", pastaEbooks);
        break;
      }
    } catch (e) {
      console.error("❌ Erro ao ler", cfg, e);
    }
  }
}

/**
 * Salva a pasta de e-books selecionada pelo usuário.
 * @param {string} novaPasta - Caminho absoluto
 */
function salvarPasta(novaPasta) {
  pastaEbooks = novaPasta;
  try {
    fs.writeFileSync(pastaConfigFile, JSON.stringify({ pasta: novaPasta }, null, 2));
    console.log("✅ Nova pasta de e-books salva:", novaPasta);
  } catch (err) {
    console.error("❌ Falha ao gravar pasta_ebooks.json:", err);
  }
}

// Arquivo para armazenar status de leitura das obras
const estanteConfigFile = path.join(app.getPath("userData"), "estante.json");
let estanteStatus = {};

if (fs.existsSync(estanteConfigFile)) {
  try {
    estanteStatus = JSON.parse(fs.readFileSync(estanteConfigFile, "utf8")) || {};
  } catch (e) {
    estanteStatus = {};
  }
}

function salvarStatusObra(caminho, status) {
  estanteStatus[caminho] = status;
  try {
    fs.writeFileSync(estanteConfigFile, JSON.stringify(estanteStatus, null, 2));
  } catch (e) {
    console.error("❌ Erro ao salvar status da obra:", e);
  }
}

// Arquivo para armazenar progresso detalhado de leitura (páginas, marcador, notas)
const progressoConfigFile = path.join(app.getPath("userData"), "progresso_leitura.json");
let progressoLeitura = {};

if (fs.existsSync(progressoConfigFile)) {
  try {
    progressoLeitura = JSON.parse(fs.readFileSync(progressoConfigFile, "utf8")) || {};
  } catch (e) {
    progressoLeitura = {};
  }
}

/**
 * Salva o progresso de leitura de um livro (página atual, total, anotações, timestamp).
 */
function salvarProgressoObra(caminho, dados) {
  if (!caminho || !dados) return false;

  const paginaAtual = Math.max(0, parseInt(dados.paginaAtual, 10) || 0);
  const totalPaginas = Math.max(0, parseInt(dados.totalPaginas, 10) || 0);
  const porcentagem = totalPaginas > 0
    ? Math.min(100, Math.max(0, Math.round((paginaAtual / totalPaginas) * 100)))
    : 0;

  progressoLeitura[caminho] = {
    paginaAtual,
    totalPaginas,
    porcentagem,
    anotacoes: typeof dados.anotacoes === "string" ? dados.anotacoes.trim() : "",
    ultimaLeituraEm: Date.now()
  };

  try {
    fs.writeFileSync(progressoConfigFile, JSON.stringify(progressoLeitura, null, 2));
  } catch (e) {
    console.error("❌ Erro ao salvar progresso de leitura:", e);
  }

  // Transição inteligente do status da estante:
  const statusAtual = estanteStatus[caminho] || "nenhum";
  if (totalPaginas > 0 && paginaAtual >= totalPaginas) {
    if (statusAtual !== "concluidos") {
      salvarStatusObra(caminho, "concluidos");
    }
  } else if (paginaAtual > 0 && (statusAtual === "nenhum" || statusAtual === "quero-ler")) {
    salvarStatusObra(caminho, "lendo");
  }

  return {
    ...progressoLeitura[caminho],
    status: estanteStatus[caminho] || "nenhum"
  };
}

/**
 * Helper rápido para tentar extrair contagem de páginas de PDFs sem dependências pesadas.
 */
function extrairTotalPaginasPdf(caminhoPdf) {
  try {
    const fd = fs.openSync(caminhoPdf, "r");
    const stat = fs.fstatSync(fd);
    const bufferTamanho = Math.min(stat.size, 65536);
    const buffer = Buffer.alloc(bufferTamanho);
    fs.readSync(fd, buffer, 0, bufferTamanho, 0);
    let texto = buffer.toString("latin1");

    let match = texto.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/i) || texto.match(/\/Count\s+(\d+)[^>]*\/Type\s*\/Pages/i);
    if (!match && stat.size > 65536) {
      const finalOffset = Math.max(0, stat.size - 65536);
      fs.readSync(fd, buffer, 0, bufferTamanho, finalOffset);
      texto = buffer.toString("latin1");
      match = texto.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/i) || texto.match(/\/Count\s+(\d+)[^>]*\/Type\s*\/Pages/i);
    }
    fs.closeSync(fd);

    if (match && match[1]) {
      const paginas = parseInt(match[1], 10);
      if (paginas > 0 && paginas < 50000) return paginas;
    }
  } catch (err) {}
  return 0;
}

// ============================================================================
// 2. CRIAÇÃO DA JANELA PRINCIPAL
// ============================================================================

let mainWindow = null;

function createWindow() {
  const appPath = path.join(__dirname, "app");
  const iconePath = fs.existsSync(path.join(appPath, "ebookFinder.ico"))
    ? path.join(appPath, "ebookFinder.ico")
    : path.join(__dirname, "ebookFinder.ico");

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: "#0e0d16",
    show: false,
    icon: iconePath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(appPath, "index.html")).catch(err => {
    console.error("❌ Falha ao carregar index.html:", err);
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================================================
// 3. EXTRAÇÃO DE METADADOS E CAPAS (EPUB / CBZ / PDF)
// ============================================================================

const EXTENSOES_EBOOKS = [
  ".epub", ".pdf", ".mobi", ".cbr", ".cbz",
  ".azw", ".azw3", ".fb2", ".txt"
];

function gerarHashCaminho(caminho) {
  return crypto.createHash("md5").update(caminho.toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Extrai a capa e metadados de um arquivo EPUB lendo o container ZIP interno.
 * @param {string} caminhoEpub - Caminho do arquivo .epub
 * @param {string} pastaDestino - Onde salvar a capa extraída
 * @param {string} nomeCapa - Nome do arquivo de capa
 * @returns {{ autor: string, titulo: string, capaExtraida: boolean }}
 */
function processarEpub(caminhoEpub, pastaDestino, nomeCapa) {
  let resultado = { autor: "", titulo: "", capaExtraida: false };
  if (!AdmZip) return resultado;

  try {
    const zip = new AdmZip(caminhoEpub);
    const containerEntry = zip.getEntry("META-INF/container.xml");
    if (!containerEntry) return resultado;

    const containerXml = containerEntry.getData().toString("utf8");
    const opfMatch = containerXml.match(/full-path=["']([^"']+\.opf)["']/i);
    if (!opfMatch) return resultado;

    const opfPath = opfMatch[1];
    const opfDir = path.posix.dirname(opfPath);
    const opfEntry = zip.getEntry(opfPath);
    if (!opfEntry) return resultado;

    const opfContent = opfEntry.getData().toString("utf8");

    // Extrai Título
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) resultado.titulo = titleMatch[1].trim();

    // Extrai Autor
    const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    if (creatorMatch) resultado.autor = creatorMatch[1].trim();

    // Extrai Capa (Cover Image)
    const capaDestino = path.join(pastaDestino, nomeCapa);
    if (fs.existsSync(capaDestino)) {
      resultado.capaExtraida = true;
      return resultado;
    }

    // Busca por id="cover" ou properties="cover-image"
    let coverHref = null;
    const itemMatch = opfContent.match(/<item[^>]+(?:id=["'][^"']*cover[^"']*["']|properties=["'][^"']*cover-image[^"']*["'])[^>]+href=["']([^"']+)["']/i)
      || opfContent.match(/<item[^>]+href=["']([^"']+)["'][^>]+(?:id=["'][^"']*cover[^"']*["']|properties=["'][^"']*cover-image[^"']*["'])/i);

    if (itemMatch) {
      coverHref = itemMatch[1];
    } else {
      // Tenta achar elemento meta name="cover"
      const metaCoverMatch = opfContent.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i);
      if (metaCoverMatch) {
        const coverId = metaCoverMatch[1];
        const refItem = opfContent.match(new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["']`, "i"));
        if (refItem) coverHref = refItem[1];
      }
    }

    if (coverHref) {
      const fullCoverPath = opfDir === "." ? coverHref : path.posix.join(opfDir, coverHref);
      const coverEntry = zip.getEntry(fullCoverPath) || zip.getEntry(decodeURIComponent(fullCoverPath));
      if (coverEntry) {
        fs.writeFileSync(capaDestino, coverEntry.getData());
        resultado.capaExtraida = true;
      }
    }
  } catch (err) {
    // Falha silenciosa no zip, continua com fallback visual
  }

  return resultado;
}

/**
 * Extrai a primeira imagem de um arquivo CBZ (Histórias em Quadrinhos) e conta páginas.
 */
function processarCbz(caminhoCbz, pastaDestino, nomeCapa) {
  let resultado = { temCapa: false, totalPaginas: 0 };
  if (!AdmZip) return resultado;
  const capaDestino = path.join(pastaDestino, nomeCapa);
  resultado.temCapa = fs.existsSync(capaDestino);

  try {
    const zip = new AdmZip(caminhoCbz);
    const entries = zip.getEntries();
    const imageEntries = entries
      .filter(e => !e.isDirectory && /\.(jpe?g|png|webp)$/i.test(e.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    resultado.totalPaginas = imageEntries.length;

    if (!resultado.temCapa && imageEntries.length > 0) {
      fs.writeFileSync(capaDestino, imageEntries[0].getData());
      resultado.temCapa = true;
    }
  } catch (err) {}
  return resultado;
}

/**
 * Varre o diretório e coleta os livros digitais.
 */
function buscarEbooksNaPasta(dir, termo = "", recursivo = true) {
  if (!dir || !fs.existsSync(dir)) return [];

  const termoLower = termo ? termo.toLowerCase() : "";
  const resultados = [];
  const pastasIgnoradas = new Set([
    ".git", "node_modules", "$recycle.bin", "system volume information",
    "dist", "build", ".vscode", ".idea"
  ]);

  function lerDiretorio(caminhoAtual) {
    try {
      const entradas = fs.readdirSync(caminhoAtual, { withFileTypes: true });

      for (const entrada of entradas) {
        // Ignora pastas ocultas e de sistema
        if (entrada.isDirectory()) {
          const nomeLower = entrada.name.toLowerCase();
          if (pastasIgnoradas.has(nomeLower) || (entrada.name.startsWith(".") && entrada.name.length > 1)) {
            continue;
          }
          if (recursivo) {
            lerDiretorio(path.join(caminhoAtual, entrada.name));
          }
        } else if (entrada.isFile()) {
          const ext = path.extname(entrada.name).toLowerCase();
          if (EXTENSOES_EBOOKS.includes(ext)) {
            const baseNome = path.basename(entrada.name, ext);

            if (!termoLower || entrada.name.toLowerCase().includes(termoLower)) {
              let tamanho = 0;
              let modificadoEm = 0;
              try {
                const stat = fs.statSync(path.join(caminhoAtual, entrada.name));
                tamanho = stat.size;
                modificadoEm = stat.mtimeMs;
              } catch (e) {}

              const caminhoCompleto = path.join(caminhoAtual, entrada.name);
              const prog = progressoLeitura[caminhoCompleto] || {
                paginaAtual: 0,
                totalPaginas: 0,
                porcentagem: 0,
                anotacoes: "",
                ultimaLeituraEm: null
              };

              let totalPaginasDetectado = prog.totalPaginas || 0;
              if (!totalPaginasDetectado && ext === ".pdf") {
                totalPaginasDetectado = extrairTotalPaginasPdf(caminhoCompleto);
              }

              resultados.push({
                nome: entrada.name,
                titulo: baseNome,
                autor: "Desconhecido",
                caminho: caminhoCompleto,
                extensao: ext,
                tamanho,
                modificadoEm,
                status: estanteStatus[caminhoCompleto] || "nenhum",
                progresso: {
                  ...prog,
                  totalPaginas: prog.totalPaginas || totalPaginasDetectado || 0
                }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Erro ao ler pasta de e-books:", err);
    }
  }

  lerDiretorio(dir);
  return resultados;
}

// ============================================================================
// 4. CANAIS IPC
// ============================================================================

ipcMain.handle("get-pasta-atual", () => pastaEbooks);

ipcMain.handle("escolher-pasta", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione a pasta de livros e documentos",
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths.length) return null;
  salvarPasta(result.filePaths[0]);
  return pastaEbooks;
});

ipcMain.handle("escolher-arquivos", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione arquivos PDF ou outros e-books",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Livros e Documentos Digitais", extensions: ["pdf", "epub", "mobi", "cbr", "cbz", "azw", "azw3", "fb2", "txt"] }
    ]
  });

  if (result.canceled || !result.filePaths.length) return null;
  const pastaDoArquivo = path.dirname(result.filePaths[0]);
  salvarPasta(pastaDoArquivo);
  return pastaEbooks;
});

ipcMain.handle("ler-arquivo-buffer", async (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return null;
  try {
    return fs.readFileSync(caminho);
  } catch (err) {
    return null;
  }
});

ipcMain.handle("salvar-capa-cache", async (e, caminho, dataUrl) => {
  if (!caminho || !dataUrl) return false;
  try {
    const hash = gerarHashCaminho(caminho);
    const nomeCapa = `${hash}_cover.jpg`;
    const capaCompleta = path.join(thumbsDir, nomeCapa);
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(capaCompleta, Buffer.from(base64Data, "base64"));
    return `file://${capaCompleta.replace(/\\/g, "/")}`;
  } catch (err) {
    return false;
  }
});

ipcMain.handle("definir-pasta", (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return null;
  try {
    const stats = fs.statSync(caminho);
    const dirFinal = stats.isDirectory() ? caminho : path.dirname(caminho);
    salvarPasta(dirFinal);
    return pastaEbooks;
  } catch (err) {
    return null;
  }
});

ipcMain.handle("obter-status-sistema", () => ({
  pastaAtual: pastaEbooks,
  admZipDisponivel: !!AdmZip,
  versao: app.getVersion()
}));

ipcMain.handle("salvar-status-leitura", (e, caminho, status) => {
  if (caminho && status) {
    salvarStatusObra(caminho, status);
    return true;
  }
  return false;
});

ipcMain.handle("salvar-progresso-leitura", (e, caminho, dados) => {
  if (caminho && dados) {
    return salvarProgressoObra(caminho, dados);
  }
  return null;
});

ipcMain.handle("obter-progresso-leitura", (e, caminho) => {
  if (!caminho) return null;
  return progressoLeitura[caminho] || null;
});

ipcMain.handle("buscar-ebooks", async (event, termo = "", recursivo = true) => {
  if (!pastaEbooks) return [];
  console.log(`📚 Buscando e-books em: "${pastaEbooks}" (recursivo: ${recursivo})`);

  const arquivos = buscarEbooksNaPasta(pastaEbooks, termo, recursivo);
  console.log(`✅ ${arquivos.length} obra(s) encontrada(s) no total.`);
  const lista = [];

  for (const item of arquivos) {
    const hash = gerarHashCaminho(item.caminho);
    const nomeCapa = `${hash}_cover.jpg`;
    const capaCompleta = path.join(thumbsDir, nomeCapa);

    let temCapa = fs.existsSync(capaCompleta);
    let autor = item.autor;
    let titulo = item.titulo;

    if (item.extensao === ".epub") {
      const dadosEpub = processarEpub(item.caminho, thumbsDir, nomeCapa);
      if (dadosEpub.titulo) titulo = dadosEpub.titulo;
      if (dadosEpub.autor) autor = dadosEpub.autor;
      temCapa = dadosEpub.capaExtraida || fs.existsSync(capaCompleta);
    } else if (item.extensao === ".cbz") {
      const dadosCbz = processarCbz(item.caminho, thumbsDir, nomeCapa);
      temCapa = dadosCbz.temCapa;
      if (!item.progresso.totalPaginas && dadosCbz.totalPaginas > 0) {
        item.progresso.totalPaginas = dadosCbz.totalPaginas;
      }
    }

    const thumbUrl = temCapa ? `file://${capaCompleta.replace(/\\/g, "/")}` : null;

    lista.push({
      ...item,
      titulo,
      autor,
      thumbnail: thumbUrl
    });
  }

  return lista;
});

ipcMain.handle("abrir-ebook-windows", (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return false;
  return shell.openPath(caminho);
});

ipcMain.handle("revelar-no-explorer", (e, caminho) => {
  if (!caminho || !fs.existsSync(caminho)) return false;
  shell.showItemInFolder(caminho);
  return true;
});

ipcMain.handle("open-external", (e, url) => {
  if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
    return shell.openExternal(url);
  }
  return false;
});

// ============================================================================
// CANAIS IPC DE INTELIGÊNCIA ARTIFICIAL (GROQ API & BOOK-TO-SKILL)
// ============================================================================

ipcMain.handle("obter-config-ia", () => {
  return obterConfigIA();
});

ipcMain.handle("salvar-config-ia", (e, cfg) => {
  if (cfg && typeof cfg === "object") {
    return salvarConfigIA(cfg);
  }
  return false;
});

ipcMain.handle("testar-conexao-groq", async (e, apiKey) => {
  const key = (apiKey || obterConfigIA().apiKey || "").trim();
  if (!key) return { success: false, error: "Chave de API não informada." };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 2
      })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody.error?.message || `Erro HTTP ${res.status}: ${res.statusText}`;
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "Falha de rede ao conectar com api.groq.com" };
  }
});

ipcMain.handle("perguntar-groq", async (e, { pergunta, contexto, historico = [], modelo = null }) => {
  const cfg = obterConfigIA();
  const key = (cfg.apiKey || "").trim();
  if (!key) {
    return {
      success: false,
      error: "Chave da API Groq não configurada. Clique no botão ⚙️ IA no topo para inserir sua chave gratuita."
    };
  }

  const modelToUse = modelo || cfg.model || "llama-3.3-70b-versatile";

  const systemPrompt = `Você é o Tutor e Mentor de Leitura Especialista integrado ao leitor EbookFinder.
Seu papel é responder com máxima clareza, empatia e profundidade pedagógica sobre a obra que o usuário está lendo.
Responda sempre em Português do Brasil com excelente formatação Markdown (tópicos com marcadores, negrito em conceitos-chave e listas quando apropriado).

${contexto ? `--- DADOS E CONTEÚDO EXTRAÍDO DA OBRA ---\n${contexto}\n---------------------------------------\nBaseie-se rigorosamente nos dados acima sempre que citar definições, capítulos e conceitos.` : "Responda de forma didática com base no seu vasto conhecimento."}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...historico.slice(-6).map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: pergunta }
  ];

  try {
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
      const msg = errBody.error?.message || `Erro HTTP ${res.status}`;
      return { success: false, error: msg };
    }

    const data = await res.json();
    const resposta = data.choices?.[0]?.message?.content || "Sem resposta da IA.";
    return { success: true, resposta };
  } catch (err) {
    return { success: false, error: err.message || "Erro ao consultar a API do Groq." };
  }
});

ipcMain.handle("obter-skill-livro", (e, caminho) => {
  if (!caminho) return null;
  const hash = gerarHashCaminho(caminho);
  const skillPath = path.join(skillsDir, hash);

  if (fs.existsSync(path.join(skillPath, "SKILL.md"))) {
    try {
      const skillMd = fs.readFileSync(path.join(skillPath, "SKILL.md"), "utf8");
      const cheatsheet = fs.existsSync(path.join(skillPath, "cheatsheet.md"))
        ? fs.readFileSync(path.join(skillPath, "cheatsheet.md"), "utf8")
        : "";
      const glossary = fs.existsSync(path.join(skillPath, "glossary.md"))
        ? fs.readFileSync(path.join(skillPath, "glossary.md"), "utf8")
        : "";
      return { temSkill: true, skillMd, cheatsheet, glossary, hash };
    } catch (err) {
      return { temSkill: false };
    }
  }

  return { temSkill: false };
});

ipcMain.handle("salvar-skill-livro", (e, { caminho, titulo, slug, skillMd, cheatsheet, glossary }) => {
  if (!caminho || !skillMd) return false;
  const hash = gerarHashCaminho(caminho);
  const skillPath = path.join(skillsDir, hash);

  try {
    if (!fs.existsSync(skillPath)) fs.mkdirSync(skillPath, { recursive: true });
    fs.writeFileSync(path.join(skillPath, "SKILL.md"), skillMd, "utf8");
    if (cheatsheet) fs.writeFileSync(path.join(skillPath, "cheatsheet.md"), cheatsheet, "utf8");
    if (glossary) fs.writeFileSync(path.join(skillPath, "glossary.md"), glossary, "utf8");

    // Salva também na pasta do workspace .agents/skills/<slug>/ se estiver em dev
    const safeSlug = slug || path.basename(caminho, path.extname(caminho)).toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
    const workspaceSkillDir = path.join(__dirname, ".agents", "skills", safeSlug);
    if (!fs.existsSync(workspaceSkillDir)) fs.mkdirSync(workspaceSkillDir, { recursive: true });
    fs.writeFileSync(path.join(workspaceSkillDir, "SKILL.md"), skillMd, "utf8");
    if (cheatsheet) fs.writeFileSync(path.join(workspaceSkillDir, "cheatsheet.md"), cheatsheet, "utf8");
    if (glossary) fs.writeFileSync(path.join(workspaceSkillDir, "glossary.md"), glossary, "utf8");

    return true;
  } catch (err) {
    console.error("❌ Falha ao salvar Skill do livro:", err);
    return false;
  }
});