param(
  [string]$SourcePath = "Agentes IA",
  [string]$EnvFilePath = "supabase/functions/.env",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Resolve-AbsolutePath {
  param([string]$Path)

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return (Resolve-Path -Path $Path).Path
  }

  $root = Resolve-Path -Path (Join-Path $PSScriptRoot "..")
  return (Resolve-Path -Path (Join-Path $root $Path)).Path
}

function Get-EnvMap {
  param([string]$Path)

  $envMap = @{}
  Get-Content -Path $Path | ForEach-Object {
    if ($_ -match '^([A-Z0-9_]+)=(.*)$') {
      $envMap[$matches[1]] = $matches[2]
    }
  }
  return $envMap
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
    [object]$Body = $null,
    [hashtable]$ExtraHeaders = $null
  )

  $headers = @{
    apikey        = $ServiceRoleKey
    Authorization = "Bearer $ServiceRoleKey"
  }

  if ($ExtraHeaders) {
    foreach ($k in $ExtraHeaders.Keys) {
      $headers[$k] = $ExtraHeaders[$k]
    }
  }

  try {
    if ($null -eq $Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers
    }

    $json = $Body | ConvertTo-Json -Depth 32 -Compress
    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    if (-not $headers.ContainsKey("Content-Type")) {
      $headers["Content-Type"] = "application/json; charset=utf-8"
    }
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

function Encode-ForEqFilter {
  param([string]$Value)
  return [uri]::EscapeDataString($Value)
}

function Get-FilePath {
  param(
    [string]$SourceRoot,
    [string]$Relative
  )
  $resolved = Resolve-Path -Path (Join-Path $SourceRoot $Relative)
  if ($resolved -is [System.Array]) {
    return $resolved[0].Path
  }
  return $resolved.Path
}

$sourceRoot = Resolve-AbsolutePath -Path $SourcePath
$envPath = Resolve-AbsolutePath -Path $EnvFilePath
$envMap = Get-EnvMap -Path $envPath

if (-not $envMap.ContainsKey("SUPABASE_URL") -or -not $envMap.ContainsKey("SUPABASE_SERVICE_ROLE_KEY")) {
  throw "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no arquivo .env"
}

$supabaseUrl = $envMap["SUPABASE_URL"]
$serviceRoleKey = $envMap["SUPABASE_SERVICE_ROLE_KEY"]

$promptDefinitions = @(
  @{ Relative = "01. Agente IA Brand Book (Claude)\Instru* Principal.docx"; Targets = @(
      @{ AgentId = "brand-book"; UsesDocuments = $false; Requires = @() }
    )
  },
  @{ Relative = "04. Agente IA Mapa do ICP (Claude)\PROMPT.docx"; Targets = @(
      @{ AgentId = "icp-architect"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa") },
      @{ AgentId = "arquiteta-perfil-icp"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp") }
    )
  },
  @{ Relative = "05. Agente IA Pilares e Sub Pilares de Conte*do (Claude)\PROMPT.docx"; Targets = @(
      @{ AgentId = "pillar-strategist"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "pilares") }
    )
  },
  @{ Relative = "06. Agente IA Gerente de Marketing (Claude)\Prompt * Gerente de Marketing*.docx"; Targets = @(
      @{ AgentId = "marketing-manager"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "pilares", "matriz") }
    )
  },
  @{ Relative = "07. Agente IA Pesquisa e Curadoria (sem RAG) - USA PERPLEXITY AI\Documento sem t*tulo.docx"; Targets = @(
      @{ AgentId = "market-research"; UsesDocuments = $false; Requires = @() }
    )
  },
  @{ Relative = "08. Agente IA Roteirista -- Copywriter (Claude)\Prompt * Agente Roteirista.docx"; Targets = @(
      @{ AgentId = "scriptwriter"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "pilares", "matriz", "calendario", "roteiro") },
      @{ AgentId = "copywriter-campanhas"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "pilares", "matriz", "calendario", "roteiro") }
    )
  },
  @{ Relative = "09. Agente IA Revisora -- Sombra (Claude)\PROMPT.docx"; Targets = @(
      @{ AgentId = "feedback-conteudo"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "pilares", "matriz", "calendario", "roteiro", "outro") }
    )
  },
  @{ Relative = "Agente Voz de Marca\prompt.docx"; Targets = @(
      @{ AgentId = "voz-de-marca"; UsesDocuments = $true; Requires = @("outro", "brand-book", "pesquisa", "icp", "roteiro") }
    )
  },
  @{ Relative = "03. Agente Mecanismo Assinatura* (Claude)\PROMPT.docx"; Targets = @(
      @{ AgentId = "criador-documento-oferta"; UsesDocuments = $true; Requires = @("brand-book", "pesquisa", "icp", "calendario", "roteiro") }
    )
  },
  @{ Relative = "04. Agente SistemaRivotril*\PROMPT (REVISAR).docx"; Targets = @(
      @{ AgentId = "programa-rivotril"; UsesDocuments = $false; Requires = @() }
    )
  }
)

