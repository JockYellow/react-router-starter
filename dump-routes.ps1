# ===== Dump selected folders (app, toolbelt, etc.) to a single UTF-8 markdown =====
[CmdletBinding()]
param(
  [Parameter(Position=0, ValueFromRemainingArguments=$true)]
  [string[]] $Roots = @("app","toolbelt") # 預設同時抓 app 與 toolbelt
)

$ErrorActionPreference = "Stop"

# 確保主控台與輸出為 UTF-8，避免亂碼
$OutputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
chcp 65001 | Out-Null

# 只保留實際存在的資料夾
$ExistingRoots = @()
foreach ($r in $Roots) {
  if (Test-Path $r -PathType Container) { $ExistingRoots += (Resolve-Path $r).Path }
}
if ($ExistingRoots.Count -eq 0) {
  throw "找不到任何指定的資料夾。請確認目錄是否存在。例如：app/、toolbelt/。"
}

# 準備輸出資料夾與檔名
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpsDir = Join-Path (Resolve-Path .).Path "dumps"
if (!(Test-Path $dumpsDir)) { New-Item -ItemType Directory -Path $dumpsDir | Out-Null }
$out = Join-Path $dumpsDir ("routes_dump_{0}.md" -f $stamp)

# 共同設定
$repoRoot = (Resolve-Path .).Path
if (-not $repoRoot.EndsWith('\')) { $repoRoot = $repoRoot + '\' }

$exts = @('.ts','.tsx','.js','.jsx','.css','.scss','.md','.json')
# 排除大型或無關資料夾
$excludeDirRegex = '\\(node_modules|\.git|\.wrangler|\.next|dist|build|out|.vercel)\\'

# 檔頭
"## Routes Dump ($stamp)`n專案根目錄：$repoRoot`n" | Out-File -FilePath $out -Encoding utf8

foreach ($rootPath in $ExistingRoots) {
  "## Root: $rootPath" | Add-Content $out

  # 收集檔案
  $files = Get-ChildItem $rootPath -Recurse -File |
    Where-Object {
      ($exts -contains $_.Extension) -and
      ($_.FullName -notmatch $excludeDirRegex)
    } |
    Sort-Object FullName

  # 樹狀/清單（相對路徑）
  "### 檔案清單（相對 $repoRoot）" | Add-Content $out
  foreach ($f in $files) {
    $rel = $f.FullName.Replace($repoRoot,'')
    $rel | Add-Content $out
  }

  # 內容逐檔輸出
  foreach ($f in $files) {
    $rel = $f.FullName.Replace($repoRoot,'')
    $lang = switch ($f.Extension.ToLower()) {
      '.ts'   { 'ts' }
      '.tsx'  { 'tsx' }
      '.js'   { 'js' }
      '.jsx'  { 'jsx' }
      '.css'  { 'css' }
      '.scss' { 'scss' }
      '.md'   { 'md' }
      '.json' { 'json' }
      default { '' }
    }
    "`n---`n### $rel" | Add-Content $out
    '```' + $lang | Add-Content $out
    (Get-Content $f.FullName -Raw) | Add-Content $out
    '```' | Add-Content $out
  }
}

"`n---`nGenerated with UTF-8 to avoid mojibake." | Add-Content $out
Write-Host "Done: $out"
