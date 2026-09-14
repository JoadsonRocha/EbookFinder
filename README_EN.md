<div align="center">

<img src="./logo.png" width="130" alt="EbookFinder Logo" style="border-radius:24px; box-shadow:0 8px 30px rgba(229, 169, 59, 0.35); margin-bottom:12px;" />

# 📚 EbookFinder

### Smart Local E-book and Digital Document Organizer & Reader

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=for-the-badge)](./LICENSE.md)
[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/)
[![Version](https://img.shields.io/badge/Version-1.0.0-E5A93B?style=for-the-badge)](./package.json)

<br />

**[🇧🇷 Português](./README.md)** &nbsp;|&nbsp; **[🇺🇸 English](./README_EN.md)**

<p align="center">
  <strong>EbookFinder</strong> is a modern desktop app crafted for book lovers and researchers to organize, explore, and read their personal library of digital books, comics, and documents. Featuring instant EPUB/CBZ cover extraction, virtual reading shelves (Currently Reading, Completed, Want to Read), and a rich <em>Bibliophile Dark</em> interface.
</p>

</div>

---

## ✨ Key Features

- ⚡ **Ultra-Fast Cover Extraction (Zero FFmpeg)**: Extracts original cover artwork and metadata from `.epub` and `.cbz` files directly from internal ZIP structures in mere milliseconds.
- 📖 **Authentic Book Proportions (2:3)**: Card layout designed with realistic 3D book spine shadows and paper aesthetics.
- 🔖 **Reading Progress & Digital Bookmark**:
  - Save the last read page and total page count with quick adjustment stepper buttons (`+1`, `+5`, `+10`, `-1`).
  - Real-time animated progress bar with percentage indicator on both bookshelf cards and the book details dialog.
  - Custom bookmarks and chapter/reading notes.
  - Smart status transition: automatically updates to *"Currently Reading"* when started and *"Completed"* when reaching the final page.
- 📚 **Virtual Reading Shelves**:
  - 📚 **All Books**: Complete catalog of digital media.
  - ⭐ **Favorites**: Quick access to your most cherished books.
  - 📖 **Currently Reading**: Keep your current reads at the forefront.
  - ✅ **Completed**: Track and celebrate finished books.
  - 📌 **Want to Read**: Your digital reading wishlist.
- 🔍 **Real-Time Title & Author Search**: Fast debounce search to instantly locate any author or title.
- 📂 **Broad Format Support**:
  - E-books: `.epub`, `.pdf`, `.mobi`, `.azw`, `.azw3`, `.fb2`, `.txt`.
  - Comic books & Manga: `.cbr`, `.cbz`.
- 🚀 **Windows OS Integration**:
  - *Open in System Reader*: Open books in your favorite reader (SumatraPDF, Calibre, Adobe Acrobat, Kindle PC, Edge).
  - *Show in Folder*: Reveal and highlight the source file in Windows File Explorer.
- 🛡️ **100% Offline and Private**: Zero cloud sync, zero telemetry, and no account or internet connection required.

---

## 🛠️ Tech Stack

- **[Electron](https://www.electronjs.org/)** — Desktop environment built with web technologies.
- **[Node.js](https://nodejs.org/)** — Fast asynchronous filesystem access and child process management.
- **[Adm-Zip](https://github.com/cthackers/adm-zip)** — In-memory zip archive decompression for lightning-fast EPUB/CBZ cover extraction.
- **[HTML5 & Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS)** — "Bibliophile Dark" design system with warm amber accents.
- **[JavaScript (ES6+)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)** — Reactive state handling and bookshelf categorization.

---

## 📁 Project Structure

```text
EbookFinder/
├── app/                      # User interface (Frontend)
│   ├── index.html            # Layout and virtual bookshelf tabs
│   ├── renderer.js           # Shelf management, search & modal viewer
│   ├── style.css             # Bibliophile Dark theme and book cover styles
│   └── ebookFinder.ico       # Application icon
├── main.js                   # Electron main process & EPUB/CBZ parsers
├── preload.js                # Secure ContextBridge IPC bridge
├── package.json              # Project manifest and dependencies
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

4. **Build Windows executable release:**
   ```bash
   npm run dist
   ```

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GNU GPLv3)**. See [LICENSE.md](./LICENSE.md) for full license terms.

---

## 👨‍💻 Author

<div align="center">

**Joadson Rocha**  
*Full Stack & Desktop Software Developer*

[![Website](https://img.shields.io/badge/Portfolio-joadsonrocha.github.io-E5A93B?style=for-the-badge&logo=google-chrome&logoColor=white)](https://joadsonrocha.github.io)
[![GitHub](https://img.shields.io/badge/GitHub-JoadsonRocha-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/JoadsonRocha)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Joadson_Rocha-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/joadsonrocha/)

</div>