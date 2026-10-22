param([switch]$SmokeTest, [switch]$TestarTrava)

# LOG PRIMEIRO: nas noites de 21 e 22/10 o processo morreu sem deixar nenhuma linha. Agora a 1ª coisa é
# abrir o log (com reserva em %TEMP% se logs\ falhar), antes de fuso, trava ou Node.
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$repoRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $repoRoot "logs\noturno"
$timezoneBrt = $null
try { $timezoneBrt = [System.TimeZoneInfo]::FindSystemTimeZoneById("E. South America Standard Time") } catch { $timezoneBrt = $null }

function Get-BrasiliaNow {
  if ($timezoneBrt) { return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $timezoneBrt) }
  return [DateTime]::Now
}

try {
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $logFile = Join-Path $logDir ("{0}.log" -f (Get-BrasiliaNow).ToString("yyyy-MM-dd"))
  [System.IO.File]::AppendAllText($logFile, "", $utf8NoBom)
} catch {
  $logFile = Join-Path $env:TEMP ("lobo-noturno-{0}.log" -f (Get-BrasiliaNow).ToString("yyyy-MM-dd"))
}
[System.IO.File]::AppendAllText($logFile, ("[{0} BRT] Wrapper iniciado: PID {1}, usuário {2}, sessão {3}, fuso {4}.`r`n" -f (Get-BrasiliaNow).ToString("yyyy-MM-dd HH:mm:ss"), $PID, $env:USERNAME, [System.Diagnostics.Process]::GetCurrentProcess().SessionId, $(if ($timezoneBrt) { "BRT" } else { "local (BRT indisponível)" })), $utf8NoBom)

$ErrorActionPreference = "Stop"

function Protect-LogLine {
  param([string]$Text)
  $safe = [string]$Text
  $safe = [regex]::Replace($safe, 'nvapi-\S+', '[REDACTED_API_KEY]')
  $safe = [regex]::Replace($safe, '(?i)mongodb\+srv://[^\s"''<>]+', 'mongodb+srv://[REDACTED]')
  $safe = [regex]::Replace($safe, '(?i)(MONGODB_URI\s*=\s*)\S+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '(?i)([A-Z0-9_.-]*API_KEY\s*=\s*)\S+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '(?i)(Bearer\s+)\S+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', '[EMAIL_REDACTED]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  return $safe
}

function Write-SafeLog {
  param([Parameter(ValueFromPipeline = $true)][object]$Line)
  process {
    $safe = Protect-LogLine ([string]$Line)
    $timestamp = (Get-BrasiliaNow).ToString("yyyy-MM-dd HH:mm:ss")
    [System.IO.File]::AppendAllText($logFile, ("[{0} BRT] {1}`r`n" -f $timestamp, $safe), $utf8NoBom)
  }
}

function Invoke-LoggedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$Arguments,
    [datetime]$Deadline,
    [switch]$NoOrphanCleanup
  )

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo.FileName = $FilePath
  $process.StartInfo.Arguments = $Arguments
  $process.StartInfo.WorkingDirectory = $repoRoot
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true

  $timedOut = $false
  $started = $false
  $exitCode = 1
  $processId = 0
  try {
    $started = $process.Start()
    if (-not $started) { throw "Não foi possível iniciar o processo do noturno." }
    $processId = $process.Id
    $stdoutTask = $process.StandardOutput.ReadLineAsync()
    $stderrTask = $process.StandardError.ReadLineAsync()
    $stdoutDone = $false
    $stderrDone = $false
    while (-not $process.HasExited -or -not $stdoutDone -or -not $stderrDone) {
      if (-not $stdoutDone -and $stdoutTask.IsCompleted) {
        $line = $stdoutTask.GetAwaiter().GetResult()
        if ($null -eq $line) { $stdoutDone = $true } else { $line | Write-SafeLog; $stdoutTask = $process.StandardOutput.ReadLineAsync() }
      }
      if (-not $stderrDone -and $stderrTask.IsCompleted) {
        $line = $stderrTask.GetAwaiter().GetResult()
        if ($null -eq $line) { $stderrDone = $true } else { $line | Write-SafeLog; $stderrTask = $process.StandardError.ReadLineAsync() }
      }
      if (-not $process.HasExited -and $Deadline -and (Get-BrasiliaNow) -ge $Deadline) {
        "Limite operacional atingido; encerrando o processo filho." | Write-SafeLog
        $process.Kill()
        $timedOut = $true
      }
      if (-not $stdoutDone -or -not $stderrDone) { Start-Sleep -Milliseconds 50 }
    }
    $process.WaitForExit()
    $exitCode = $process.ExitCode
  } finally {
    if ($started -and -not $process.HasExited) {
      "Encerramento controlado; finalizando o processo filho." | Write-SafeLog
      try {
        $process.Kill()
        $process.WaitForExit()
        $timedOut = $true
      } catch {
        "Não foi possível confirmar o encerramento do processo filho." | Write-SafeLog
      }
    }
    if ($started -and $process.HasExited) { $exitCode = $process.ExitCode }
    $process.Dispose()
    if ($timedOut -and -not $NoOrphanCleanup -and $processId -gt 0) {
      "Conferindo e liberando somente uma trava órfã do PID $processId." | Write-SafeLog
      try {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        $cleanup = Invoke-LoggedProcess -FilePath $node -Arguments ("--import tsx src/cli.ts limpar-trava-orfa {0}" -f $processId) -Deadline ((Get-BrasiliaNow).AddSeconds(30)) -NoOrphanCleanup
        "Limpeza da trava órfã terminou com código $($cleanup.ExitCode)." | Write-SafeLog
      } catch {
        "Falha ao executar a limpeza segura da trava órfã." | Write-SafeLog
      }
    }
  }
  $code = if ($timedOut) { 124 } else { $exitCode }
  return [pscustomobject]@{ ExitCode = $code; TimedOut = $timedOut; Pid = $processId }
}

