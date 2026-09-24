<#
.SYNOPSIS
    Points the module at another HTTPS MovieBox Pro address, then rebuilds tv.js from src/.

.DESCRIPTION
    Updates "websiteURL" in package.json (the page TizenBrew opens, and the host the module runs on) and runs
    "node tools/build.cjs", which writes the same address into tv.js as START_URL. If anything fails, both files
    are restored. Publish package.json and tv.js together.

.EXAMPLE
    .\configure-start-page.ps1 -StartUrl 'https://www.movieboxpro.app/'
#>
param(
    [Parameter(Mandatory = $true)]
    [uri]$StartUrl
)
$ErrorActionPreference = 'Stop'
if (-not $StartUrl.IsAbsoluteUri -or $StartUrl.Scheme -ne 'https' -or $StartUrl.UserInfo) {
    throw 'Use the HTTPS website address, without embedded login information.'
}

$taskNode = Get-Command -Name 'node' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $taskNode) {
    throw 'Node.js was not found. Install Node.js 18 or newer (https://nodejs.org/), reopen PowerShell and run this script again. No files changed.'
}

$taskPackagePath = Join-Path $PSScriptRoot 'package.json'
$taskScriptPath = Join-Path $PSScriptRoot 'tv.js'
$taskBuildPath = Join-Path (Join-Path $PSScriptRoot 'tools') 'build.cjs'
if (-not (Test-Path -LiteralPath $taskBuildPath)) {
    throw 'tools\build.cjs is missing next to this script. Run it from a full copy of the repository. No files changed.'
}

$taskUtf8 = New-Object System.Text.UTF8Encoding($false)
$taskPackageText = [System.IO.File]::ReadAllText($taskPackagePath, $taskUtf8)
$taskHadScript = Test-Path -LiteralPath $taskScriptPath
$taskScriptText = if ($taskHadScript) { [System.IO.File]::ReadAllText($taskScriptPath, $taskUtf8) } else { $null }

# Edit only the websiteURL value so the rest of package.json keeps its formatting.
$taskPattern = '(?m)^(\s*"websiteURL"\s*:\s*)"(?:[^"\\]|\\.)*"'
if ([regex]::Matches($taskPackageText, $taskPattern).Count -ne 1) {
    throw 'Could not identify exactly one websiteURL setting in package.json. No files changed.'
}
$taskUrl = $StartUrl.AbsoluteUri
$taskUrlJson = ConvertTo-Json -InputObject $taskUrl -Compress
$taskNewPackage = [regex]::Replace($taskPackageText, $taskPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $match.Groups[1].Value + $taskUrlJson })
if ((ConvertFrom-Json -InputObject $taskNewPackage).websiteURL -ne $taskUrl) {
    throw 'The updated package.json did not read back correctly. No files changed.'
}

function Restore-TaskFiles {
    [System.IO.File]::WriteAllText($taskPackagePath, $taskPackageText, $taskUtf8)
    if ($taskHadScript) { [System.IO.File]::WriteAllText($taskScriptPath, $taskScriptText, $taskUtf8) }
}

[System.IO.File]::WriteAllText($taskPackagePath, $taskNewPackage, $taskUtf8)
try {
    & $taskNode.Source $taskBuildPath
    if ($LASTEXITCODE -ne 0) { throw "node tools/build.cjs exited with code $LASTEXITCODE." }
    $taskBuilt = [System.IO.File]::ReadAllText($taskScriptPath, $taskUtf8)
    $taskStart = [regex]::Matches($taskBuilt, '(?m)^  var START_URL = (.*);$')
    if ($taskStart.Count -ne 1 -or (ConvertFrom-Json -InputObject $taskStart[0].Groups[1].Value) -ne $taskUrl) {
        throw 'The rebuilt tv.js does not contain exactly one START_URL equal to the new address.'
    }
}
catch {
    Restore-TaskFiles
    throw "Rebuild failed; package.json and tv.js were restored. $($_.Exception.Message)"
}
Write-Output "Start page set to $taskUrl and tv.js rebuilt. Commit package.json and tv.js together, then publish a new version tag."