$systemDocDefinitions = @(
  @{
    Relative = "01. Agente IA Brand Book (Claude)\ban list.docx"
    Name = "Agente IA Brand Book - ban list"
    AppliesTo = @("brand-book")
    Mandatory = $true
  },
  @{
    Relative = "01. Agente IA Brand Book (Claude)\estrutura_output.docx"
    Name = "Agente IA Brand Book - estrutura_output"
    AppliesTo = @("brand-book")
    Mandatory = $true
  },
  @{
    Relative = "01. Agente IA Brand Book (Claude)\perguntas.docx"
    Name = "Agente IA Brand Book - perguntas"
    AppliesTo = @("brand-book")
    Mandatory = $true
  },
  @{
    Relative = "06. Agente IA Gerente de Marketing (Claude)\ban_list.docx"
    Name = "Agente IA Gerente de Marketing - ban_list"
    AppliesTo = @("marketing-manager")
    Mandatory = $true
  },
  @{
    Relative = "06. Agente IA Gerente de Marketing (Claude)\Padroes de Comunicacao.docx"
    Name = "Agente IA Gerente de Marketing - Padroes de Comunicacao"
    AppliesTo = @("marketing-manager")
    Mandatory = $true
  },
  @{
    Relative = "08. Agente IA Roteirista -- Copywriter (Claude)\Ganchos Validados.docx"
    Name = "Agente IA Roteirista Copywriter - Ganchos Validados"
    AppliesTo = @("scriptwriter", "copywriter-campanhas")
    Mandatory = $false
  },
  @{
    Relative = "Agente Voz de Marca\exemplo_output.md.docx"
    Name = "Agente Voz de Marca - exemplo_output"
    AppliesTo = @("voz-de-marca")
    Mandatory = $false
  }
)

$legacySystemDocNamesToDisable = @(
  "ban list.docx",
  "estrutura_output.docx",
  "Instrução Principal.docx",
  "perguntas.docx",
  "ban_list.docx",
  "Padroes de Comunicacao.docx",
  "Prompt _Instruções_ Gerente de Marketing_.docx",
  "Documento sem título.docx",
  "Ganchos Validados.docx",
  "Prompt _Instruções_ Agente Roteirista.docx",
  "PROMPT.docx",
  "prompt.docx",
  "exemplo_output.md.docx",
  "Agente IA Brand Book - Instru??o Principal",
  "Agente IA Gerente de Marketing - Prompt Instru??es",
  "Agente IA Roteirista Copywriter - Prompt Instru??es",
  "Agente IA Brand Book - Instrução Principal",
  "Agente IA Gerente de Marketing - Prompt Instruções",
  "Agente IA Roteirista Copywriter - Prompt Instruções"
)

$canonicalSystemDocNames = $systemDocDefinitions | ForEach-Object { $_.Name }

$appliedPromptUpdates = New-Object System.Collections.Generic.List[string]
$appliedDocUpdates = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

$agentRows = Invoke-SupabaseRest -Method "GET" -Url "$supabaseUrl/rest/v1/agent_prompts?select=id,agent_id,name,description,recommended_model" -ServiceRoleKey $serviceRoleKey
$agentMap = @{}
foreach ($row in $agentRows) {
  $agentMap[$row.agent_id] = $row
}

