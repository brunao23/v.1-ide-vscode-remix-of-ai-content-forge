param(
  [string]$SourcePath = "C:\Users\WINDOWS\OneDrive\Documentos\Amanda\agentes",
  [string]$EnvFilePath = "supabase/functions/.env"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  $line = Get-Content $FilePath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (-not $line) {
    throw "Chave '$Key' nao encontrada em $FilePath"
  }

  return $line.Split("=", 2)[1].Trim()
}

function Get-DocxText {
  param([string]$Path)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" } | Select-Object -First 1
    if (-not $entry) {
      throw "Arquivo DOCX sem word/document.xml: $Path"
    }

    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xmlRaw = $reader.ReadToEnd()
    $reader.Close()
  } finally {
    $zip.Dispose()
  }

  [xml]$xml = $xmlRaw
  $paragraphs = $xml.GetElementsByTagName("w:p")
  $lines = @()

  foreach ($p in $paragraphs) {
    $runs = $p.GetElementsByTagName("w:t")
    $parts = @()
    foreach ($r in $runs) {
      if ($r.InnerText) {
        $parts += $r.InnerText
      }
    }

    if ($parts.Count -gt 0) {
      $lines += ($parts -join "")
    }
  }

  $content = ($lines -join "`n")
  $content = $content -replace "[\x00-\x08\x0B\x0C\x0E-\x1F]", ""
  return $content.Trim()
}

function Invoke-SupabaseRest {
  param(
    [string]$Method,
    [string]$Url,
    [string]$ServiceRoleKey,
    [object]$Body = $null
  )

  $headers = @{
    apikey        = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
  }

  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
    }

    $json = $Body | ConvertTo-Json -Depth 20 -Compress
    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $headers["Content-Type"] = "application/json; charset=utf-8"
    $headers["Prefer"] = "return=representation"

    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $jsonBytes
  } catch {
    $message = "Falha REST [$Method] $Url"
    if ($_.Exception.Response) {
      $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
      $responseBody = $reader.ReadToEnd()
      $reader.Close()
      throw "$message | $responseBody"
    }
    throw "$message | $($_.Exception.Message)"
  }
}

function ConvertTo-PgTextArrayLiteral {
  param([string[]]$Values)

  if (-not $Values -or $Values.Count -eq 0) {
    return "{}"
  }

  $escaped = $Values | ForEach-Object {
    '"' + ($_.Replace('\', '\\').Replace('"', '\"')) + '"'
  }

  return "{" + ($escaped -join ",") + "}"
}

if (-not (Test-Path $SourcePath)) {
  throw "Pasta de origem nao encontrada: $SourcePath"
}

if (-not (Test-Path $EnvFilePath)) {
  throw "Arquivo de ambiente nao encontrado: $EnvFilePath"
}

$supabaseUrl = Get-EnvValue -FilePath $EnvFilePath -Key "SUPABASE_URL"
$serviceRoleKey = Get-EnvValue -FilePath $EnvFilePath -Key "SUPABASE_SERVICE_ROLE_KEY"

$folderAgentMap = @{
  "Agente IA Brand Book"                                               = @("brand-book")
  "Agente IA Gerente de Marketing"                                     = @("marketing-manager")
  "Agente IA Pesquisa e Curadoria (sem RAG) - USA PERPLEXITY AI"      = @("market-research")
  "Agente IA Revisora -- Sombra"                                       = @("feedback-conteudo")
  "Agente IA Roteirista -- Copywriter"                                 = @("scriptwriter", "copywriter-campanhas")
  "Agente Voz de Marca"                                                = @("scriptwriter", "copywriter-campanhas", "marketing-manager")
}

$docxFiles = Get-ChildItem -Path $SourcePath -Recurse -File -Filter "*.docx"
if ($docxFiles.Count -eq 0) {
  throw "Nenhum arquivo .docx encontrado em $SourcePath"
}

$upserted = @()

foreach ($file in $docxFiles) {
  $folderName = Split-Path $file.DirectoryName -Leaf
  $agents = if ($folderAgentMap.ContainsKey($folderName)) { [string[]]$folderAgentMap[$folderName] } else { [string[]]@() }
  $content = Get-DocxText -Path $file.FullName

  if ([string]::IsNullOrWhiteSpace($content)) {
    Write-Output "SKIP vazio: $($file.FullName)"
    continue
  }

  $payload = @{
    name              = $file.Name
    content           = $content
    applies_to_agents = ConvertTo-PgTextArrayLiteral -Values $agents
    is_mandatory      = $false
    is_active         = $true
  }

  $encodedName = [uri]::EscapeDataString($file.Name)
  $checkUrl = "$supabaseUrl/rest/v1/system_documents?select=id&name=eq.$encodedName&limit=1"
  $existing = Invoke-SupabaseRest -Method "GET" -Url $checkUrl -ServiceRoleKey $serviceRoleKey

  if ($existing -and $existing.Count -gt 0) {
    $docId = $existing[0].id
    $updateUrl = "$supabaseUrl/rest/v1/system_documents?id=eq.$docId"
    [void](Invoke-SupabaseRest -Method "PATCH" -Url $updateUrl -ServiceRoleKey $serviceRoleKey -Body $payload)
    $upserted += "UPDATE $($file.Name)"
  } else {
    [void](Invoke-SupabaseRest -Method "POST" -Url "$supabaseUrl/rest/v1/system_documents" -ServiceRoleKey $serviceRoleKey -Body $payload)
    $upserted += "INSERT $($file.Name)"
  }
}

# Mantem o agente de pesquisa sem contexto de documentos
[void](Invoke-SupabaseRest -Method "PATCH" -Url "$supabaseUrl/rest/v1/agent_prompts?agent_id=eq.market-research" -ServiceRoleKey $serviceRoleKey -Body @{ uses_documents_context = $false })

# Limpeza de registros temporarios de debug
$cleanupNames = @("debug-ban-list", "debug-ban-list-utf8", "teste", "tmp ban list", "tmp ban list 2")
foreach ($n in $cleanupNames) {
  $encoded = [uri]::EscapeDataString($n)
  Invoke-SupabaseRest -Method "DELETE" -Url "$supabaseUrl/rest/v1/system_documents?name=eq.$encoded" -ServiceRoleKey $serviceRoleKey | Out-Null
}

Write-Output ""
Write-Output "Importacao concluida."
Write-Output "Arquivos processados: $($docxFiles.Count)"
Write-Output "Registros aplicados: $($upserted.Count)"
$upserted | ForEach-Object { Write-Output $_ }
