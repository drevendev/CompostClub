# Start the portable GUI, or restore the existing window through its owner-only pipe.
# No token, source text, model command, cache cleanup or privilege change is involved.
[CmdletBinding()]
param(
    [string]$Executable = '',
    [string]$DataDirectory = '',
    [switch]$ShowErrors
)
$ErrorActionPreference = 'Stop'
$mutex = $null
$locked = $false
try {
    if (-not $Executable) { $Executable = Join-Path $PSScriptRoot 'CompostClub.exe' }
    if (-not $DataDirectory) { $DataDirectory = Join-Path $env:APPDATA 'Compost Club' }
    $Executable = [IO.Path]::GetFullPath($Executable)
    $DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
    $exe = Get-Item -LiteralPath $Executable
    if ($exe.PSIsContainer -or ($exe.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'Choose the regular portable CompostClub.exe file.'
    }
    if ($DataDirectory.Contains('"')) { throw 'Invalid data directory.' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataDirectory.ToLowerInvariant()))).Replace('-', '') }
    finally { $sha.Dispose() }
    $mutex = [Threading.Mutex]::new($false, ('Local\CompostClubLauncher-' + $key))
    try { $locked = $mutex.WaitOne(35000) }
    catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw 'Another launcher is still opening this profile. Wait and try again.' }

    function Read-Connection {
        $discovery = Join-Path $DataDirectory 'operator-connection.private.json'
        if (-not (Test-Path -LiteralPath $discovery)) { return $null }
        $item = Get-Item -LiteralPath $discovery
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -gt 4096) {
            throw 'Invalid local application discovery file. Preserve the profile and inspect it.'
        }
        $connection = [IO.File]::ReadAllText($discovery) | ConvertFrom-Json
        if ($connection.format -ne 'compost-operator-1' -or
            $connection.address -notmatch '^\\\\\.\\pipe\\compost-club-[a-f0-9]{24}$' -or
            $connection.token -notmatch '^[a-f0-9]{64}$' -or
            [string]$connection.pid -notmatch '^[1-9][0-9]{0,8}$') {
            throw 'Unsupported local application discovery. No second application was started.'
        }
        $ownerProcess = Get-Process -Id $connection.pid -ErrorAction SilentlyContinue
        if (-not $ownerProcess) { return $null }
        # A running older package may own this profile. Talk to it; never replace its writer.
        if ([IO.Path]::GetFileName($ownerProcess.Path) -ne 'CompostClub.exe') {
            throw 'Discovery does not identify a running Compost Club process. Preserve the profile.'
        }
        return $connection
    }
    function Show-Existing($Connection) {
        $pipeName = $Connection.address.Substring('\\.\pipe\'.Length)
        $pipe = [IO.Pipes.NamedPipeClientStream]::new('.', $pipeName, [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
        try {
            $pipe.Connect(1500)
            $writer = [IO.StreamWriter]::new($pipe, [Text.UTF8Encoding]::new($false), 1024, $true)
            $reader = [IO.StreamReader]::new($pipe, [Text.Encoding]::UTF8, $false, 1024, $true)
            try {
                $writer.WriteLine((@{ version = 1; token = $Connection.token; command = @{ op = 'showWindow' } } | ConvertTo-Json -Compress))
                $writer.Flush()
                $reading = $reader.ReadLineAsync()
                if (-not $reading.Wait(5000)) { throw 'The existing application did not answer. No second writer was started.' }
                $line = $reading.GetAwaiter().GetResult()
                if (-not $line -or $line.Length -gt 4096) { throw 'Invalid window readiness response.' }
                $reply = $line | ConvertFrom-Json
                if (-not $reply.ok -or -not $reply.window) {
                    throw 'The running application cannot restore its window through this launcher. Exit it using its tray menu, then open this shortcut again. Saved data stays in place.'
                }
                if ($reply.window.pid -ne $Connection.pid) { throw 'Window process identity changed. Try again after startup completes.' }
                return $reply.window
            } finally { $writer.Dispose(); $reader.Dispose() }
        } finally { $pipe.Dispose() }
    }

    $connection = Read-Connection
    $started = $null
    $log = $null
    if (-not $connection) {
        [IO.Directory]::CreateDirectory($DataDirectory) | Out-Null
        $logs = Join-Path $DataDirectory 'launch-logs'
        [IO.Directory]::CreateDirectory($logs) | Out-Null
        $log = Join-Path $logs (([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfff')) + '-' + [Guid]::NewGuid().ToString('N'))
        $started = Start-Process -FilePath $Executable -ArgumentList ('"--compost-data-dir=' + $DataDirectory + '"') -WorkingDirectory $exe.DirectoryName -WindowStyle Normal -RedirectStandardError ($log + '.stderr.log') -RedirectStandardOutput ($log + '.stdout.log') -PassThru
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        if (-not $connection) { $connection = Read-Connection }
        if ($connection) {
            $window = Show-Existing $connection
            if ($window.visible -and -not $window.minimized -and $window.ready) {
                Write-Output ('Compost Club window ready. PID: ' + $window.pid)
                return
            }
        }
        if ($started -and $started.HasExited -and -not $connection) {
            throw ('Compost Club exited before its window was ready. Startup logs: ' + $log + '.*.log')
        }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)
    throw ('The window did not become ready within 30 seconds. Preserve the profile and startup logs: ' + $log)
} catch {
    $message = $_.Exception.Message
    if ($ShowErrors) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, 'Compost Club could not open', 'OK', 'Error') | Out-Null
    }
    Write-Error $message -ErrorAction Continue
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