$allSystemDocs = Invoke-SupabaseRest -Method "GET" -Url "$supabaseUrl/rest/v1/system_documents?select=id,name,is_active" -ServiceRoleKey $serviceRoleKey
foreach ($row in $allSystemDocs) {
  $isLegacyNamed = ($legacySystemDocNamesToDisable -contains $row.name)
  $isRawDocxName = [string]$row.name -match '\.docx$'
  if (($isLegacyNamed -or $isRawDocxName) -and -not ($canonicalSystemDocNames -contains $row.name)) {
    if ($DryRun) {
      $appliedDocUpdates.Add("DRYRUN deactivate legacy system_document: $($row.name)")
    } else {
      Invoke-SupabaseRest -Method "PATCH" -Url "$supabaseUrl/rest/v1/system_documents?id=eq.$($row.id)" -ServiceRoleKey $serviceRoleKey -Body @{ is_active = $false } | Out-Null
      $appliedDocUpdates.Add("Deactivated legacy system_document: $($row.name)")
    }
  }
}

foreach ($definition in $systemDocDefinitions) {
  $filePath = Get-FilePath -SourceRoot $sourceRoot -Relative $definition.Relative
  $content = Get-DocxText -Path $filePath
  if ([string]::IsNullOrWhiteSpace($content)) {
    $warnings.Add("System document vazio: $($definition.Relative)")
    continue
  }

  $payload = @{
    name = $definition.Name
    content = $content
    applies_to_agents = $definition.AppliesTo
    is_mandatory = [bool]$definition.Mandatory
    is_active = $true
  }

  if ($DryRun) {
    $appliedDocUpdates.Add("DRYRUN upsert system_document: $($definition.Name)")
    continue
  }

  $nameEncoded = Encode-ForEqFilter -Value $definition.Name
  $existing = Invoke-SupabaseRest -Method "GET" -Url "$supabaseUrl/rest/v1/system_documents?select=id&name=eq.$nameEncoded&limit=1" -ServiceRoleKey $serviceRoleKey
  if ($existing -and $existing.Count -gt 0) {
    Invoke-SupabaseRest -Method "PATCH" -Url "$supabaseUrl/rest/v1/system_documents?id=eq.$($existing[0].id)" -ServiceRoleKey $serviceRoleKey -Body $payload | Out-Null
    $appliedDocUpdates.Add("Updated system_document: $($definition.Name)")
  } else {
    Invoke-SupabaseRest -Method "POST" -Url "$supabaseUrl/rest/v1/system_documents" -ServiceRoleKey $serviceRoleKey -Body $payload | Out-Null
    $appliedDocUpdates.Add("Inserted system_document: $($definition.Name)")
  }
}

foreach ($definition in $promptDefinitions) {
  $filePath = Get-FilePath -SourceRoot $sourceRoot -Relative $definition.Relative
  $content = Get-DocxText -Path $filePath
  if ([string]::IsNullOrWhiteSpace($content)) {
    $warnings.Add("Prompt vazio: $($definition.Relative)")
    continue
  }

  foreach ($target in $definition.Targets) {
    $agentId = $target.AgentId
    if (-not $agentMap.ContainsKey($agentId)) {
      $warnings.Add("agent_id nao encontrado em agent_prompts: $agentId")
      continue
    }

    $existing = $agentMap[$agentId]
    $payload = @{
      agent_id = $agentId
      name = $existing.name
      description = $existing.description
      recommended_model = $existing.recommended_model
      system_prompt = $content
      requires_documents = $target.Requires
      uses_documents_context = [bool]$target.UsesDocuments
    }

    if ($DryRun) {
      $appliedPromptUpdates.Add("DRYRUN upsert prompt: $agentId (len=$($content.Length))")
      continue
    }

    Invoke-SupabaseRest `
      -Method "POST" `
      -Url "$supabaseUrl/rest/v1/agent_prompts?on_conflict=agent_id" `
      -ServiceRoleKey $serviceRoleKey `
      -Body $payload `
      -ExtraHeaders @{ Prefer = "resolution=merge-duplicates,return=representation" } | Out-Null

    $appliedPromptUpdates.Add("Upserted prompt: $agentId (len=$($content.Length))")
  }
}

Write-Output ""
Write-Output "Sync concluido."
Write-Output "SourcePath: $sourceRoot"
Write-Output "Prompts atualizados: $($appliedPromptUpdates.Count)"
$appliedPromptUpdates | ForEach-Object { Write-Output $_ }
Write-Output ""
Write-Output "System documents atualizados: $($appliedDocUpdates.Count)"
$appliedDocUpdates | ForEach-Object { Write-Output $_ }
Write-Output ""
Write-Output "Warnings: $($warnings.Count)"
$warnings | ForEach-Object { Write-Output $_ }
