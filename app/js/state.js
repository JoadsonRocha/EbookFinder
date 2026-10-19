/**
 * EbookFinder — Módulo de Estado Global
 */
const state = {
  pastaAtual: null,
  todosLivros: [],
  livrosFiltrados: [],
  abaAtiva: "todos", // "todos" | "favoritos" | "lendo" | "concluidos" | "quero-ler"
  termoBusca: "",
  ordenacaoAtual: "titulo-asc",
  modoVisualizacao: localStorage.getItem("ef_modo_visualizacao") || "normal", // "normal" | "compact" | "list"
  buscaRecursiva: localStorage.getItem("ef_recursivo") !== "false",
  favoritos: new Set(JSON.parse(localStorage.getItem("ef_favoritos") || "[]")),
  livroSelecionado: null,
  tema: localStorage.getItem("ef_theme") || "dark",
  filtroLeitura: localStorage.getItem("ef_reader_filter") || "normal",
  tabModalAtiva: "detalhes",
  skillAtual: null,
  chatHistorico: [],
  leitor: {
    ativo: false,
    livro: null,
    tipoArquivo: "pdf", // "pdf" | "epub" | "txt"
    pdfDoc: null,
    epubDoc: null,
    txtPaginas: [],
    tamanhoFonte: 18,
    conteudoTextoAtual: "",
    paginaAtual: 1,
    totalPaginas: 1,
    paginaObj: null,
    escala: 1.2,
    renderizando: false,
    currentRenderTask: null,
    sidebarAberta: true,
    tabSidebar: "chat",
    busca: {
      ativa: false,
      termo: "",
      ocorrencias: [],
      indiceAtual: -1,
      cacheTexto: new Map()
    }
  }
};

// ============================================================================
// TEMAS DE CAPA DURA & FORMATAÇÃO HUMANIZADA
// ============================================================================
const PALETAS_CAPA = [
  { tema: "sapphire", bg: "linear-gradient(145deg, #132238, #0b1524)", borda: "#38bdf8", tag: "#0284c7" },
  { tema: "emerald",  bg: "linear-gradient(145deg, #063c2e, #02241b)", borda: "#34d399", tag: "#059669" },
  { tema: "burgundy", bg: "linear-gradient(145deg, #3d0718, #22020b)", borda: "#fb7185", tag: "#e11d48" },
  { tema: "obsidian", bg: "linear-gradient(145deg, #1c1926, #0e0d16)", borda: "#e5a93b", tag: "#d97706" },
  { tema: "amethyst", bg: "linear-gradient(145deg, #2d0b4e, #18042b)", borda: "#c084fc", tag: "#9333ea" },
  { tema: "indigo",   bg: "linear-gradient(145deg, #181842, #0d0c24)", borda: "#818cf8", tag: "#4f46e5" }
];


window.state = state;
window.aplicarTema = aplicarTema;
function aplicarTema(novoTema) {
  state.tema = novoTema;
  localStorage.setItem("ef_theme", novoTema);
  document.body.setAttribute("data-theme", novoTema);

  const iconLua = document.getElementById("iconLua");
  const iconSol = document.getElementById("iconSol");
  if (iconLua && iconSol) {
    iconLua.hidden = novoTema === "light";
    iconSol.hidden = novoTema !== "light";
  }
}
