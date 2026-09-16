<div align="center">

<img src="./logo.png" width="130" alt="EbookFinder Logo" style="border-radius:24px; box-shadow:0 8px 30px rgba(229, 169, 59, 0.35); margin-bottom:12px;" />

# 📚 EbookFinder

### Organizador e Leitor Inteligente de E-books com SkillBook IA & Book-to-Skill

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](./LICENSE.md)
[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Groq LPU](https://img.shields.io/badge/Groq-LPU%20Inference-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![Book to Skill](https://img.shields.io/badge/Architecture-Book--to--Skill-10B981?style=for-the-badge)](https://github.com/virgiliojr94/book-to-skill)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/)
[![Version](https://img.shields.io/badge/Version-1.1.0-E5A93B?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README_EN.md)**

<p align="center">
  O <strong>EbookFinder</strong> é um ecossistema desktop moderno para gerenciar, explorar, estudar e transformar suas coleções de e-books, histórias em quadrinhos e documentos digitais em habilidades modulares de IA. Com extração instantânea de capas, organização por estantes de leitura, modos Claro & Escuro de alto contraste, integração com <strong>Google Drive / OneDrive</strong> e o poderoso assistente <strong>SkillBook IA</strong>.
</p>

<p align="center">
  <img src="./Captura%20de%20Tela.png" width="100%" alt="Interface do EbookFinder" style="border-radius:12px; box-shadow:0 12px 35px rgba(0,0,0,0.25);" />
</p>

</div>

---

## ⚡ SkillBook IA & Integração Book-to-Skill

O **SkillBook** é a inteligência nativa do EbookFinder, conectada aos modelos de linguagem ultrarrápidos da **Groq LPU** (como *Qwen 2.5 32B*, *LLaMA 3.3 70B* e *DeepSeek R1 Distill*), permitindo interações ricas e transformações de livros em conhecimentos acionáveis.

### 🧠 Integração com o repositório Book-to-Skill
O projeto adota e implementa internamente a especificação de arquitetura do repositório **[virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**, criado por [Virgílio Santos](https://github.com/virgiliojr94).

A metodologia **Book-to-Skill** permite destilar o conteúdo de obras inteiras (PDF, EPUB, etc.) em uma estrutura padronizada e modular de três arquivos essenciais:

1. **`SKILL.md`**: Princípios fundamentais, modelos mentais, regras de decisão e lições centrais da obra, estruturados especificamente para serem consumidos como contexto por agentes autônomos de IA (Antigravity, Claude Code, Cursor, Copilot, etc.).
2. **`cheatsheet.md`**: Guia de ação rápida, resumo de regras práticas, comandos e boas práticas imediatas para consulta no dia a dia.
3. **`glossary.md`**: Glossário técnico e conceitual contendo todos os termos e definições importantes da obra.

> 🔗 **Referência Oficial do Book-to-Skill**:  
> Conheça a especificação completa e o projeto original em: **[https://github.com/virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**

---

### ⚡ Criar Skill Diretamente no Index de Livros
No catálogo de livros do EbookFinder, você pode acionar a destilação de qualquer obra com apenas um clique:
- Ao passar o mouse sobre o card de qualquer livro na estante, clique no botão **`⚡ Criar Skill`**.
- O aplicativo extrai o sumário e as páginas da obra, processa a destilação via Groq LPU e gera automaticamente os arquivos da skill em uma pasta `.skill/` associada.
- No workspace do **SkillBook**, você também pode clicar em **`⚡ Criar Skill`** na barra superior a qualquer momento para reindexar e atualizar a base de conhecimento.

---

## ✨ Principais Funcionalidades

- ⚡ **SkillBook IA (Workspace Conversacional)**:
  - Interface moderna estilo ChatGPT, Claude e Perplexity.
  - Cartões de sugestões automáticas (*Resumo Executivo*, *Conceitos & Regras*, *Aplicação Prática*, *Quiz de Fixação*).
  - Respostas formatadas em Markdown com botão de cópia instantânea em 1 clique.
  - Suporte a modelos de ponta via inferência Groq LPU com latência sub-segundo.
  - Armazenamento seguro de API Key (com suporte nativo a chave embutida do instalador MSI).

- ☁️ **Suporte a Google Drive e OneDrive**:
  - Detecção automática de unidades em nuvem sincronizadas no Windows:
    - **Google Drive** (disco virtual `G:\Meu Drive` ou pastas de sincronização local).
    - **Microsoft OneDrive** (pessoal e corporativo).
    - Pastas padrão de **Documentos**, **Downloads** e demais unidades de disco (`D:`, `E:`, etc.).
  - Seletor com *chips* clicáveis de conexão imediata.

- 🎨 **Modo Claro (Luxury Editorial) & Modo Escuro (Bibliophile Dark)**:
  - Alternador de tema no cabeçalho com persistência automática no armazenamento local.
  - Paleta *Light* com fundo pergaminho marfim (`#f9f8f4`), tipografia obsidian ink profunda (`#0f0d18`) e toques âmbar de alto contraste.
  - Paleta *Dark* imersiva com vidro fosco (glassmorphism) e acentos dourados.

- 📖 **Estantes Virtuais e Progresso de Leitura**:
  - Categorias: 📚 *Todos os Livros*, ⭐ *Favoritos*, 📖 *Lendo Atualmente*, ✅ *Concluídos*, 📌 *Quero Ler*.
  - Progresso com contador de página atual / total, porcentagem em tempo real e atalhos rápidos (`+1`, `+5`, `-1`).
  - Marcador de leitura com campo de anotações e registro da data da última leitura.

- 🖼️ **Extração de Capas e Miniaturas Nativas**:
  - Extração ultrarrápida em memória para arquivos `.epub` e `.cbz` via descompactação ZIP (zero dependências externas como FFmpeg).
  - Renderização nativa de páginas iniciais de `.pdf` usando PDF.js e Canvas HTML5.

- 🔍 **Busca em Tempo Real & Suporte Amplo a Formatos**:
  - Filtro instantâneo por título, autor e extensão com *debounce* inteligente.
  - Formatos aceitos: `.epub`, `.pdf`, `.mobi`, `.azw`, `.azw3`, `.fb2`, `.txt`, `.cbr`, `.cbz`.
  - Opção de busca recursiva em subpastas configurável pelo menu.

- 🚀 **Integração com o Windows**:
  - Abrir no leitor padrão do Windows (SumatraPDF, Calibre, Adobe Acrobat, Edge, etc.).
  - Mostrar arquivo na pasta do Explorador do Windows.
  - Suporte a *Drag and Drop* (arrastar e soltar pastas ou arquivos PDF diretamente para a janela).

---

## 🛠️ Tecnologias Utilizadas

- **[Electron](https://www.electronjs.org/)** — Plataforma desktop com APIs nativas do Windows.
- **[Node.js](https://nodejs.org/)** — E/S de arquivos assíncrona e chamadas de sistema.
- **[Groq SDK / REST API](https://groq.com/)** — Inferência ultraveloz com LPUs para modelos de linguagem.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Renderização nativa de miniaturas de capas e extração de texto em PDF.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — Descompactação em memória para metadados e capas de EPUBs e CBZs.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/pt-BR/docs/Web/CSS)** — Design System refinado com suporte completo a Dark/Light mode sem frameworks pesados.

---

## 📁 Estrutura do Projeto

```text
EbookFinder/
├── app/                      # Interface gráfica (Frontend)
│   ├── index.html            # Estrutura das estantes e workspace SkillBook
│   ├── renderer.js           # Gerenciamento de estantes, busca, IA e drives
│   ├── style.css             # Tema Dark/Light, cards e modal do SkillBook
│   ├── pdf.min.js            # Biblioteca PDF.js para renderização de capas
│   ├── pdf.worker.min.js     # Web Worker para processamento assíncrono de PDFs
│   └── ebookFinder.ico       # Ícone do aplicativo
├── main.js                   # Processo principal, parsers EPUB/CBZ, IPC e Groq API
├── preload.js                # Ponte ContextBridge segura entre main e renderer
├── package.json              # Manifesto e scripts do projeto
├── .gitignore                # Regras de exclusão do Git
├── LICENSE.md                # Licença GNU General Public License v3.0
├── README.md                 # Documentação em Português
└── README_EN.md              # Documentação em Inglês
```

---

## 🚀 Instalação e Execução

### Pré-requisitos
- **[Node.js](https://nodejs.org/)** (v18 ou superior recomendado)
- **Git**

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/JoadsonRocha/EbookFinder.git
   cd EbookFinder
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o aplicativo em modo de desenvolvimento:**
   ```bash
   npm start
   ```

4. **Gerar instalador para Windows (.exe / .msi):**
   ```bash
   npm run dist
   ```

---

## 🔑 Configuração da Chave da Groq (Opcional)

Para usar as funcionalidades conversacionais do **SkillBook** e a geração de **Book-to-Skill**:
1. Obtenha uma chave de API gratuita no console da Groq: [https://console.groq.com/keys](https://console.groq.com/keys).
2. No EbookFinder, clique no botão **⚡ SkillBook** no cabeçalho ou nas configurações do assistente.
3. Cole sua chave e clique em **Salvar Configurações**.
4. A chave é salva de maneira local e segura no armazenamento da sua máquina.

---

## 📄 Créditos e Agradecimentos

- **Arquitetura Book-to-Skill**: Desenvolvida por [Virgílio Santos (virgiliojr94)](https://github.com/virgiliojr94). Repositório oficial: **[virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**.

---

## 📄 Licença

Este projeto está licenciado sob a **GNU General Public License v3.0 (GNU GPLv3)**. Consulte o arquivo [LICENSE.md](./LICENSE.md) para mais detalhes.

---

## 👨‍💻 Autor

<div align="center">

**Joadson Rocha**  
*Desenvolvedor Full Stack & Desktop*

[![Website](https://img.shields.io/badge/Portf%C3%B3lio-joadsonrocha.github.io-E5A93B?style=for-the-badge&logo=google-chrome&logoColor=white)](https://joadsonrocha.github.io)
[![GitHub](https://img.shields.io/badge/GitHub-JoadsonRocha-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JoadsonRocha)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Joadson_Rocha-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/joadsonrocha/)

</div>