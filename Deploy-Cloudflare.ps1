param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9]+(?:-[a-z0-9]+)*$')]
  [string]$ProjectName,
  [switch]$CreateProject
)

$ErrorActionPreference = 'Stop'
$taskWrangler = 'wrangler@4.148.0'
Push-Location -LiteralPath $PSScriptRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Production build failed; deployment stopped.' }

  $taskOutput = Join-Path $PSScriptRoot 'dist'
  $taskFiles = @(Get-ChildItem -LiteralPath $taskOutput -File -Recurse)
  if (-not (Test-Path -LiteralPath (Join-Path $taskOutput 'index.html'))) {
    throw 'Missing dist/index.html; deployment stopped.'
  }
  if ($taskFiles.Count -gt 20000 -or @($taskFiles | Where-Object Length -gt 26214400).Count -gt 0) {
    throw 'Build exceeds the Cloudflare Pages file count or 25 MiB per-file limit.'
  }
  Write-Host ('Deploying {0} files ({1:N1} MiB) to Pages project {2}.' -f $taskFiles.Count, (($taskFiles | Measure-Object Length -Sum).Sum / 1MB), $ProjectName)

  if ($CreateProject) {
    # Keep new projects on Pages (*.pages.dev); bypass Wrangler's automatic Workers migration.
    & npx.cmd --yes $taskWrangler pages project create $ProjectName --production-branch main --force
    if ($LASTEXITCODE -ne 0) { throw 'Pages project creation failed; deployment stopped.' }
  }
  & npx.cmd --yes $taskWrangler pages deploy dist --project-name $ProjectName --branch main --commit-message 'Deploy Realm Wardens'
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Pages deployment failed.' }
} finally {
  Pop-Location
}
