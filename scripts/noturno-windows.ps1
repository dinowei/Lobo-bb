$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $repoRoot "logs\noturno"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ("noturno-{0}.log" -f (Get-Date -Format "yyyy-MM-dd_HHmmss"))

function Write-SafeLog {
  param([Parameter(ValueFromPipeline = $true)][object]$Line)
  process {
    $safe = [string]$Line
    $safe = [regex]::Replace($safe, 'nvapi-\S+', '[REDACTED_API_KEY]')
    $safe = [regex]::Replace($safe, '(?i)mongodb\+srv://[^\s"''<>]+', 'mongodb+srv://[REDACTED]')
    $safe = [regex]::Replace($safe, '(?i)(MONGODB_URI\s*=\s*)\S+', '$1[REDACTED]')
    $safe = [regex]::Replace($safe, '(?i)((?:GERADOR|AUDITOR|EMBED|NVIDIA_TTS)_API_KEY\s*=\s*)\S+', '$1[REDACTED]')
    $safe = [regex]::Replace($safe, '(?i)(Bearer\s+)\S+', '$1[REDACTED]')
    $safe = [regex]::Replace($safe, '\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL_REDACTED]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    Add-Content -LiteralPath $logFile -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $safe) -Encoding utf8
  }
}

$now = Get-Date
$janelaInicio = Get-Date -Hour 1 -Minute 0 -Second 0
$janelaFim = Get-Date -Hour 5 -Minute 30 -Second 0
if ($now -lt $janelaInicio -or $now -ge $janelaFim) {
  "Execução ignorada: fora da janela local de 01:00 a 05:30." | Write-SafeLog
  exit 0
}

$workersAnterior = $env:NOTURNO_TRABALHADORES
$localDefinido = $false
$codigoSaida = 1
try {
  Push-Location $repoRoot
  $localDefinido = $true
  $env:NOTURNO_TRABALHADORES = "1"
  "Iniciando noturno: janela até 05:30, um trabalhador de IA." | Write-SafeLog
  & npm.cmd run bb -- noturno --ate 05:30 2>&1 | ForEach-Object { $_ | Write-SafeLog }
  $codigoSaida = $LASTEXITCODE
  "Noturno encerrado com código $codigoSaida." | Write-SafeLog
} catch {
  ("Falha ao iniciar o noturno: {0}" -f $_.Exception.Message) | Write-SafeLog
  $codigoSaida = 1
} finally {
  if ($null -eq $workersAnterior) {
    Remove-Item Env:NOTURNO_TRABALHADORES -ErrorAction SilentlyContinue
  } else {
    $env:NOTURNO_TRABALHADORES = $workersAnterior
  }
  if ($localDefinido) { Pop-Location }
}

exit $codigoSaida
