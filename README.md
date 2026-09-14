<div align="center">

# 📚 EbookFinder

### Organizador e Leitor Inteligente de E-books e Documentos Digitais

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](./LICENSE.md)
[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/)
[![Version](https://img.shields.io/badge/Version-1.0.0-E5A93B?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README_EN.md)**

<p align="center">
  O <strong>EbookFinder</strong> é um aplicativo desktop projetado para amantes de leitura organizarem e acessarem suas coleções de e-books, histórias em quadrinhos e documentos digitais em um só lugar. Com extração instantânea de capas de EPUB e CBZ, organização por estantes de leitura (Lendo, Concluídos, Quero Ler) e tema visual elegante <em>Bibliophile Dark</em>.
</p>

</div>

---

## ✨ Principais Funcionalidades

- ⚡ **Extração de Capas Ultrarrápida (Zero FFmpeg)**: Extrai capas originais e metadados de arquivos `.epub` e `.cbz` diretamente da estrutura ZIP interna em milissegundos.
- 📖 **Proporção Real de Livro (2:3)**: Cards desenhados no formato clássico de livros físicos, com sombreamento de lombada e textura realista.
- 📚 **Estantes Virtuais de Leitura**:
  - 📚 **Todos os Livros**: Catálogo geral de obras.
  - ⭐ **Favoritos**: Acesso rápido aos livros do coração.
  - 📖 **Lendo Atualmente**: Mantenha o foco nos livros em andamento.
  - ✅ **Concluídos**: Histórico das suas leituras finalizadas.
  - 📌 **Quero Ler**: Lista de desejos para suas próximas leituras.
- 🔍 **Busca Inteligente por Título e Autor**: Filtre centenas de obras em tempo real enquanto digita.
- 📂 **Amplo Suporte a Formatos**:
  - Livros digitais: `.epub`, `.pdf`, `.mobi`, `.azw`, `.azw3`, `.fb2`, `.txt`.
  - Quadrinhos e Mangás: `.cbr`, `.cbz`.
- 🚀 **Integração com o Sistema Operacional**:
  - *Abrir no Leitor do Windows*: Abra instantaneamente a obra no seu leitor favorito (SumatraPDF, Calibre, Adobe Acrobat, Kindle PC, Edge).
  - *Mostrar na Pasta*: Localize o arquivo original no Explorador de Arquivos com um clique.
- 🛡️ **100% Offline e Privado**: Nenhuma conexão com a nuvem, sem telemetria e sem necessidade de criar contas.

---

## 🛠️ Tecnologias Utilizadas

- **[Electron](https://www.electronjs.org/)** — Plataforma desktop com padrão web.
- **[Node.js](https://nodejs.org/)** — E/S de arquivos e controle de processos locais.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — Descompactação em memória para extração de capas e metadados de EPUBs e CBZs.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/pt-BR/docs/Web/CSS)** — Design System "Bibliophile Dark" com Glassmorphism e micro-animações.
- **[JavaScript (ES6+)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)** — Lógica de estantes e gerenciamento reativo de estado.

---

## 📁 Estrutura do Projeto

```text
EbookFinder/
├── app/                      # Interface gráfica (Frontend)
│   ├── index.html            # Estrutura e estantes virtuais
│   ├── renderer.js           # Gerenciamento de estantes, busca e modal
│   ├── style.css             # Tema Bibliophile Dark e proporções de livro
│   └── ebookFinder.ico       # Ícone do aplicativo
├── main.js                   # Processo principal e parser de EPUB/CBZ
├── preload.js                # Ponte segura ContextBridge IPC
├── package.json              # Manifesto do projeto e dependências
├── .gitignore                # Regras de exclusão do Git
├── LICENSE.md                # Licença GNU General Public License v3.0
├── README.md                 # Documentação em Português
└── README_EN.md              # Documentação em Inglês
```

---

## 🚀 Instalação e Execução

### Pré-requisitos
- **[Node.js](https://nodejs.org/)** (v18 ou superior)
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

3. **Inicie o aplicativo:**
   ```bash
   npm start
   ```

4. **Gerar executável para Windows:**
   ```bash
   npm run dist
   ```

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