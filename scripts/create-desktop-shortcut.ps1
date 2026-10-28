[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$PackageDirectory,
    [Parameter(Mandatory)][string]$DataDirectory,
    [Parameter(Mandatory)][string]$ShortcutPath
)
$ErrorActionPreference = 'Stop'
$PackageDirectory = [IO.Path]::GetFullPath($PackageDirectory)
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
$ShortcutPath = [IO.Path]::GetFullPath($ShortcutPath)
$launcher = Join-Path $PackageDirectory 'Start-CompostClub.ps1'
$executable = Join-Path $PackageDirectory 'CompostClub.exe'
foreach ($file in @($launcher, $executable)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw ('Portable file is missing: ' + $file) }
}
if ([IO.Path]::GetExtension($ShortcutPath) -ne '.lnk' -or (Test-Path -LiteralPath $ShortcutPath)) {
    throw 'Choose a new .lnk path. Existing shortcuts are preserved.'
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' + $launcher + '" -DataDirectory "' + $DataDirectory + '" -ShowErrors'
$shortcut.WorkingDirectory = $PackageDirectory
$shortcut.IconLocation = $executable + ',0'
$shortcut.Description = 'Open Compost Club preview using its separate data profile'
$shortcut.Save()
Write-Output $ShortcutPath
