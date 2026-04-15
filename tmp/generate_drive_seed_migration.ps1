$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-DocxText {
  param([string]$Path)
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1
    if (-not $entry) { throw "DOCX sem word/document.xml: $Path" }
    $reader = New-Object System.IO.StreamReader($entry.Open())
    $xmlRaw = $reader.ReadToEnd()
    $reader.Close()
  } finally {
    $zip.Dispose()
  }

  [xml]$xml = $xmlRaw
  $paragraphs = $xml.GetElementsByTagName('w:p')
  $lines = @()
  foreach ($p in $paragraphs) {
    $runs = $p.GetElementsByTagName('w:t')
    $parts = @()
    foreach ($r in $runs) {
      if ($r.InnerText) { $parts += $r.InnerText }
    }
    if ($parts.Count -gt 0) { $lines += ($parts -join '') }
  }

  $content = ($lines -join "`n")
  $content = $content -replace "[\x00-\x08\x0B\x0C\x0E-\x1F]", ''
  return $content.Trim()
}

function To-SqlTextArray {
  param([string[]]$Values)
  if (-not $Values -or $Values.Count -eq 0) { return "ARRAY[]::text[]" }
  $escaped = $Values | ForEach-Object { "'" + ($_.Replace("'", "''")) + "'" }
  return "ARRAY[" + ($escaped -join ',') + "]::text[]"
}

$base = 'C:\Users\WINDOWS\OneDrive\Documentos\Amanda\agentes'
$migrationPath = 'supabase/migrations/20260413170000_seed_drive_agents_prompts_and_docs.sql'

$docs = @(
  @{ Name='ban list.docx'; Path=(Join-Path $base 'Agente IA Brand Book\ban list.docx'); Agents=@('brand-book'); Mandatory=$true },
  @{ Name='estrutura_output.docx'; Path=(Join-Path $base 'Agente IA Brand Book\estrutura_output.docx'); Agents=@('brand-book'); Mandatory=$true },
  @{ Name='Instrução Principal.docx'; Path=(Join-Path $base 'Agente IA Brand Book\Instrução Principal.docx'); Agents=@('brand-book'); Mandatory=$true },
  @{ Name='perguntas.docx'; Path=(Join-Path $base 'Agente IA Brand Book\perguntas.docx'); Agents=@('brand-book'); Mandatory=$true },

  @{ Name='ban_list.docx'; Path=(Join-Path $base 'Agente IA Gerente de Marketing\ban_list.docx'); Agents=@('marketing-manager'); Mandatory=$true },
  @{ Name='Padroes de Comunicacao.docx'; Path=(Join-Path $base 'Agente IA Gerente de Marketing\Padroes de Comunicacao.docx'); Agents=@('marketing-manager'); Mandatory=$true },
  @{ Name='Prompt _Instruções_ Gerente de Marketing_.docx'; Path=(Join-Path $base 'Agente IA Gerente de Marketing\Prompt _Instruções_ Gerente de Marketing_.docx'); Agents=@('marketing-manager'); Mandatory=$true },

  @{ Name='Documento sem título.docx'; Path=(Join-Path $base 'Agente IA Pesquisa e Curadoria (sem RAG) - USA PERPLEXITY AI\Documento sem título.docx'); Agents=@('market-research'); Mandatory=$true },
  @{ Name='PROMPT.docx'; Path=(Join-Path $base 'Agente IA Revisora -- Sombra\PROMPT.docx'); Agents=@('feedback-conteudo'); Mandatory=$true },

  @{ Name='Ganchos Validados.docx'; Path=(Join-Path $base 'Agente IA Roteirista -- Copywriter\Ganchos Validados.docx'); Agents=@('scriptwriter','copywriter-campanhas'); Mandatory=$false },
  @{ Name='Prompt _Instruções_ Agente Roteirista.docx'; Path=(Join-Path $base 'Agente IA Roteirista -- Copywriter\Prompt _Instruções_ Agente Roteirista.docx'); Agents=@('scriptwriter','copywriter-campanhas'); Mandatory=$true },

  @{ Name='exemplo_output.md.docx'; Path=(Join-Path $base 'Agente Voz de Marca\exemplo_output.md.docx'); Agents=@('voz-de-marca'); Mandatory=$false },
  @{ Name='prompt.docx'; Path=(Join-Path $base 'Agente Voz de Marca\prompt.docx'); Agents=@('voz-de-marca'); Mandatory=$true }
)

