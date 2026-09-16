const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

require('./main.js');

app.whenReady().then(() => {
  setTimeout(async () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];

      // 1. Testa Modo Claro
      await win.webContents.executeJavaScript(`
        window.aplicarTema('light');
      `);
      await new Promise(r => setTimeout(r, 600));
      let img = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, 'screenshot-light-mode.png'), img.toPNG());
      console.log('✅ Screenshot do Modo Claro salva.');

      // 2. Testa Abertura da aba Tutor IA no primeiro livro
      await win.webContents.executeJavaScript(`
        const firstCard = document.querySelector('.book-card');
        if (firstCard) firstCard.click();
      `);
      await new Promise(r => setTimeout(r, 800));

      await win.webContents.executeJavaScript(`
        const tabTutor = document.getElementById('tabBtnTutorIA');
        if (tabTutor) tabTutor.click();
      `);
      await new Promise(r => setTimeout(r, 800));
      img = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, 'screenshot-tutor-ia.png'), img.toPNG());
      console.log('✅ Screenshot da aba Tutor IA salva.');

      // Retorna para tema original se preferir
      await win.webContents.executeJavaScript(`
        window.aplicarTema('dark');
      `);
    }
    app.quit();
  }, 4500);
});
