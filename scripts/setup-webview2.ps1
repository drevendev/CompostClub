[CmdletBinding()]
param([string]$Archive='')
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
$project=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$pin=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'webview2-sdk.json') -Raw|ConvertFrom-Json
$cache=Join-Path $project ('.local/webview2-sdk/'+$pin.version)
[void][IO.Directory]::CreateDirectory($cache)
if(-not $Archive){$Archive=Join-Path $cache 'sdk.zip';Invoke-WebRequest -Uri $pin.url -OutFile $Archive -UseBasicParsing}
if((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pin.sha256){throw 'WebView2 SDK archive hash mismatch.'}
Expand-Archive -LiteralPath $Archive -DestinationPath (Join-Path $cache 'sdk') -Force
foreach($name in @('lib/net462/Microsoft.Web.WebView2.Core.dll','lib/net462/Microsoft.Web.WebView2.WinForms.dll','runtimes/win-x64/native/WebView2Loader.dll')){
    if((Get-AuthenticodeSignature -LiteralPath (Join-Path $cache ('sdk/'+$name))).Status -ne 'Valid'){throw 'WebView2 SDK signature mismatch.'}
}
Write-Output ('Verified official SDK '+$pin.version+'. Runtime is not installed or downloaded.')
