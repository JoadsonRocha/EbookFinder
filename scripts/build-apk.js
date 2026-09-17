const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const androidDir = path.join(rootDir, "android");
const apkSource = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const apkDest = path.join(rootDir, "EbookFinder.apk");

console.log("\n========================================================");
console.log("   📚 EbookFinder - Gerador & Atualizador de APK Mobile");
console.log("========================================================\n");

// 1. Sincronizar arquivos web com o Capacitor
console.log("🔄 1/3 Sincronizando arquivos web com o Android...");
execSync("npx cap sync", { cwd: rootDir, stdio: "inherit" });

// 2. Detectar JAVA_HOME (Android Studio JBR ou ambiente padrão)
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const possiblePaths = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "C:\\Program Files\\Android\\Android Studio\\jre",
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Android Studio", "jbr")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      env.JAVA_HOME = p;
      env.PATH = `${path.join(p, "bin")};${env.PATH || env.Path || ""}`;
      console.log(`☕ JAVA_HOME detectado automaticamente: ${p}`);
      break;
    }
  }
}

// 3. Compilar APK com Gradle
console.log("\n🔨 2/3 Compilando APK via Gradle (assembleDebug)...");
const gradlewCmd = process.platform === "win32" ? ".\\gradlew.bat assembleDebug" : "./gradlew assembleDebug";
execSync(gradlewCmd, { cwd: androidDir, env, stdio: "inherit" });

// 4. Copiar APK gerado para a raiz do projeto
console.log("\n📦 3/3 Atualizando arquivo EbookFinder.apk na raiz...");
if (fs.existsSync(apkSource)) {
  fs.copyFileSync(apkSource, apkDest);
  const stats = fs.statSync(apkDest);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n========================================================`);
  console.log(`✅ SUCESSO! APK atualizado e pronto para uso:`);
  console.log(`📍 Caminho: ${apkDest}`);
  console.log(`📊 Tamanho: ${sizeMB} MB`);
  console.log(`========================================================\n`);
} else {
  console.error("❌ Erro: Arquivo compilado app-debug.apk não encontrado.");
  process.exit(1);
}
