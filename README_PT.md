<div align="center">

<img src="./logo.png" width="130" alt="EbookFinder Logo" style="border-radius:24px; box-shadow:0 8px 30px rgba(229, 169, 59, 0.35); margin-bottom:12px;" />

# 📚 EbookFinder

### Organizador e Leitor Inteligente de E-books com SkillBook IA & Book-to-Skill

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](./LICENSE.md)
[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Groq LPU](https://img.shields.io/badge/Groq-LPU%20Inference-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![Book to Skill](https://img.shields.io/badge/Architecture-Book--to--Skill-10B981?style=for-the-badge)](https://github.com/virgiliojr94/book-to-skill)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/JoadsonRocha/EbookFinder/releases)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.x-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Releases](https://img.shields.io/badge/Releases-MSI%20%7C%20APK-E5A93B?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JoadsonRocha/EbookFinder/releases)
[![Version](https://img.shields.io/badge/Version-1.2.0-10B981?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README_PT.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README.md)**

<p align="center">
  O <strong>EbookFinder</strong> é um ecossistema moderno para <strong>Windows Desktop e Android Mobile</strong> projetado para gerenciar, explorar, estudar e transformar suas coleções de e-books, histórias em quadrinhos e documentos digitais em habilidades modulares de IA. Com extração instantânea de capas, organização por estantes de leitura, modos Claro & Escuro de alto contraste, integração com <strong>Google Drive / OneDrive</strong> e o poderoso assistente <strong>SkillBook IA</strong>.
</p>

<!-- BOTÕES DE DOWNLOAD PRINCIPAIS (1 CLIQUE) -->
<p align="center">
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi" title="Baixar Instalador Oficial para Windows (.MSI Direto)">
    <img src="./assets/badges/badge-windows.svg" height="54" alt="Download para Windows (.MSI Direto)" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk" title="Baixar Aplicativo para Android (.APK Direto)">
    <img src="./assets/badges/badge-android.svg" height="54" alt="Download para Android (.APK Direto)" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi" title="Download para Windows">
    <img src="./assets/badges/badge-microsoft.svg" height="46" alt="Disponível na Microsoft" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk" title="Download para Android">
    <img src="./assets/badges/badge-google-play.svg" height="46" alt="Disponível no Google Play" />
  </a>
</p>

<br />

<p align="center">
  <img src="./Captura%20de%20Tela.png" width="100%" alt="Interface do EbookFinder" style="border-radius:12px; box-shadow:0 12px 35px rgba(0,0,0,0.25);" />
</p>

</div>

---

## 📦 Downloads & Instalação Direta (Windows & Android)

Baixe os instaladores oficiais prontos para uso com **download direto em 1 clique**:

| Plataforma | Pacote | Versão | Arquitetura | Download Direto (1 Clique) |
| :--- | :--- | :--- | :--- | :--- |
| 🪟 **Windows Desktop** | **`EbookFinder.1.0.0.msi`** | v1.2.0 | 64-bit (Win 10/11) | [⬇️ **Baixar .MSI Direto**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi) |
| 🤖 **Android Mobile** | **`EbookFinder.apk`** | v1.2.0 | ARM64 / Universal | [⬇️ **Baixar .APK Direto**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk) |

> 💡 **Nota de Instalação no Android:** Ao baixar o arquivo `.apk` no seu celular ou tablet, basta abrir a notificação de download ou o gerenciador de arquivos e confirmar a instalação (habilite "Instalar fontes desconhecidas" caso o navegador solicite).

---

## ⚡ SkillBook IA & Integração Book-to-Skill

O **SkillBook** é a inteligência nativa do EbookFinder, conectada aos modelos de linguagem ultrarrápidos da **Groq LPU** (como *Qwen 2.5 32B*, *LLaMA 3.3 70B* e *DeepSeek R1 Distill*), permitindo interações ricas com respostas em streaming em tempo real e transformações de livros em conhecimentos acionáveis.

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

- ⚡ **SkillBook IA (Workspace Conversacional com Streaming)**:
  - Interface moderna estilo ChatGPT, Claude e Perplexity com digitação de texto em streaming contínuo.
  - Cartões de sugestões automáticas (*Resumo Executivo*, *Conceitos & Regras*, *Aplicação Prática*, *Quiz de Fixação*).
  - Respostas formatadas em Markdown com botão de cópia instantânea e **Exportação de Chat (.md / .txt)**.
  - Suporte a modelos de ponta via inferência Groq LPU com latência sub-segundo.
  - Armazenamento seguro de API Key com blindagem total na tela.

- 🔍 **Busca Textual no Leitor Interno**:
  - Pesquise termos e palavras-chave dentro de qualquer PDF com `Ctrl+F` ou toque na lupa.
  - Varredura em tempo real com contador de ocorrências (ex.: `1 de 18`) e navegação bidirecional.

- 🔖 **Marcadores Rápidos & Anotações por Página**:
  - Salve marcadores imediatos com notas curtas para fixar passagens fundamentais.
  - Painel lateral dedicado de marcadores com clique direto para pular para a página salva.

- 📊 **Painel de Métricas da Biblioteca (Reading Analytics)**:
  - Estatísticas de leitura da sua estante: total de páginas lidas, livros concluídos e barra de progresso multicor.

- 📜 **Modos de Cor no Leitor (Normal, Sépia & Noturno)**:
  - Fundo sépia linho relaxante contra fadiga ocular e modo noturno de alto contraste invertido.

- 📱 **Otimização Total para Mobile (Android & Web)**:
  - Suporte completo ao botão nativo "Voltar" do Android com fechamento em pilha hierárquica.
  - Armazenamento offline de arquivos e capas em alta resolução no IndexedDB.
  - Dock flutuante inferior para fácil uso com uma mão só.

- ☁️ **Suporte a Google Drive e OneDrive**:
  - Detecção automática de unidades em nuvem sincronizadas no Windows.

---

## 🛠️ Tecnologias Utilizadas

- **[Electron](https://www.electronjs.org/)** — Plataforma desktop com APIs nativas do Windows.
- **[Capacitor 8](https://capacitorjs.com/)** — Runtime móvel para empacotamento Android nativo.
- **[Node.js](https://nodejs.org/)** — E/S de arquivos assíncrona e chamadas de sistema.
- **[Groq SDK / REST API](https://groq.com/)** — Inferência ultraveloz com LPUs para modelos de linguagem.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Renderização de páginas, capas e extração de texto em PDF.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — Descompactação em memória para metadados e capas de EPUBs e CBZs.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/pt-BR/docs/Web/CSS)** — Design System refinado sem dependência de frameworks pesados.

---

## 📁 Estrutura do Projeto

```text
EbookFinder/
├── android/                  # Projeto nativo Android (Gradle, Manifest, Recursos)
├── app/                      # Interface gráfica (Frontend compartilhado Desktop & Mobile)
│   ├── index.html            # Estrutura das estantes e workspace SkillBook
│   ├── renderer.js           # Gerenciamento de estantes, busca, IA e leitor interno
│   ├── mobile-bridge.js      # Ponte nativa Capacitor (IndexedDB, FilePicker, Groq Mobile)
│   ├── style.css             # Tema Dark/Light, cards e responsividade mobile
│   ├── pdf.min.js            # Biblioteca PDF.js para renderização de capas e páginas
│   ├── pdf.worker.min.js     # Web Worker para processamento assíncrono de PDFs
│   └── ebookFinder.ico       # Ícone do aplicativo Desktop
├── capacitor.config.json     # Configurações do Capacitor 8 para Android
├── main.js                   # Processo principal Electron, parsers EPUB/CBZ e IPC
├── preload.js                # Ponte ContextBridge segura entre main e renderer no Desktop
├── serve-mobile.js           # Servidor HTTP para teste do app mobile via rede Wi-Fi local
├── package.json              # Manifesto, dependências e scripts (npm start, npm run apk)
├── .gitignore                # Regras de exclusão do Git
├── LICENSE.md                # Licença GNU General Public License v3.0
├── README.md                 # Documentação em Inglês (Padrão)
└── README_PT.md              # Documentação em Português
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

3. **Inicie o aplicativo Desktop em modo de desenvolvimento:**
   ```bash
   npm start
   ```

4. **Testar a versão Mobile no celular pela rede Wi-Fi local:**
   ```bash
   node serve-mobile.js
   ```

5. **Gerar instalador para Windows (.msi e instalador completo):**
   ```bash
   npm run build:msi
   # ou para todos os formatos Windows (NSIS, MSI, Portable):
   npm run dist
   ```

6. **Gerar aplicativo Android (.apk):**
   ```bash
   npm run apk
   ```
   *O arquivo `EbookFinder.apk` será gerado automaticamente na raiz do projeto pronto para instalar no celular.*

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