$promptMap = @(
  @{ AgentId='brand-book'; Name='Construtor de Brand Book'; Description='Conduz a entrevista de Brand Book com base nas perguntas oficiais e gera documento final completo.'; Model='claude-opus-4-20250514'; Requires=@('brand-book'); UsesDocs=$true; Source='Instrução Principal.docx' },
  @{ AgentId='market-research'; Name='Pesquisador de Mercado'; Description='Curadoria e pesquisa de pautas quentes via Perplexity, sem uso de contexto vetorial de documentos.'; Model='google/gemini-2.5-pro'; Requires=@(); UsesDocs=$false; Source='Documento sem título.docx' },
  @{ AgentId='marketing-manager'; Name='Gerente de Marketing'; Description='Organiza calendário, ideias e priorização de execução com metodologia da casa.'; Model='claude-opus-4-20250514'; Requires=@('brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro'); UsesDocs=$true; Source='Prompt _Instruções_ Gerente de Marketing_.docx' },
  @{ AgentId='scriptwriter'; Name='Roteirista de Infotainment'; Description='Cria roteiros com base na metodologia e documentos de contexto.'; Model='claude-opus-4-20250514'; Requires=@('brand-book','pesquisa','icp','pilares','matriz','calendario','roteiro'); UsesDocs=$true; Source='Prompt _Instruções_ Agente Roteirista.docx' },
  @{ AgentId='copywriter-campanhas'; Name='Copywriter de Campanhas'; Description='Cria peças de copy e roteiro de campanha com base no método e contexto documental.'; Model='claude-opus-4-20250514'; Requires=@('brand-book','pesquisa','icp','calendario','roteiro'); UsesDocs=$true; Source='Prompt _Instruções_ Agente Roteirista.docx' },
  @{ AgentId='feedback-conteudo'; Name='Feedback de Conteudo | Revisao Amanda AI'; Description='Critica e revisa roteiros com foco em clareza, lógica e retenção.'; Model='claude-opus-4-20250514'; Requires=@(); UsesDocs=$false; Source='PROMPT.docx' },
  @{ AgentId='voz-de-marca'; Name='Voz de Marca'; Description='Extrai estilo de comunicação a partir de transcrições e textos autorais para treinar clone AI.'; Model='claude-opus-4-20250514'; Requires=@('outro','brand-book','pesquisa','icp','roteiro'); UsesDocs=$true; Source='prompt.docx' }
)

$docByName = @{}
$docValueLines = @()
$docNamesSql = @()
foreach ($d in $docs) {
  if (-not (Test-Path $d.Path)) { throw "Arquivo não encontrado: $($d.Path)" }
  $txt = Get-DocxText -Path $d.Path
  $docByName[$d.Name] = $txt
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($txt))
  $nameSql = "'" + $d.Name.Replace("'", "''") + "'"
  $agentsSql = To-SqlTextArray -Values $d.Agents
  $mandatorySql = if ($d.Mandatory) { 'true' } else { 'false' }
  $docValueLines += "  ($nameSql, '$b64', $agentsSql, $mandatorySql, true)"
  $docNamesSql += $nameSql
}

$promptValueLines = @()
foreach ($p in $promptMap) {
  if (-not $docByName.ContainsKey($p.Source)) { throw "Conteúdo origem não encontrado para prompt: $($p.Source)" }
  $sys = $docByName[$p.Source]
  $sysB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sys))
  $agentIdSql = "'" + $p.AgentId.Replace("'", "''") + "'"
  $nameSql = "'" + $p.Name.Replace("'", "''") + "'"
  $descSql = "'" + $p.Description.Replace("'", "''") + "'"
  $modelSql = "'" + $p.Model.Replace("'", "''") + "'"
  $requiresSql = To-SqlTextArray -Values $p.Requires
  $usesDocsSql = if ($p.UsesDocs) { 'true' } else { 'false' }
  $promptValueLines += "  ($agentIdSql, $nameSql, $descSql, convert_from(decode('$sysB64','base64'),'UTF8'), $modelSql, $requiresSql, $usesDocsSql)"
}

$sql = @()
$sql += '-- Seed completo de documentos e prompts a partir da pasta Agentes IA (Google Drive espelhado em OneDrive)'
$sql += '-- Gerado automaticamente em 2026-04-13'
$sql += ''
$sql += 'DELETE FROM public.system_documents'
$sql += 'WHERE name IN (' + ($docNamesSql -join ', ') + ');'
$sql += ''
$sql += 'INSERT INTO public.system_documents ('
$sql += '  name,'
$sql += '  content,'
$sql += '  applies_to_agents,'
$sql += '  is_mandatory,'
$sql += '  is_active'
$sql += ')'
$sql += 'SELECT'
$sql += '  v.name,'
$sql += "  convert_from(decode(v.content_b64, 'base64'), 'UTF8') AS content,"
$sql += '  v.applies_to_agents,'
$sql += '  v.is_mandatory,'
$sql += '  v.is_active'
$sql += 'FROM (VALUES'
$sql += ($docValueLines -join ",`n")
$sql += ') AS v(name, content_b64, applies_to_agents, is_mandatory, is_active);'
$sql += ''
$sql += 'INSERT INTO public.agent_prompts ('
$sql += '  agent_id,'
$sql += '  name,'
$sql += '  description,'
$sql += '  system_prompt,'
$sql += '  recommended_model,'
$sql += '  requires_documents,'
$sql += '  uses_documents_context'
$sql += ')'
$sql += 'VALUES'
$sql += ($promptValueLines -join ",`n")
$sql += 'ON CONFLICT (agent_id) DO UPDATE'
$sql += 'SET'
$sql += '  name = EXCLUDED.name,'
$sql += '  description = EXCLUDED.description,'
$sql += '  system_prompt = EXCLUDED.system_prompt,'
$sql += '  recommended_model = EXCLUDED.recommended_model,'
$sql += '  requires_documents = EXCLUDED.requires_documents,'
$sql += '  uses_documents_context = EXCLUDED.uses_documents_context,'
$sql += '  updated_at = NOW();'
$sql += ''
$sql += "UPDATE public.agent_prompts SET uses_documents_context = false WHERE agent_id = 'market-research';"

[IO.File]::WriteAllText((Resolve-Path $migrationPath), ($sql -join "`r`n"), [Text.Encoding]::UTF8)
Write-Output "MIGRATION_CREATED: $migrationPath"
