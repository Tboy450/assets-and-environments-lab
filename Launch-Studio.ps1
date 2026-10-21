$ErrorActionPreference = 'Stop'
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $taskNode) { $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $taskNode)) { throw 'Node.js was not found. Install Node.js or update the runtime path in this launcher.' }
$taskData = Join-Path $PSScriptRoot 'data'
New-Item -ItemType Directory -Force -Path $taskData | Out-Null
$taskScript = Join-Path $PSScriptRoot 'server.mjs'
$taskExistingPidFile = Join-Path $taskData 'studio.pid'
$taskAlreadyRunning = $false
if (Test-Path -LiteralPath $taskExistingPidFile) {
  $taskPreviousId = [int](Get-Content -LiteralPath $taskExistingPidFile)
  $taskPrevious = Get-CimInstance Win32_Process -Filter "ProcessId = $taskPreviousId" -ErrorAction SilentlyContinue
  if ($taskPrevious -and $taskPrevious.CommandLine -and $taskPrevious.CommandLine.Contains($taskScript)) { $taskAlreadyRunning = $true }
}
if (-not $taskAlreadyRunning) {
  $taskProcess = Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskScript + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'server-output.log') -RedirectStandardError (Join-Path $taskData 'server-error.log') -PassThru
  Set-Content -LiteralPath $taskExistingPidFile -Value $taskProcess.Id
}
Write-Output 'Open http://127.0.0.1:4194/ for the Asset & Environment Studio in this workspace.'
