#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $projectRoot 'scripts\TailscaleServeStatus.ps1')

function Assert-Equal {
    param([object]$Actual, [object]$Expected, [string]$Case)
    if ($Actual -ne $Expected) {
        throw "$Case failed. Expected '$Expected', received '$Actual'."
    }
}

$validStatus = @'
https://apphost.example.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8080
|-- /textbooks proxy http://127.0.0.1:8766/textbooks
'@
Assert-Equal (Get-TsServeMappingTarget -StatusText $validStatus -Path '/') 'http://127.0.0.1:8080' 'root mapping'
Assert-Equal (Get-TsServeMappingTarget -StatusText $validStatus -Path '/textbooks') 'http://127.0.0.1:8766/textbooks' 'textbook mapping'
$rootTarget = 'http://127.0.0.1:8080'
$validChecks = @(Get-TailscaleServeHealthChecks -Status $validStatus -ExpectedRootTarget $rootTarget)
Assert-Equal $validChecks.Count 2 'valid mapping check count'
Assert-Equal ($validChecks.Result -join ',') 'PASS,PASS' 'valid mapping health'
$textbookOnlyChecks = @(Get-TailscaleServeHealthChecks -Status $validStatus)
Assert-Equal $textbookOnlyChecks.Count 1 'root mapping is not checked unless a target is given'
Assert-Equal $textbookOnlyChecks[0].Check 'Tailscale Serve textbook mapping' 'textbook-only check name'
Assert-Equal $textbookOnlyChecks[0].Result 'PASS' 'textbook-only mapping health'

$staleStatus = @'
https://apphost.example.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8080
|-- /textbooks proxy http://127.0.0.1:9999/stale
|-- /other proxy http://127.0.0.1:8766/textbooks
'@
Assert-Equal (Get-TsServeMappingTarget -StatusText $staleStatus -Path '/textbooks') 'http://127.0.0.1:9999/stale' 'stale mapping cannot borrow another path target'
Assert-Equal (Get-TsServeMappingTarget -StatusText $staleStatus -Path '/other') 'http://127.0.0.1:8766/textbooks' 'other mapping'
$staleChecks = @(Get-TailscaleServeHealthChecks -Status $staleStatus -ExpectedRootTarget $rootTarget)
Assert-Equal $staleChecks[0].Result 'PASS' 'stale status root remains valid'
Assert-Equal $staleChecks[1].Result 'FAIL' 'stale textbook target is unhealthy'

$borrowedTargetStatus = @'
https://apphost.example.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8080
|-- /other proxy http://127.0.0.1:8766/textbooks
'@
Assert-Equal (Get-TsServeMappingTarget -StatusText $borrowedTargetStatus -Path '/textbooks') $null 'target URL under another path is not a textbook mapping'
$borrowedChecks = @(Get-TailscaleServeHealthChecks -Status $borrowedTargetStatus -ExpectedRootTarget $rootTarget)
Assert-Equal $borrowedChecks[1].Result 'FAIL' 'borrowed target is not healthy'

$absentStatus = @'
https://apphost.example.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:8080
'@
Assert-Equal (Get-TsServeMappingTarget -StatusText $absentStatus -Path '/textbooks') $null 'absent mapping'

$duplicateStatus = @'
https://apphost.example.ts.net (tailnet only)
|-- /textbooks proxy http://127.0.0.1:8766/textbooks
|-- /textbooks proxy http://127.0.0.1:9999/stale
'@
$duplicateRejected = $false
try {
    [void](Get-TsServeMappingTarget -StatusText $duplicateStatus -Path '/textbooks')
}
catch {
    $duplicateRejected = $true
}
if (-not $duplicateRejected) { throw 'duplicate mapping case was not rejected' }
$duplicateChecks = @(Get-TailscaleServeHealthChecks -Status $duplicateStatus -ExpectedRootTarget $rootTarget)
Assert-Equal $duplicateChecks[1].Result 'FAIL' 'duplicate mapping health check'

Write-Output 'PASS Tailscale Serve status path-target parsing'
