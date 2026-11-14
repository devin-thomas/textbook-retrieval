#Requires -Version 5.1

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Install', 'Inspect', 'Rollback')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'TailscaleServeStatus.ps1')

$tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if (-not $tailscale) { $tailscale = Get-Command tailscale -ErrorAction SilentlyContinue }
if (-not $tailscale) { throw 'Tailscale CLI is required and was not found on PATH.' }

$textbookTarget = 'http://127.0.0.1:8766/textbooks'

function Get-ServeStatusText {
    $output = & $tailscale.Source serve status 2>&1
    if ($LASTEXITCODE -ne 0) { throw "tailscale serve status failed: $($output -join [Environment]::NewLine)" }
    return ($output -join [Environment]::NewLine)
}

function Assert-RootUnchanged {
    param(
        [Parameter(Mandatory = $true)][string]$Status,
        [AllowNull()][AllowEmptyString()][string]$ExpectedRootTarget
    )
    $actualRootTarget = Get-TailscaleServeMappingTarget -Status $Status -Path '/'
    if ([string]$actualRootTarget -ne [string]$ExpectedRootTarget) {
        $expected = if ($ExpectedRootTarget) { $ExpectedRootTarget } else { '<absent>' }
        $observed = if ($actualRootTarget) { $actualRootTarget } else { '<absent>' }
        throw "The root mapping changed from '/ -> $expected' to '/ -> $observed'. Inspect the Serve configuration before continuing."
    }
}

$before = Get-ServeStatusText
if ($Action -eq 'Inspect') {
    Write-Output $before
    return
}

# Only /textbooks is managed here. Any existing root (/) mapping is recorded
# first and must be identical afterwards.
$beforeRootTarget = Get-TailscaleServeMappingTarget -Status $before -Path '/'
$beforeTextbookTarget = Get-TailscaleServeMappingTarget -Status $before -Path '/textbooks'

if ($Action -eq 'Install') {
    if ($beforeTextbookTarget -eq $textbookTarget) {
        Write-Host "The /textbooks mapping is already configured for $textbookTarget."
        return
    }
    if ($PSCmdlet.ShouldProcess('/textbooks', "Mount Tailscale Serve path to $textbookTarget")) {
        & $tailscale.Source serve --bg --yes --https=443 --set-path=/textbooks $textbookTarget
        if ($LASTEXITCODE -ne 0) { throw "Tailscale Serve path installation failed with exit code $LASTEXITCODE" }

        $after = Get-ServeStatusText
        Assert-RootUnchanged -Status $after -ExpectedRootTarget $beforeRootTarget
        $afterTextbookTarget = Get-TailscaleServeMappingTarget -Status $after -Path '/textbooks'
        if ($afterTextbookTarget -ne $textbookTarget) {
            $observed = if ($afterTextbookTarget) { $afterTextbookTarget } else { '<absent>' }
            throw "Tailscale accepted the command, but '/textbooks -> $textbookTarget' was not confirmed (observed '$observed')."
        }
        Write-Output $after
    }
    return
}

if ($Action -eq 'Rollback') {
    if (-not $beforeTextbookTarget) {
        Write-Host 'The Textbook Desk /textbooks mapping is already absent.'
        return
    }
    if ($PSCmdlet.ShouldProcess('/textbooks', 'Remove only the Textbook Desk Tailscale Serve path')) {
        & $tailscale.Source serve --https=443 --set-path=/textbooks off
        if ($LASTEXITCODE -ne 0) { throw "Tailscale Serve rollback failed with exit code $LASTEXITCODE" }

        $after = Get-ServeStatusText
        Assert-RootUnchanged -Status $after -ExpectedRootTarget $beforeRootTarget
        $afterTextbookTarget = Get-TailscaleServeMappingTarget -Status $after -Path '/textbooks'
        if ($afterTextbookTarget) {
            throw "The /textbooks mapping is still present after rollback (target '$afterTextbookTarget')."
        }
        Write-Output $after
    }
}
