[CmdletBinding()]
param([ValidateSet('primary','webview','wpf','electron')][string]$Variant='primary',[switch]$ShowErrors)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
try {
    $installation=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'primary-installation.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($installation.format -ne 'compost-primary-installation-1'){throw 'Unsupported installation descriptor.'}
    $selected=$installation
    if($Variant -ne 'primary'){$selected=$installation.variants.$Variant;if(-not $selected){throw 'Этот вариант пока не установлен.'}}
    $project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $package=[IO.Path]::GetFullPath($selected.packageDirectory)
    $data=[IO.Path]::GetFullPath($installation.dataDirectory)
    if(-not $package.StartsWith((Join-Path $project 'release')+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $data.StartsWith((Join-Path $project '.local')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Installation paths escaped this project.'}
    $identity=Get-Content -LiteralPath (Join-Path $package 'PACKAGE-IDENTITY.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($identity.sha256 -ne $selected.packageSha256){throw 'Package identity changed. Preserve the profile.'}
    $entry=Join-Path $package 'Start-CompostClub.ps1'
    if($selected.host -in @('wpf','webview')){& $entry -DataDirectory $data -NodeExecutable $installation.nodeExecutable}
    elseif($selected.host -eq 'electron'){& $entry -DataDirectory $data -ShowErrors:$ShowErrors}
    else{throw 'Unsupported installed host.'}
}catch {
    if($ShowErrors){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Compost Club: запуск не завершён')|Out-Null}
    Write-Error $_.Exception.Message -ErrorAction Continue
    exit 1
}
