param(
  [string]$SummaryJson = "tests/perf/k6-summary.json",
  [double]$P95Ms = 50,
  [double]$P99Ms = 150,
  [double]$ErrRate = 0.001
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SummaryJson)) {
  Write-Error "Summary file not found: $SummaryJson"
}

$data = Get-Content $SummaryJson -Raw | ConvertFrom-Json

function Get-MetricValue {
  param(
    [object]$Metric,
    [string]$Field
  )
  if ($null -eq $Metric -or $null -eq $Metric.values -or $null -eq $Metric.values.$Field) {
    return $null
  }
  return [double]$Metric.values.$Field
}

$httpReqDuration = $data.metrics.http_req_duration
$httpReqFailed = $data.metrics.http_req_failed

$p95 = Get-MetricValue -Metric $httpReqDuration -Field "p(95)"
$p99 = Get-MetricValue -Metric $httpReqDuration -Field "p(99)"
$failedRate = Get-MetricValue -Metric $httpReqFailed -Field "rate"

if ($null -eq $p95 -or $null -eq $p99 -or $null -eq $failedRate) {
  Write-Error "Missing required metrics in k6 summary file."
}

$violations = @()
if ($p95 -ge $P95Ms) {
  $violations += "P95 too high: $p95 ms >= $P95Ms ms"
}
if ($p99 -ge $P99Ms) {
  $violations += "P99 too high: $p99 ms >= $P99Ms ms"
}
if ($failedRate -ge $ErrRate) {
  $violations += "Error rate too high: $failedRate >= $ErrRate"
}

Write-Host "SLO report"
Write-Host "- P95: $p95 ms"
Write-Host "- P99: $p99 ms"
Write-Host "- Error rate: $failedRate"

if ($violations.Count -gt 0) {
  Write-Host "SLO FAILED"
  $violations | ForEach-Object { Write-Host "- $_" }
  exit 2
}

Write-Host "SLO PASSED"
