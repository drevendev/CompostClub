[CmdletBinding()]
param(
    [string]$DataDirectory='',
    [string]$NodeExecutable='',
    [string]$ShortcutDirectory='',
    [string]$Name='Compost Club React',
    [switch]$Replace
)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
if(-not $DataDirectory){$DataDirectory=Join-Path $env:APPDATA 'Compost Club'}
if(-not $NodeExecutable){$NodeExecutable=(Get-Command node.exe -ErrorAction Stop).Source}
if(-not $ShortcutDirectory){$ShortcutDirectory=[Environment]::GetFolderPath('Desktop')}
if($Name -match '[\\/:*?"<>|]' -or -not $Name.Trim()){throw 'Choose a plain shortcut name.'}
$entry=Join-Path $PSScriptRoot 'Start-CompostClub.ps1'
if(-not(Test-Path -LiteralPath $entry -PathType Leaf)){throw 'Native launcher missing.'}
$DataDirectory=[IO.Path]::GetFullPath($DataDirectory)
$NodeExecutable=[IO.Path]::GetFullPath($NodeExecutable)
if($DataDirectory.Contains('"') -or $NodeExecutable.Contains('"')){throw 'Invalid launch path.'}
$file=Join-Path $ShortcutDirectory ($Name+'.lnk')
if(Test-Path -LiteralPath $file){
    if(-not $Replace){throw 'Shortcut exists. Choose another name or explicitly use -Replace.'}
    $backups=Join-Path $DataDirectory 'shortcut-backups';[void][IO.Directory]::CreateDirectory($backups)
    Copy-Item -LiteralPath $file -Destination (Join-Path $backups ([Guid]::NewGuid().ToString()+'.lnk'))
}
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($file)
$link.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments='-NoProfile -STA -WindowStyle Hidden -File "'+$entry+'" -DataDirectory "'+$DataDirectory+'" -NodeExecutable "'+$NodeExecutable+'"'
$link.WorkingDirectory=$PSScriptRoot
$link.IconLocation=(Join-Path $PSScriptRoot 'garden-icon.ico')+',0'
$link.Description='Compost Club - React in WebView2, no application web server'
$link.Save()
@{shortcut=$file;entry=$entry;dataDirectory=$DataDirectory}|ConvertTo-Json