# ---------- trava com dono e validade ----------
# O arquivo fica aberto (o SO solta sozinho se o processo morrer) e guarda o dono em JSON: PID, início, host.
# Quem não consegue abrir lê o dono: vivo e com menos de 6 h = em andamento (sai limpo); PID morto ou mais
# velho que 6 h = órfã (o noturno dura no máximo 4h30): encerra só o wrapper travado deste script e assume.
$VALIDADE_TRAVA_HORAS = 6
function Get-SituacaoTrava {
  param($Dono, [datetime]$Agora, [bool]$PidVivo)
  if ($null -eq $Dono -or -not $Dono.inicio) { return "orfa" }
  if (-not $PidVivo) { return "orfa" }
  if (($Agora - [datetime]$Dono.inicio).TotalHours -ge $VALIDADE_TRAVA_HORAS) { return "orfa" }
  return "ativa"
}
function Read-DonoTrava {
  param([string]$Caminho)
  try {
    $fs = [System.IO.File]::Open($Caminho, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try { $txt = (New-Object System.IO.StreamReader($fs, $utf8NoBom)).ReadToEnd() } finally { $fs.Dispose() }
    if ($txt.Trim()) { return ($txt | ConvertFrom-Json) }
  } catch { }
  return $null
}
function Open-Trava {
  param([string]$Caminho)
  $fs = [System.IO.File]::Open($Caminho, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)
  $dono = @{ pid = $PID; inicio = (Get-Date).ToString("o"); host = $env:COMPUTERNAME } | ConvertTo-Json -Compress
  $bytes = $utf8NoBom.GetBytes($dono)
  $fs.SetLength(0); $fs.Write($bytes, 0, $bytes.Length); $fs.Flush()
  return $fs
}
function Get-Trava {
  param([string]$Caminho)
  try { return Open-Trava $Caminho } catch [System.IO.IOException] { }
  $dono = Read-DonoTrava $Caminho
  $vivo = $false
  if ($dono -and $dono.pid) { $vivo = [bool](Get-Process -Id ([int]$dono.pid) -ErrorAction SilentlyContinue) }
  $situacao = Get-SituacaoTrava -Dono $dono -Agora (Get-Date) -PidVivo $vivo
  if ($situacao -eq "ativa") {
    ("Execução ignorada: já existe um noturno em andamento (PID {0} desde {1})." -f $dono.pid, $dono.inicio) | Write-SafeLog
    return $null
  }
  ("Trava órfã encontrada (PID {0}, desde {1}, processo {2}): liberando." -f $dono.pid, $dono.inicio, $(if ($vivo) { "vivo há mais de $VALIDADE_TRAVA_HORAS h" } else { "morto" })) | Write-SafeLog
  if ($vivo) {
    # só encerra se for mesmo um wrapper deste script (nunca outro programa com o mesmo PID)
    $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$dono.pid)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmd -and $cmd -like "*noturno-windows.ps1*") {
      Stop-Process -Id ([int]$dono.pid) -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 2
      "Wrapper travado encerrado." | Write-SafeLog
    } else {
      "O PID da trava não é um wrapper do noturno; não encerro nada e saio." | Write-SafeLog
      return $null
    }
  }
  try { return Open-Trava $Caminho } catch [System.IO.IOException] {
    "Não consegui assumir a trava depois de liberar a órfã; saio sem rodar." | Write-SafeLog
    return $null
  }
}

