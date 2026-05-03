param(
  [string]$Namespace = "api-control-plane",
  [Parameter(Mandatory = $true)][string]$Service,
  [Parameter(Mandatory = $true)][string]$Image,
  [switch]$RunSloGate,
  [string]$BaseUrl = "http://localhost",
  [string]$Duration = "60s",
  [int]$Vus = 40,
  [int]$Rps = 800,
  [string]$SummaryJson = "tests/perf/k6-summary.json",
  [double]$P95Ms = 50,
  [double]$P99Ms = 150,
  [double]$ErrRate = 0.001,
  [bool]$AutoRollbackOnFailure = $true
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  Write-Error "kubectl is not installed or not in PATH"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$runK6Script = Join-Path $repoRoot "tests/perf/run-k6.ps1"
$checkSloScript = Join-Path $repoRoot "scripts/check-slo.ps1"

function Resolve-RepoPath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return (Join-Path $repoRoot $PathValue)
}

Write-Host "Updating deployment image..."
kubectl set image deployment/$Service $Service=$Image -n $Namespace

Write-Host "Waiting for rollout to finish..."
kubectl rollout status deployment/$Service -n $Namespace --timeout=180s

if ($RunSloGate) {
  if (-not (Test-Path $runK6Script)) {
    Write-Error "Load test script not found: $runK6Script"
  }

  if (-not (Test-Path $checkSloScript)) {
    Write-Error "SLO checker script not found: $checkSloScript"
  }

  $summaryPath = Resolve-RepoPath -PathValue $SummaryJson
  $summaryDir = Split-Path -Parent $summaryPath
  if ($summaryDir -and -not (Test-Path $summaryDir)) {
    New-Item -ItemType Directory -Path $summaryDir | Out-Null
  }

  Write-Host "Running SLO gate checks..."
  try {
    & $runK6Script -BaseUrl $BaseUrl -Duration $Duration -Vus $Vus -Rps $Rps -OutJson $summaryPath
    & $checkSloScript -SummaryJson $summaryPath -P95Ms $P95Ms -P99Ms $P99Ms -ErrRate $ErrRate
    Write-Host "SLO gate passed"
  }
  catch {
    Write-Host "SLO gate failed: $($_.Exception.Message)"
    if ($AutoRollbackOnFailure) {
      Write-Host "Rolling back deployment..."
      kubectl rollout undo deployment/$Service -n $Namespace
      kubectl rollout status deployment/$Service -n $Namespace --timeout=180s
    }
    throw
  }
}

Write-Host "Current pods:"
kubectl get pods -n $Namespace -l app=$Service
