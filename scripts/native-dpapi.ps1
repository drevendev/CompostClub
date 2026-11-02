param([ValidateSet('protect','unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
try {
    Add-Type -AssemblyName System.Security
    $inputText=[Console]::In.ReadToEnd()
    if($inputText.Length -gt 3000000){throw 'Input limit'}
    $bytes=[Convert]::FromBase64String($inputText)
    $scope=[Security.Cryptography.DataProtectionScope]::CurrentUser
    if($Mode -eq 'protect'){$result=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,$scope)}
    else {$result=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,$scope)}
    [Console]::Out.Write([Convert]::ToBase64String($result))
    [Array]::Clear($bytes,0,$bytes.Length)
    [Array]::Clear($result,0,$result.Length)
} catch { [Console]::Error.Write('Protected storage failed.'); exit 1 }
