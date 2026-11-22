#Requires -Version 5.1

Set-StrictMode -Version Latest

# The Serve logic is the TailscaleServe module from the public ps-kit repository
# (https://github.com/uppercut-labs/ps-kit, packages/tailscale-serve). Install it by copying the
# TailscaleServe folder into a folder on $env:PSModulePath, or set PS_KIT to a clone of ps-kit.
if (-not (Get-Command Get-TsServeMappingTarget -ErrorAction SilentlyContinue)) {
    $psKitManifest = if ($env:PS_KIT) { Join-Path $env:PS_KIT 'packages/tailscale-serve/TailscaleServe/TailscaleServe.psd1' } else { '' }
    if (Get-Module -ListAvailable -Name TailscaleServe) {
        Import-Module TailscaleServe -MinimumVersion 0.1.0 -ErrorAction Stop
    }
    elseif ($psKitManifest -and (Test-Path -LiteralPath $psKitManifest)) {
        Import-Module $psKitManifest -ErrorAction Stop
    }
    else {
        throw 'The TailscaleServe module was not found. Copy packages/tailscale-serve/TailscaleServe from https://github.com/uppercut-labs/ps-kit into a folder on $env:PSModulePath, or set PS_KIT to a clone of that repository.'
    }
}

function Get-TailscaleServeHealthChecks {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Status,
        [string]$ExpectedRootTarget = '',
        [string]$ExpectedTextbookTarget = 'http://127.0.0.1:8766/textbooks'
    )

    # The root (/) mapping belongs to whatever else the host serves. It is only
    # checked when the caller names the target it must keep pointing at.
    $mappings = @()
    if ($ExpectedRootTarget) {
        $mappings += @{ Name = 'Tailscale Serve root mapping'; Path = '/'; Expected = $ExpectedRootTarget }
    }
    $mappings += @{ Name = 'Tailscale Serve textbook mapping'; Path = '/textbooks'; Expected = $ExpectedTextbookTarget }

    foreach ($mapping in $mappings) {
        try {
            $actual = Get-TsServeMappingTarget -StatusText $Status -Path $mapping.Path
            $observed = if ($actual) { $actual } else { '<absent>' }
            [pscustomobject]@{
                Check = $mapping.Name
                Result = if ($actual -eq $mapping.Expected) { 'PASS' } else { 'FAIL' }
                Detail = "$($mapping.Path) -> $observed (expected $($mapping.Expected))"
            }
        }
        catch {
            [pscustomobject]@{
                Check = $mapping.Name
                Result = 'FAIL'
                Detail = $_.Exception.Message
            }
        }
    }
}
