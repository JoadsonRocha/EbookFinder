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

// Pasta para armazenamento em cache das capas dos livros
const thumbsDir = path.join(app.getPath("userData"), "thumbs");
if (!fs.existsSync(thumbsDir)) {
  fs.mkdirSync(thumbsDir, { recursive: true });
}

// Arquivo de configuração da pasta de livros
const pastaConfigFile = path.join(app.getPath("userData"), "pasta_ebooks.json");
let pastaEbooks = null;

if (fs.existsSync(pastaConfigFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(pastaConfigFile, "utf8"));
    if (data.pasta && fs.existsSync(data.pasta)) {
      pastaEbooks = data.pasta;
    }
  } catch (e) {
    console.error("❌ Erro ao ler pasta_ebooks.json:", e);
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
 * Extrai a primeira imagem de um arquivo CBZ (Histórias em Quadrinhos).
 */
function processarCbz(caminhoCbz, pastaDestino, nomeCapa) {
  if (!AdmZip) return false;
  const capaDestino = path.join(pastaDestino, nomeCapa);
  if (fs.existsSync(capaDestino)) return true;

  try {
    const zip = new AdmZip(caminhoCbz);
    const entries = zip.getEntries();
    const imageEntries = entries
      .filter(e => !e.isDirectory && /\.(jpe?g|png|webp)$/i.test(e.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName));

    if (imageEntries.length > 0) {
      fs.writeFileSync(capaDestino, imageEntries[0].getData());
      return true;
    }
  } catch (err) {}
  return false;
}

/**
 * Varre o diretório e coleta os livros digitais.
 */
function buscarEbooksNaPasta(dir, termo = "", recursivo = false) {
  if (!dir || !fs.existsSync(dir)) return [];

  const termoLower = termo ? termo.toLowerCase() : "";
  const resultados = [];

  function lerDiretorio(caminhoAtual) {
    try {
      const entradas = fs.readdirSync(caminhoAtual, { withFileTypes: true });

      for (const entrada of entradas) {
        const caminhoCompleto = path.join(caminhoAtual, entrada.name);

        if (entrada.isDirectory() && recursivo) {
          lerDiretorio(caminhoCompleto);
        } else if (entrada.isFile()) {
          const ext = path.extname(entrada.name).toLowerCase();
          if (EXTENSOES_EBOOKS.includes(ext)) {
            const baseNome = path.basename(entrada.name, ext);

            if (!termoLower || entrada.name.toLowerCase().includes(termoLower)) {
              let tamanho = 0;
              let modificadoEm = 0;
              try {
                const stat = fs.statSync(caminhoCompleto);
                tamanho = stat.size;
                modificadoEm = stat.mtimeMs;
              } catch (e) {}

              resultados.push({
                nome: entrada.name,
                titulo: baseNome,
                autor: "Desconhecido",
                caminho: caminhoCompleto,
                extensao: ext,
                tamanho,
                modificadoEm,
                status: estanteStatus[caminhoCompleto] || "nenhum"
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

ipcMain.handle("buscar-ebooks", async (event, termo = "", recursivo = false) => {
  if (!pastaEbooks) return [];

  const arquivos = buscarEbooksNaPasta(pastaEbooks, termo, recursivo);
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
      temCapa = processarCbz(item.caminho, thumbsDir, nomeCapa);
    }

    lista.push({
      ...item,
      titulo,
      autor,
      thumbnail: temCapa ? capaCompleta : null
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