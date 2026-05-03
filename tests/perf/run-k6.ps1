param(
  [string]$BaseUrl = "http://localhost",
  [string]$Duration = "60s",
  [int]$Vus = 40,
  [int]$Rps = 800,
  [string]$OutJson = "tests/perf/k6-summary.json"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  Write-Error "k6 is not installed. Install from https://k6.io/docs/get-started/installation/"
}

Write-Host "Running k6 preview scenario..."
k6 run `
  --summary-export $OutJson `
  -e BASE_URL=$BaseUrl `
  -e DURATION=$Duration `
  -e VUS=$Vus `
  -e RPS=$Rps `
  tests/perf/k6-read-preview.js

Write-Host "k6 summary exported to $OutJson"
