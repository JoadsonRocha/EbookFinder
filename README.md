<div align="center">

<img src="./logo.png" width="130" alt="EbookFinder Logo" style="border-radius:24px; box-shadow:0 8px 30px rgba(229, 169, 59, 0.35); margin-bottom:12px;" />

# 📚 EbookFinder

### Smart Local E-book & Digital Document Organizer with SkillBook AI & Book-to-Skill

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

**[🇺🇸 English](./README.md)** &nbsp;|&nbsp; **[🇧🇷 Português](./README_PT.md)**

<p align="center">
  <strong>EbookFinder</strong> is a modern ecosystem for <strong>Windows Desktop and Android Mobile</strong> crafted for book lovers, researchers, and builders to organize, explore, study, and transform personal libraries into modular AI skills. Featuring instant cover extraction, virtual reading shelves, high-contrast Dark & Light themes, seamless <strong>Google Drive / OneDrive</strong> auto-detection, and the market-grade <strong>SkillBook AI</strong> workspace.
</p>

<!-- MAIN DOWNLOAD BUTTONS (1-CLICK DIRECT) -->
<p align="center">
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi" title="Download Official Windows Installer (.MSI Direct)">
    <img src="./assets/badges/badge-windows-en.svg" height="54" alt="Download for Windows (.MSI Direct)" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk" title="Download Android Application (.APK Direct)">
    <img src="./assets/badges/badge-android-en.svg" height="54" alt="Download for Android (.APK Direct)" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi" title="Download for Windows">
    <img src="./assets/badges/badge-microsoft.svg" height="46" alt="Available on Microsoft" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk" title="Download for Android">
    <img src="./assets/badges/badge-google-play.svg" height="46" alt="Available on Google Play" />
  </a>
</p>

<br />

<p align="center">
  <img src="./Captura%20de%20Tela.png" width="100%" alt="EbookFinder Interface" style="border-radius:12px; box-shadow:0 12px 35px rgba(0,0,0,0.25);" />
</p>

</div>

---

## 📦 Official Downloads & Direct Installation (Windows & Android)

Download official binaries with **1-click direct download**:

| Platform | Package | Version | Architecture | Direct Download (1-Click) |
| :--- | :--- | :--- | :--- | :--- |
| 🪟 **Windows Desktop** | **`EbookFinder.1.0.0.msi`** | v1.2.0 | 64-bit (Win 10/11) | [⬇️ **Direct .MSI Download**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi) |
| 🤖 **Android Mobile** | **`EbookFinder.apk`** | v1.2.0 | ARM64 / Universal | [⬇️ **Direct .APK Download**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk) |

> 💡 **Android Installation Note:** When downloading `.apk` on your phone or tablet, simply tap the download notification or open your file manager to install (enable "Install unknown apps" if prompted by your browser).

---

## ⚡ SkillBook AI & Book-to-Skill Architecture

**SkillBook** is EbookFinder's native intelligence workspace, powered by ultra-fast **Groq LPU** inference (supporting models like *Qwen 2.5 32B*, *LLaMA 3.3 70B*, and *DeepSeek R1 Distill*), enabling real-time streaming conversations and transforming books into machine-actionable skills.

