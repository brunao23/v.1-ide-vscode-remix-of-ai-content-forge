param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DbPassword,

  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,

  [string]$FunctionsEnvFile = "supabase/functions/.env",

  [switch]$SkipSecrets,

  [switch]$SkipFunctionsDeploy
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Cli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  $effectiveArgs = if ($Args.Length -gt 0 -and $Args[0] -eq "supabase") {
    $Args[1..($Args.Length - 1)]
  } else {
    $Args
  }

  $display = $effectiveArgs -join " "
  Write-Host "npx supabase $display" -ForegroundColor DarkGray
  & npx supabase @effectiveArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: npx supabase $display"
  }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$configPath = Join-Path $projectRoot "supabase/config.toml"
$resolvedFunctionsEnv = if ([System.IO.Path]::IsPathRooted($FunctionsEnvFile)) {
  $FunctionsEnvFile
} else {
  Join-Path $projectRoot $FunctionsEnvFile
}

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
  throw "SUPABASE_ACCESS_TOKEN nao informado. Passe -AccessToken ou exporte a variavel de ambiente."
}

if (-not (Test-Path $configPath)) {
  throw "Arquivo nao encontrado: $configPath"
}

Write-Step "Validando Supabase CLI"
Invoke-Cli -Args @("supabase", "--version")

Write-Step "Atualizando project_id no supabase/config.toml"
Set-Content -Path $configPath -Encoding UTF8 -NoNewline -Value "project_id = `"$ProjectRef`"`n"

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Step "Vinculando repositorio ao projeto remoto"
Invoke-Cli -Args @("supabase", "link", "--project-ref", $ProjectRef, "--password", $DbPassword)

Write-Step "Aplicando migrations no projeto remoto"
Invoke-Cli -Args @("supabase", "db", "push")

if (-not $SkipSecrets) {
  if (Test-Path $resolvedFunctionsEnv) {
    Write-Step "Sincronizando secrets das Edge Functions"
    Invoke-Cli -Args @("supabase", "secrets", "set", "--env-file", $resolvedFunctionsEnv, "--project-ref", $ProjectRef)
  } else {
    Write-Host "Arquivo de secrets nao encontrado: $resolvedFunctionsEnv" -ForegroundColor Yellow
    Write-Host "Pulando etapa de supabase secrets set." -ForegroundColor Yellow
  }
} else {
  Write-Host ""
  Write-Host "SkipSecrets ativado: segredos nao serao enviados." -ForegroundColor Yellow
}

if (-not $SkipFunctionsDeploy) {
  $functionsDir = Join-Path $projectRoot "supabase/functions"
  if (-not (Test-Path $functionsDir)) {
    throw "Pasta de functions nao encontrada: $functionsDir"
  }

  $functionNames = Get-ChildItem -Path $functionsDir -Directory | Select-Object -ExpandProperty Name
  if ($functionNames.Count -eq 0) {
    Write-Host "Nenhuma Edge Function encontrada para deploy." -ForegroundColor Yellow
  } else {
    Write-Step "Deploy das Edge Functions"
    foreach ($fn in $functionNames) {
      Invoke-Cli -Args @("supabase", "functions", "deploy", $fn, "--project-ref", $ProjectRef)
    }
  }
} else {
  Write-Host ""
  Write-Host "SkipFunctionsDeploy ativado: deploy das functions nao sera executado." -ForegroundColor Yellow
}

Write-Step "Provisionamento concluido"
Write-Host "Projeto Supabase: $ProjectRef" -ForegroundColor Green
Write-Host "Migrations aplicadas e ambiente remoto pronto para testes." -ForegroundColor Green
