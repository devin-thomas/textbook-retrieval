#Requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'Inspect', 'Rollback')]
    [string]$Action,

    # Refuse to act unless the root (/) path proxies to this target. Without it, any existing root
    # mapping is left alone and must be unchanged afterwards.
    [string]$RequireRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Imports the TailscaleServe module from ps-kit (see TailscaleServeStatus.ps1).
. (Join-Path $PSScriptRoot 'TailscaleServeStatus.ps1')

$textbookPath = '/textbooks'
$textbookTarget = 'http://127.0.0.1:8766/textbooks'

function Write-ServeMappings {
    Write-Output ((Get-TsServePath | Format-Table HostPort, Mount, Kind, Target -AutoSize | Out-String).TrimEnd())
}

# Only /textbooks is managed here. The module reads the configuration back after each change and
# fails if the mapping is not as asked, Funnel is on, or any other mapping on the port changed.
if ($Action -eq 'Inspect') {
    Write-ServeMappings
    return
}

if ($Action -eq 'Install') {
    $arguments = @{ Path = $textbookPath; Target = $textbookTarget }
    if ($RequireRoot) { $arguments.RequireRoot = $RequireRoot }
    $result = Add-TsServePath @arguments
    if ($result) {
        Write-Host "The $textbookPath mapping: $($result.Action) ($($result.Target))."
        Write-ServeMappings
    }
    return
}

if ($Action -eq 'Rollback') {
    $result = Remove-TsServePath -Path $textbookPath
    if ($result) {
        Write-Host "The Textbook Desk $textbookPath mapping: $($result.Action)."
        Write-ServeMappings
    }
}
