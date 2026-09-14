/**
 * ============================================================================
 * EbookFinder - Preload Script (Ponte Segura IPC)
 * ============================================================================
 * @description Expõe com segurança APIs limitadas do processo principal (Node.js)
 *              para o processo de renderização (Frontend/DOM) usando contextBridge.
 * @author Joadson Rocha <joadson.dev@gmail.com>
 * @license GPL-3.0
 * ============================================================================
 */

const { contextBridge, ipcRenderer } = require("electron");

function safeInvoke(canal, ...args) {
  return ipcRenderer.invoke(canal, ...args).catch(err => {
    console.error(`❌ Erro na chamada IPC [${canal}]:`, err);
    return null;
  });
}

contextBridge.exposeInMainWorld("api", {
  /**
   * Retorna o diretório configurado de e-books.
   */
  getPastaAtual: () => safeInvoke("get-pasta-atual"),

  /**
   * Abre o diálogo nativo do sistema para selecionar a pasta de e-books.
   */
  escolherPasta: () => safeInvoke("escolher-pasta"),

  /**
   * Retorna informações de versão e status dos módulos internos.
   */
  obterStatusSistema: () => safeInvoke("obter-status-sistema"),

  /**
   * Atualiza a estante / status de leitura da obra ("lendo", "concluidos", "quero-ler", "nenhum").
   */
  salvarStatusLeitura: (caminho, status) => safeInvoke("salvar-status-leitura", caminho, status),

  /**
   * Salva o progresso de leitura (página atual, total de páginas, marcador/anotações).
   */
  salvarProgressoLeitura: (caminho, dados) => safeInvoke("salvar-progresso-leitura", caminho, dados),

  /**
   * Obtém o progresso de leitura registrado de um livro.
   */
  obterProgressoLeitura: (caminho) => safeInvoke("obter-progresso-leitura", caminho),

  /**
   * Busca livros e documentos digitais na pasta configurada.
   */
  buscarEbooks: (termo = "", recursivo = false) => safeInvoke("buscar-ebooks", termo, recursivo),

  /**
   * Abre o e-book ou documento no leitor padrão do Windows (Sumatra, Calibre, Edge, etc.).
   */
  abrirNoWindows: (caminho) => safeInvoke("abrir-ebook-windows", caminho),

  /**
   * Destaca e seleciona o arquivo no Explorador de Arquivos do Windows.
   */
  revelarNoExplorer: (caminho) => safeInvoke("revelar-no-explorer", caminho),

  /**
   * Abre um link externo com segurança no navegador padrão do usuário.
   */
  openExternal: (url) => safeInvoke("open-external", url)
});