$lockPath = Join-Path $logDir "noturno.lock"
$runLock = $null
$codigoSaida = 1
$workersAnterior = $env:NOTURNO_TRABALHADORES
$processoNoturno = $null
try {
  if ($TestarTrava) {
    # teste da regra da trava (sem Atlas, sem Node): casos de dono e validade
    $agora = Get-Date
    $casos = @(
      @{ nome = "sem dono"; dono = $null; vivo = $false; esperado = "orfa" },
      @{ nome = "PID morto"; dono = @{ pid = 1; inicio = $agora.AddMinutes(-10).ToString("o") }; vivo = $false; esperado = "orfa" },
      @{ nome = "vivo e recente"; dono = @{ pid = 1; inicio = $agora.AddHours(-2).ToString("o") }; vivo = $true; esperado = "ativa" },
      @{ nome = "vivo há 6 h"; dono = @{ pid = 1; inicio = $agora.AddHours(-6).ToString("o") }; vivo = $true; esperado = "orfa" }
    )
    foreach ($c in $casos) {
      $obtido = Get-SituacaoTrava -Dono $c.dono -Agora $agora -PidVivo $c.vivo
      if ($obtido -ne $c.esperado) { throw "Teste da trava falhou em '$($c.nome)': $obtido (esperado $($c.esperado))." }
    }
    # trava real: a 1ª pega e grava o dono; a 2ª (outra abertura) vê "em andamento" e sai limpa
    $teste = Join-Path $env:TEMP ("lobo-trava-teste-{0}.lock" -f $PID)
    $a = Get-Trava $teste
    if (-not $a) { throw "Teste da trava falhou: não pegou a trava livre." }
    $dono = Read-DonoTrava $teste
    if ([int]$dono.pid -ne $PID) { throw "Teste da trava falhou: dono gravado errado." }
    $b = Get-Trava $teste
    if ($b) { throw "Teste da trava falhou: pegou a trava ocupada." }
    $a.Dispose()
    $c2 = Get-Trava $teste
    if (-not $c2) { throw "Teste da trava falhou: não retomou depois de solta." }
    $c2.Dispose(); Remove-Item $teste -Force
    "Teste da trava ok: 4 casos de dono/validade, trava ocupada sai limpa, trava solta é retomada." | Write-SafeLog
    $codigoSaida = 0
  } else {
    $runLock = Get-Trava $lockPath
    if (-not $runLock) { $codigoSaida = 0 }
  }

  if ($runLock) {
    $now = Get-BrasiliaNow
    $janelaInicio = $now.Date.AddHours(1)
    $janelaFim = $now.Date.AddHours(5).AddMinutes(30)
    if (-not $SmokeTest -and ($now -lt $janelaInicio -or $now -ge $janelaFim)) {
      "Execução ignorada: fora da janela BRT de 01:00 a 05:30." | Write-SafeLog
      $codigoSaida = 0
    } elseif ($SmokeTest) {
      "Início do smoke test, sem conexão com o Atlas e sem job de IA." | Write-SafeLog
      $node = (Get-Command node.exe -ErrorAction Stop).Source
      $offsetAntesDaSaida = [System.IO.FileInfo]::new($logFile).Length
      $fakeOutput = '-e "console.log(''nvapi-FAKE-KEY-DO-NOT-USE mongodb+srv://fake:secret@cluster.invalid/bb MONGODB_URI=mongodb+srv://fake:secret@cluster.invalid/bb NVIDIA_API_KEY=FAKE-KEY aluno@example.invalid'')"'
      $normal = Invoke-LoggedProcess -FilePath $node -Arguments $fakeOutput -Deadline ((Get-BrasiliaNow).AddSeconds(20))
      $bytesDoLog = [System.IO.File]::ReadAllBytes($logFile)
      $conteudo = $utf8NoBom.GetString($bytesDoLog, [int]$offsetAntesDaSaida, $bytesDoLog.Length - [int]$offsetAntesDaSaida)
      if ($normal.ExitCode -ne 0 -or $normal.TimedOut -or $conteudo.Contains("FAKE-KEY-DO-NOT-USE") -or $conteudo.Contains("NVIDIA_API_KEY=FAKE-KEY") -or $conteudo.Contains("fake:secret@") -or $conteudo.Contains("aluno@example.invalid") -or -not $conteudo.Contains("[REDACTED_API_KEY]") -or -not $conteudo.Contains("[EMAIL_REDACTED]")) {
        throw "Smoke test falhou: verificação de processo ou mascaramento de log não passou."
      }
      $lento = Invoke-LoggedProcess -FilePath $node -Arguments '-e "setTimeout(() => {}, 10000)"' -Deadline ((Get-BrasiliaNow).AddSeconds(2)) -NoOrphanCleanup
      $processoRestante = Get-Process -Id $lento.Pid -ErrorAction SilentlyContinue
      if (-not $lento.TimedOut -or $lento.ExitCode -ne 124 -or $processoRestante) { throw "Smoke test falhou: timeout não encerrou o processo filho." }
      "Fim do smoke test: saída mascarada, timeout aplicado e nenhum job do Atlas iniciado." | Write-SafeLog
      $codigoSaida = 0
    } else {
      $env:NOTURNO_TRABALHADORES = "2"
      "Início do noturno: dois trabalhadores; janela BRT até 05:30; log diário." | Write-SafeLog
      $node = (Get-Command node.exe -ErrorAction Stop).Source
      $processoNoturno = Invoke-LoggedProcess -FilePath $node -Arguments '--import tsx src/cli.ts noturno --ate 05:25' -Deadline $janelaFim.AddMinutes(-1)
      $codigoSaida = $processoNoturno.ExitCode
      if ($processoNoturno.TimedOut) { $codigoSaida = 124 }
      "Fim do noturno com código $codigoSaida." | Write-SafeLog
    }
  }
} catch {
  ("Falha no noturno: {0}" -f $_.Exception.Message) | Write-SafeLog
  $codigoSaida = 1
} finally {
  "Finalizando wrapper do noturno." | Write-SafeLog
  if ($null -eq $workersAnterior) {
    Remove-Item Env:NOTURNO_TRABALHADORES -ErrorAction SilentlyContinue
  } else {
    $env:NOTURNO_TRABALHADORES = $workersAnterior
  }
  if ($runLock) { $runLock.Dispose() }
  "Trava local do wrapper liberada." | Write-SafeLog
}

"Script PowerShell encerrado." | Write-SafeLog
[System.Environment]::Exit($codigoSaida)