### 🧠 Official Integration with the Book-to-Skill Repository
EbookFinder adopts and natively implements the architecture specification from **[virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**, created by [Virgílio Santos](https://github.com/virgiliojr94).

The **Book-to-Skill** methodology distills entire books (PDF, EPUB, etc.) into a standardized, modular set of three core files:

1. **`SKILL.md`**: Foundational principles, mental models, decision heuristics, and core concepts structured for direct context ingestion by autonomous AI coding and research agents (Antigravity, Claude Code, Cursor, Copilot, etc.).
2. **`cheatsheet.md`**: Rapid lookup reference sheet containing actionable rules, commands, and best practices.
3. **`glossary.md`**: Comprehensive technical and conceptual glossary defining all domain-specific terms from the work.

> 🔗 **Official Book-to-Skill Repository**:  
> Explore the original project and specification at: **[https://github.com/virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**

---

### ⚡ Create Skill Directly from the Book Index
In EbookFinder's main book catalog, you can trigger distillation with a single click:
- Hover over any book card on the bookshelf and click the **`⚡ Criar Skill`** button.
- The application extracts the table of contents and sample pages, processes the distillation through Groq LPU, and automatically stores the resulting skill in an associated `.skill/` directory.
- Inside the **SkillBook** conversational workbench, you can also click **`⚡ Criar Skill`** in the top action bar at any time to reindex or update the knowledge base.

---

## ✨ Key Features

- ⚡ **SkillBook AI (Conversational Workspace with Streaming)**:
  - Clean conversational UI designed with inspirations from ChatGPT, Claude, and Perplexity with live typing streaming.
  - One-click prompt starters (*Executive Summary*, *Key Concepts & Rules*, *Practical Applications*, *Knowledge Quiz*).
  - Rich Markdown rendering with 1-click clipboard copy and **Chat Export (.md / .txt)**.
  - Sub-second latency powered by Groq LPU inference.
  - Fully shielded API key protection (never exposed in plaintext on screen).

- 🔍 **Full-Text In-Reader Search**:
  - Search terms and keywords inside any PDF document with `Ctrl+F` or the quick search button.
  - Real-time occurrence counter (e.g., `Occurrence 1 of 18`) with bidirectional navigation.

- 🔖 **Quick Bookmarks & Page Notes**:
  - Pin important pages with instant bookmarks and custom notes.
  - Dedicated bookmarks tab in the reader sidebar with 1-click direct page jumping.

- 📊 **Reading Analytics & Shelf Progress**:
  - Complete reading metrics: total pages read, completed books, reading pace, and a multi-color progress bar.

- 📜 **Comfort Reading Modes (Normal, Noble Sepia & Inverted Night)**:
  - Soft sepia linen tone to reduce eye strain and high-contrast night mode for dark environments.

- 📱 **First-Class Mobile Experience (Android & Web)**:
  - Full native Android Back Button / gesture integration with hierarchical modal closing.
  - Offline local storage for files and high-res covers using IndexedDB.
  - Floating bottom dock for convenient one-handed thumb navigation.

- ☁️ **Google Drive & OneDrive Integration**:
  - Automatic detection of synced cloud drives on Windows.

---

## 🛠️ Tech Stack

- **[Electron](https://www.electronjs.org/)** — Desktop platform with Windows native integration.
- **[Capacitor 8](https://capacitorjs.com/)** — Mobile runtime for native Android packaging.
- **[Node.js](https://nodejs.org/)** — Asynchronous filesystem and OS process control.
- **[Groq SDK / REST API](https://groq.com/)** — Ultra-fast LPU inference for state-of-the-art LLMs.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Native PDF cover rendering, in-reader search, and text extraction.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — In-memory ZIP archive decompression for EPUB and CBZ files.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS)** — Handcrafted design system supporting Light & Dark themes without heavy frameworks.

---

## 📁 Project Structure

```text
EbookFinder/
├── android/                  # Native Android project (Gradle, Manifest, Assets)
├── app/                      # Shared user interface (Desktop & Mobile frontend)
│   ├── index.html            # Main layout and SkillBook workspace
│   ├── renderer.js           # Shelf management, search, AI and internal reader logic
│   ├── mobile-bridge.js      # Native Capacitor bridge (IndexedDB, FilePicker, Groq Mobile)
│   ├── style.css             # Light/Dark design system, book cards & mobile responsiveness
│   ├── pdf.min.js            # PDF.js library for cover thumbnails & page rendering
│   ├── pdf.worker.min.js     # Web Worker for asynchronous PDF processing
│   └── ebookFinder.ico       # Desktop application icon
├── capacitor.config.json     # Capacitor 8 configuration for Android
├── main.js                   # Electron main process, EPUB/CBZ parsers & IPC
├── preload.js                # Secure ContextBridge IPC bridge for Desktop
├── serve-mobile.js           # HTTP server to test the mobile app over local Wi-Fi
├── package.json              # Project manifest, dependencies and scripts (npm start, npm run apk)
├── .gitignore                # Git ignore patterns
├── LICENSE.md                # GNU General Public License v3.0
├── README.md                 # Default Documentation (English)
└── README_PT.md              # Portuguese Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **[Node.js](https://nodejs.org/)** (v18 or newer recommended)
- **Git**

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JoadsonRocha/EbookFinder.git
   cd EbookFinder
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Desktop app in development mode:**
   ```bash
   npm start
   ```

4. **Test the Mobile version on your phone over local Wi-Fi:**
   ```bash
   node serve-mobile.js
   ```

5. **Build Windows installer (.msi and full distribution):**
   ```bash
   npm run build:msi
   # or for all Windows targets (NSIS, MSI, Portable):
   npm run dist
   ```

6. **Build Android Application (.apk):**
   ```bash
   npm run apk
   ```
   *The `EbookFinder.apk` package will be automatically generated at the project root ready for mobile installation.*

---

## 🔑 Groq API Configuration (Optional)

To enable **SkillBook** conversational intelligence and the **Book-to-Skill** generator:
1. Obtain a free API key at Groq Console: [https://console.groq.com/keys](https://console.groq.com/keys).
2. In EbookFinder, click the **⚡ SkillBook** button in the header or assistant settings.
3. Paste your key and click **Salvar Configurações**.
4. The key is securely stored locally on your machine.

---

## 📄 Credits and Acknowledgements

- **Book-to-Skill Architecture**: Created by [Virgílio Santos (virgiliojr94)](https://github.com/virgiliojr94). Official repository: **[virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)**.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GNU GPLv3)**. See [LICENSE.md](./LICENSE.md) for full license details.

---

## 👨‍💻 Author

<div align="center">

**Joadson Rocha**  
*Full Stack & Desktop Software Developer*

[![Website](https://img.shields.io/badge/Portfolio-joadsonrocha.github.io-E5A93B?style=for-the-badge&logo=google-chrome&logoColor=white)](https://joadsonrocha.github.io)
[![GitHub](https://img.shields.io/badge/GitHub-JoadsonRocha-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JoadsonRocha)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Joadson_Rocha-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/joadsonrocha/)

</div>