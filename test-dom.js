const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Carrega o main.js original mas monitora o BrowserWindow
require('./main.js');

app.whenReady().then(() => {
  setTimeout(async () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      const cards = await win.webContents.executeJavaScript('document.querySelectorAll(".book-card").length');
      const resultsText = await win.webContents.executeJavaScript('document.getElementById("resultsCount")?.textContent');
      const pathText = await win.webContents.executeJavaScript('document.getElementById("lblPastaAtual")?.textContent');
      const emptyState = await win.webContents.executeJavaScript('document.querySelector(".empty-state")?.innerText');
      console.log('=== TESTE DO DOM DO ELECTRON ===');
      console.log('Pasta exibida:', pathText);
      console.log('Texto de resultados:', resultsText);
      console.log('Quantidade de Cards renderizados:', cards);
      if (emptyState) console.log('Estado Vazio visível:\n', emptyState);
      console.log('================================');
    }
    app.quit();
  }, 3000);
});
