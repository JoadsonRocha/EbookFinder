const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  win.loadFile('app/index.html');

  setTimeout(async () => {
    const testPdf = 'D:\\ANALISTA SEGURANÇA DE TI ALERR\\ADMINISTRATIVO\\curso-379661-aula-05-3059-completo.pdf';
    console.log('Testando extração do PDF:', testPdf);

    const result = await win.webContents.executeJavaScript(`
      (async function() {
        try {
          if (!window.pdfjsLib) return { error: 'pdfjsLib não encontrado no window' };
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
          
          const buffer = await window.api.lerArquivoBuffer("${testPdf.replace(/\\/g, '\\\\')}");
          if (!buffer) return { error: 'Buffer vazio ou falha na leitura' };
          
          const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          
          const vp = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          return {
            sucesso: true,
            numPages: pdf.numPages,
            largura: vp.width,
            altura: vp.height,
            dataUrlLength: dataUrl.length
          };
        } catch(e) {
          return { error: e.message, stack: e.stack };
        }
      })()
    `);

    console.log('=== RESULTADO DO TESTE DE EXTRAÇÃO DE CAPA ===');
    console.log(result);
    console.log('==============================================');
    app.quit();
  }, 2000);
});
