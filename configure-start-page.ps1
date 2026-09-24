param(
    [Parameter(Mandatory = $true)]
    [uri]$StartUrl
)
$ErrorActionPreference = 'Stop'
if (-not $StartUrl.IsAbsoluteUri -or $StartUrl.Scheme -ne 'https' -or $StartUrl.UserInfo) {
    throw 'Use the HTTPS website address, without embedded login information.'
}
$taskPackagePath = Join-Path $PSScriptRoot 'package.json'
$taskScriptPath = Join-Path $PSScriptRoot 'tv.js'
$taskPackage = Get-Content -LiteralPath $taskPackagePath -Raw | ConvertFrom-Json
$taskScript = Get-Content -LiteralPath $taskScriptPath -Raw
$taskPattern = '(?m)^  var START_URL = .*;$'
if ([regex]::Matches($taskScript, $taskPattern).Count -ne 1) {
    throw 'Could not identify exactly one start-page setting. No files changed.'
}
$taskUrlJson = ConvertTo-Json -InputObject $StartUrl.AbsoluteUri -Compress
$taskNewScript = [regex]::Replace($taskScript, $taskPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) '  var START_URL = ' + $taskUrlJson + ';' })
$taskPackage.websiteURL = $StartUrl.AbsoluteUri
$taskUtf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($taskScriptPath, $taskNewScript, $taskUtf8)
[System.IO.File]::WriteAllText($taskPackagePath, ($taskPackage | ConvertTo-Json -Depth 8) + [Environment]::NewLine, $taskUtf8)
Write-Output 'Start page updated. Publish both package.json and tv.js together.'
