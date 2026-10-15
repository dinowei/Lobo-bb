// Carrega o .env antes de qualquer outro módulo (importe este arquivo primeiro).
try {
  process.loadEnvFile();
} catch {
  // sem .env: segue com as variáveis do ambiente
}
