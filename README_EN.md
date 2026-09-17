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
[![Version](https://img.shields.io/badge/Version-1.1.0-10B981?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README_EN.md)**

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
| 🪟 **Windows Desktop** | **`EbookFinder.1.0.0.msi`** | v1.1.0 | 64-bit (Win 10/11) | [⬇️ **Direct .MSI Download**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.1.0.0.msi) |
| 🤖 **Android Mobile** | **`EbookFinder.apk`** | v1.1.0 | ARM64 / Universal | [⬇️ **Direct .APK Download**](https://github.com/JoadsonRocha/EbookFinder/releases/download/mobile/EbookFinder.apk) |

> 💡 **Android Installation Note:** When downloading `.apk` on your phone or tablet, simply tap the download notification or open your file manager to install (enable "Install unknown apps" if prompted by your browser).

---

## ⚡ SkillBook AI & Book-to-Skill Architecture

**SkillBook** is EbookFinder's native intelligence workspace, powered by ultra-fast **Groq LPU** inference (supporting models like *Qwen 2.5 32B*, *LLaMA 3.3 70B*, and *DeepSeek R1 Distill*), enabling contextual interactions and transforming books into machine-actionable skills.

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

- ⚡ **SkillBook AI (Market-Grade Conversational Workspace)**:
  - Clean conversational UI designed with inspirations from ChatGPT, Claude, and Perplexity.
  - One-click prompt starters (*Executive Summary*, *Key Concepts & Rules*, *Practical Applications*, *Knowledge Quiz*).
  - Rich Markdown rendering with a 1-click clipboard copy button.
  - Sub-second latency powered by Groq LPU inference.
  - Secure API key storage (with native support for bundled MSI installer keys).

- ☁️ **Google Drive & OneDrive Integration**:
  - Automatic detection of synced cloud drives on Windows:
    - **Google Drive** (virtual drive `G:\Meu Drive` / `G:\My Drive` or local mirror directories).
    - **Microsoft OneDrive** (Personal and Commercial).
    - Default system **Documents**, **Downloads**, and disk drive partitions (`D:`, `E:`, etc.).
  - Quick-connect chip selector modal.

- 🎨 **Luxury Light & Bibliophile Dark Themes**:
  - Fast theme switcher in the top navigation bar with persistent local storage.
  - *Light Mode*: Soft ivory paper background (`#f9f8f4`), deep obsidian ink typography (`#0f0d18`), and high-contrast amber accents.
  - *Dark Mode*: Immersive Bibliophile Dark palette with glassmorphic cards and golden highlights.

- 📖 **Virtual Bookshelves & Reading Progress**:
  - Shelves: 📚 *All Books*, ⭐ *Favorites*, 📖 *Currently Reading*, ✅ *Completed*, 📌 *Want to Read*.
  - Reading progress tracker with page counter, percentage calculation, and quick steppers (`+1`, `+5`, `-1`).
  - Chapter bookmarks with customizable notes and last-read timestamps.

- 🖼️ **Native Cover Extraction & PDF Thumbnails**:
  - Zero-dependency, memory-based extraction for `.epub` and `.cbz` files.
  - Native front-page rendering for `.pdf` documents using Mozilla PDF.js on HTML5 Canvas.

- 🔍 **Real-Time Search & Broad Format Support**:
  - Instant debounce search by title, author, and file extension.
  - Formats: `.epub`, `.pdf`, `.mobi`, `.azw`, `.azw3`, `.fb2`, `.txt`, `.cbr`, `.cbz`.
  - Recursive subfolder search toggle via the main menu.

- 🚀 **Windows OS Integration**:
  - *Open in System Reader*: Launch books in your preferred Windows viewer (SumatraPDF, Calibre, Adobe Acrobat, Edge).
  - *Show in Folder*: Reveal and highlight the source file in Windows File Explorer.
  - *Drag and Drop*: Drag any folder or PDF file directly onto the window to instantly load it into your library.

---

## 🛠️ Tech Stack

- **[Electron](https://www.electronjs.org/)** — Desktop platform with Windows native integration.
- **[Node.js](https://nodejs.org/)** — Asynchronous filesystem and OS process control.
- **[Groq SDK / REST API](https://groq.com/)** — Ultra-fast LPU inference for state-of-the-art LLMs.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** — Native in-browser PDF cover rendering and text extraction.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — In-memory ZIP archive decompression for EPUB and CBZ files.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS)** — Handcrafted design system supporting Light & Dark themes without heavy CSS frameworks.

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
├── package.json              # Project manifest, dependencies and scripts (npm start, npm run apk)
├── .gitignore                # Git ignore patterns
├── LICENSE.md                # GNU General Public License v3.0
├── README.md                 # Documentation in Portuguese
└── README_EN.md              # Documentation in English
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

3. **Start in development mode:**
   ```bash
   npm start
   ```

4. **Build Windows installer (.msi and full distribution):**
   ```bash
   npm run build:msi
   # or for all Windows targets (NSIS, MSI, Portable):
   npm run dist
   ```

5. **Build Android Application (.apk):**
   ```bash
   npm run apk
   ```
   *The `EbookFinder.apk` package will be automatically generated at the project root ready for mobile installation.*

6. **Open Android Studio project:**
   ```bash
   npm run cap:open
   ```

---

## 📱 Mobile Version (Capacitor & Android)

EbookFinder features first-class mobile support powered by **Capacitor 8**, adapting the entire reading experience for handheld devices:

- 📖 **Mobile-Optimized PDF Reader**: Layout automatically fits the viewport width with no awkward horizontal scrolling.
- 👆 **Natural Touch Gestures (Swipe)**: Swipe left to turn to the next page or swipe right to turn back, mirroring native e-reader apps.
- 💾 **IndexedDB Binary Storage**: PDF documents and high-resolution covers are securely stored in the device's local database without hitting browser 5MB storage limits.
- ⚡ **Direct Groq AI Inference**: Chat with SkillBook and generate Book-to-Skill extractions directly on your smartphone.
- 🎨 **Complete Visual Identity**: Adaptive launcher icons for all Android densities (`mdpi` to `xxxhdpi`) and custom branding splash screens.

### 🌿 About the `feature/mobile-capacitor` Branch
- **Purpose**: This branch serves as the dedicated development branch for the **Capacitor 8** and **Android Native** ecosystem.
- **What was built here**:
  - Full native Android Studio project scaffolding (`android/`).
  - Web-to-native compatibility bridge ([`app/mobile-bridge.js`](file:///d:/FULLSTARK/EbookFinder/app/mobile-bridge.js)) replacing Electron desktop IPC when running in Android webviews (IndexedDB file/cover storage, native document picking, and direct Groq API streaming).
  - Mobile-responsive reading canvas with touch swipe navigation.
  - Adaptive app icons and launch splash screens.
- **Status & Integration**: All features from `feature/mobile-capacitor` have been merged into the `main` branch, delivering a unified hybrid codebase that powers both Windows Desktop (Electron) and Android Mobile (Capacitor). This branch remains active on GitHub for ongoing mobile features and experimentations.

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