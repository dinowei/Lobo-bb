param([switch]$SmokeTest)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $repoRoot "logs\noturno"
$timezoneId = "E. South America Standard Time"
$timezoneBrt = [System.TimeZoneInfo]::FindSystemTimeZoneById($timezoneId)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$nowBrt = [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $timezoneBrt)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir ("{0}.log" -f $nowBrt.ToString("yyyy-MM-dd"))

function Get-BrasiliaNow {
  return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $timezoneBrt)
}

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

$lockPath = Join-Path $logDir "noturno.lock"
$runLock = $null
$codigoSaida = 1
$workersAnterior = $env:NOTURNO_TRABALHADORES
$processoNoturno = $null
try {
  try {
    $runLock = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  } catch [System.IO.IOException] {
    "Execução ignorada: já existe um noturno em andamento." | Write-SafeLog
    $codigoSaida = 0
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
      $processoNoturno = Invoke-LoggedProcess -FilePath $node -Arguments '--import tsx src/cli.ts noturno --ate 05:30' -Deadline $janelaFim.AddMinutes(-1)
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
