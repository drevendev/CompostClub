[CmdletBinding()]
param([string]$DataDirectory='',[string]$NodeExecutable='',[string]$AcceptanceFile='',[switch]$StartHidden)
$ErrorActionPreference='Stop'
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$script:Failure='';$script:Closing=$false;$script:Ready=$false;$script:Renderer=$false
$script:Worker=$null;$script:Core=$null;$script:Form=$null;$script:LastActivity=[DateTime]::UtcNow
$script:TestIndex=0;$script:TestPending=$null;$script:TestResults=New-Object Collections.Generic.List[object]
function Write-Readiness {
    if(-not $script:Ready -or -not $script:Worker){return}
    $v=@{format='compost-webview-window-1';host='webview';pid=$PID;workerPid=$script:Worker.Id;ready=$true;visible=$script:Form.Visible;minimized=($script:Form.WindowState -eq 'Minimized');focused=$script:Form.ContainsFocus;handle=$script:Form.Handle.ToInt64();version=$identity.version;package=$PSScriptRoot;at=[DateTime]::UtcNow.ToString('o');dpi=(Get-WebViewDpi $script:Form)}
    [IO.File]::WriteAllText((Join-Path $DataDirectory 'webview-window.private.json'),($v|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
}
function Show-Main {
    if($AcceptanceFile){return}
    $script:Form.Show();$script:Form.WindowState='Normal';[void]$script:Form.Activate();Write-Readiness
}
function Send-Worker($value) {
    if(-not $script:Worker -or $script:Worker.HasExited){throw 'Рабочий процесс недоступен.'}
    $script:Input.WriteLine(($value|ConvertTo-Json -Depth 50 -Compress));$script:Input.Flush()
}
function Request-Shutdown {
    if($script:Closing){return};$script:Closing=$true
    Send-Worker @{op='interrupt';target='pause'}
    Send-Worker @{op='shutdown'}
}
function Handle-Service($message) {
    $value=$null;$failed=$false
    try {
        if($AcceptanceFile -and $message.kind -ne 'showWindow') {
            $kind=[string]$message.kind
            if(-not $script:ServiceIndex.ContainsKey($kind)){$script:ServiceIndex[$kind]=0}
            $values=@($script:Test.services.$kind);$index=$script:ServiceIndex[$kind];$script:ServiceIndex[$kind]++
            if($index -lt $values.Count){$value=$values[$index]}elseif($kind -eq 'pick'){$value=@()}elseif($kind -eq 'confirm'){$value=$false}
        } else {
            switch($message.kind) {
                'pick' {
                    $kind=$message.payload.kind
                    if($kind -in @('models','export')) {
                        $dialog=New-Object Windows.Forms.FolderBrowserDialog;$dialog.Description='Выберите папку Compost Club'
                        try{if($dialog.ShowDialog($script:Form) -eq 'OK'){$value=@($dialog.SelectedPath)}else{$value=@()}}finally{$dialog.Dispose()}
                    } else {
                        $dialog=New-Object Windows.Forms.OpenFileDialog;$dialog.Multiselect=($kind -eq 'import')
                        if($kind -eq 'executable'){$dialog.Filter='Программа Ollama|*.exe'}elseif($kind -eq 'restore'){$dialog.Filter='Полная копия JSON|*.json'}else{$dialog.Filter='Исходные идеи|*.md;*.txt;*.json|Все файлы|*.*'}
                        try{if($dialog.ShowDialog($script:Form) -eq 'OK'){$value=@($dialog.FileNames)}else{$value=@()}}finally{$dialog.Dispose()}
                    }
                }
                'saveBackup' {$dialog=New-Object Windows.Forms.SaveFileDialog;$dialog.Filter='Полная приватная копия JSON|*.json';$dialog.FileName='compost-backup-'+(Get-Date -Format yyyy-MM-dd)+'.json';try{if($dialog.ShowDialog($script:Form) -eq 'OK'){$value=$dialog.FileName}}finally{$dialog.Dispose()}}
                'confirm' {$value=([Windows.Forms.MessageBox]::Show($script:Form,[string]$message.payload.message,'Проверьте изменения','YesNo','Warning','Button2') -eq 'Yes')}
                'openDirectory' {Start-Process -FilePath 'explorer.exe' -ArgumentList ('"'+[string]$message.payload.directory+'"');$value=$true}
                'openLink' {$url=[Uri]$message.payload.url;if($url.Scheme -notin @('http','https')){throw 'Unsupported link'};Start-Process -FilePath $url.AbsoluteUri;$value=$true}
                'showWindow' {Show-Main;Write-Readiness;$value=@{visible=$script:Form.Visible;minimized=($script:Form.WindowState -eq 'Minimized');focused=$script:Form.ContainsFocus;ready=$script:Ready}}
                'autostart' {
                    $shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'Compost Club WebView.lnk'
                    if($message.payload.enabled){
                        $shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($shortcut)
                        $link.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
                        $link.Arguments='-NoProfile -STA -WindowStyle Hidden -File "'+(Join-Path $PSScriptRoot 'Start-CompostClub.ps1')+'" -DataDirectory "'+$DataDirectory+'" -NodeExecutable "'+$NodeExecutable+'" -StartHidden'
                        $link.WorkingDirectory=$PSScriptRoot;$link.IconLocation=(Join-Path $PSScriptRoot 'garden-icon.ico')+',0';$link.Save();$value=$true
                    }else{if(Test-Path -LiteralPath $shortcut){Remove-Item -LiteralPath $shortcut};$value=$false}
                }
                default {throw 'Unsupported native service.'}
            }
        }
    }catch{$failed=$true}
    Send-Worker @{op='serviceResult';id=$message.id;value=$value;error=$failed}
}
function Test-Step {
    if(-not $AcceptanceFile -or -not $script:Ready -or $script:Closing){return}
    if([DateTime]::UtcNow -gt $script:TestDeadline){throw 'WebView acceptance timed out.'}
    if($script:TestWait -and [DateTime]::UtcNow -lt $script:TestWait){return}
    if($script:TestPending) {
        if(-not $script:TestPending.IsCompleted){return}
        $raw=$script:TestPending.GetAwaiter().GetResult();$script:TestPending=$null
        if($script:CaptureStream){$script:CaptureStream.Dispose();$script:CaptureStream=$null}
        elseif($script:AwaitingScript){$script:AwaitingScript=$false;$script:PollingScript=$true;return}
        elseif($script:PollingScript){
            if($raw -eq 'null'){return}
            $answer=$raw|ConvertFrom-Json|ConvertFrom-Json
            if(-not $answer.ok){throw ('Acceptance script: '+$answer.error)}
            $script:PollingScript=$false
        }
        $script:TestResults.Add(@{step=$script:TestIndex;ok=$true;value=$answer.value})
    }
    if($script:PollingScript){$script:TestPending=$script:Core.ExecuteScriptAsync('window.__compostAcceptance ? JSON.stringify(window.__compostAcceptance) : null');return}
    if($script:TestIndex -ge @($script:Test.steps).Count){Request-Shutdown;return}
    $step=$script:Test.steps[$script:TestIndex];$script:TestIndex++
    switch($step.kind) {
        'script' {
            $script:AwaitingScript=$true
            $dpi=Get-WebViewDpi $script:Form
            $expected=([double]$dpi.windowDpi/96*$script:Web.ZoomFactor).ToString([Globalization.CultureInfo]::InvariantCulture)
            $js='window.__compostAcceptance=null;(async()=>{try{const nativeDpi='+$dpi.windowDpi+';const expectedDevicePixelRatio='+$expected+';const value=await(async()=>{'+[string]$step.script+'})();window.__compostAcceptance={ok:true,value};}catch(e){window.__compostAcceptance={ok:false,error:String(e)}}})();'
            $script:TestPending=$script:Core.ExecuteScriptAsync($js)
        }
        'capture' {$script:CaptureStream=[IO.File]::Create([string]$step.file);$script:TestPending=$script:Core.CapturePreviewAsync([Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat]::Png,$script:CaptureStream)}
        'assertDpi' {
            $dpi=Get-WebViewDpi $script:Form
            if(-not $dpi.perMonitorV2){throw 'Window is not PerMonitorV2; bitmap scaling can blur React.'}
            $script:TestResults.Add(@{step=$script:TestIndex;ok=$true;dpi=$dpi})
        }
        'relaunch' {Start-Process -FilePath ([string]$script:Test.shortcut);$script:TestWait=[DateTime]::UtcNow.AddSeconds(2);$script:TestResults.Add(@{step=$script:TestIndex;ok=$true})}
        'assertOwner' {$owner=Get-Content -LiteralPath (Join-Path $DataDirectory 'webview-window.private.json') -Raw|ConvertFrom-Json;if($owner.pid -ne $PID -or $owner.workerPid -ne $script:Worker.Id){throw 'Repeated shortcut changed the owner'};$script:TestResults.Add(@{step=$script:TestIndex;ok=$true})}
        default {throw 'Unsupported acceptance step.'}
    }
}
try {
    if(-not $DataDirectory){$DataDirectory=Join-Path $env:APPDATA 'Compost Club'}
    if(-not $NodeExecutable){$NodeExecutable=(Get-Command node.exe -ErrorAction Stop).Source}
    $DataDirectory=[IO.Path]::GetFullPath($DataDirectory);$NodeExecutable=[IO.Path]::GetFullPath($NodeExecutable)
    if($DataDirectory.Contains('"') -or $NodeExecutable.Contains('"')){throw 'Invalid launch path.'}
    $sha=[Security.Cryptography.SHA256]::Create();try{$key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataDirectory.ToLowerInvariant())))).Replace('-','')}finally{$sha.Dispose()}
    $mutex=New-Object Threading.Mutex($false,('Local\CompostWebView-'+$key));$locked=$false
    $activate=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::AutoReset,('Local\CompostWebViewShow-'+$key))
    try{$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
    if(-not $locked){$script:Duplicate=$true;[void]$activate.Set();exit 0}
    if((Get-AuthenticodeSignature -LiteralPath $NodeExecutable).Status -ne 'Valid'){throw 'Требуется установленный Node.js с действительной подписью.'}
    if((& $NodeExecutable --version) -notmatch '^v24\.'){throw 'Требуется установленный Node.js 24. Автоматической загрузки нет.'}
    $identity=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PACKAGE-IDENTITY.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if($identity.format -ne 'compost-webview-package-1'){throw 'Unsupported package identity.'}
    foreach($file in $identity.files.PSObject.Properties){
        $absolute=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $file.Name))
        if(-not $absolute.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Package path escaped its root.'}
        if((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.Value){throw 'Проверка файлов приложения не прошла. Предыдущая версия сохранена.'}
    }
    . (Join-Path $PSScriptRoot 'webview-dpi.ps1')
    Initialize-WebViewDpi
    [Windows.Forms.Application]::EnableVisualStyles()
    if($AcceptanceFile){
        $marker=Join-Path $DataDirectory 'webview-acceptance-profile.private.json'
        if($DataDirectory -match '[\\/]primary-data[\\/]?$'){throw 'Acceptance cannot use the primary profile.'}
        $guard=Get-Content -LiteralPath $marker -Raw|ConvertFrom-Json
        if($guard.format -ne 'compost-webview-acceptance-1' -or $guard.inference -ne 'disabled'){throw 'Explicit isolated acceptance profile required.'}
        $env:COMPOST_NO_INFERENCE='1';$script:Test=Get-Content -LiteralPath $AcceptanceFile -Raw -Encoding UTF8|ConvertFrom-Json
        $script:ServiceIndex=@{};$script:TestDeadline=[DateTime]::UtcNow.AddSeconds(180)
    }
    foreach($name in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')){
        $dll=Join-Path $PSScriptRoot ('webview2/'+$name)
        if((Get-AuthenticodeSignature -LiteralPath $dll).Status -ne 'Valid'){throw 'WebView2 DLL signature check failed.'}
        [void][Reflection.Assembly]::LoadFrom($dll)
    }
    if((Get-AuthenticodeSignature -LiteralPath (Join-Path $PSScriptRoot 'webview2/WebView2Loader.dll')).Status -ne 'Valid'){throw 'WebView2 Loader signature check failed.'}
    [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::SetLoaderDllFolderPath((Join-Path $PSScriptRoot 'webview2'))
    $runtime=[Microsoft.Web.WebView2.Core.CoreWebView2Environment]::GetAvailableBrowserVersionString($null)
    if(-not $runtime){throw 'Установите официальный Microsoft Edge WebView2 Runtime. Приложение ничего не скачивает автоматически.'}
    [void][IO.Directory]::CreateDirectory($DataDirectory)
    $script:Form=New-Object Windows.Forms.Form;$script:Form.Text='Compost Club · React';$script:Form.AutoScaleMode='Dpi';$script:Form.AutoScaleDimensions=New-Object Drawing.SizeF(96,96);$script:Form.ClientSize=New-Object Drawing.Size(1260,900);$script:Form.MinimumSize=New-Object Drawing.Size(430,600)
    $script:Form.StartPosition='CenterScreen';$script:Form.Icon=New-Object Drawing.Icon((Join-Path $PSScriptRoot 'garden-icon.ico'))
    $script:Web=New-Object Microsoft.Web.WebView2.WinForms.WebView2;$script:Web.Dock='Fill'
    $options=[Microsoft.Web.WebView2.Core.CoreWebView2EnvironmentOptions]::new($null,$null,$null,$false,$null)
    $options.AdditionalBrowserArguments='--disable-background-networking --disable-component-update --disable-sync --no-first-run'
    $options.IsCustomCrashReportingEnabled=$true
    $script:Form.Controls.Add($script:Web)
    $script:StartupDeadline=[DateTime]::UtcNow.AddSeconds(60)
    $script:Web.add_CoreWebView2InitializationCompleted({param($sender,$eventArgs)
        try {
            if(-not $eventArgs.IsSuccess){throw $eventArgs.InitializationException}
            $script:Core=$script:Web.CoreWebView2
            $script:Core.Settings.AreHostObjectsAllowed=$false;$script:Core.Settings.AreDefaultScriptDialogsEnabled=$false
            $script:Core.Settings.IsPasswordAutosaveEnabled=$false;$script:Core.Settings.IsGeneralAutofillEnabled=$false
            $script:Core.Settings.IsWebMessageEnabled=$true
            $script:Core.add_NavigationStarting({param($s,$e)
                if(([Uri]$e.Uri).GetLeftPart([UriPartial]::Path) -ne 'https://compost.invalid/desktop.html'){
                    $e.Cancel=$true
                    if($e.IsUserInitiated -and ([Uri]$e.Uri).Scheme -in @('http','https')){Send-Worker @{op='external';url=$e.Uri}}
                }
            })
            $script:Core.add_FrameNavigationStarting({param($s,$e) $e.Cancel=$true})
            $script:Core.add_NewWindowRequested({param($s,$e) $e.Handled=$true;if($e.IsUserInitiated){Send-Worker @{op='external';url=$e.Uri}}})
            $script:Core.add_PermissionRequested({param($s,$e) $e.State=[Microsoft.Web.WebView2.Core.CoreWebView2PermissionState]::Deny})
            $script:Core.add_DownloadStarting({param($s,$e) $e.Cancel=$true})
            $script:Core.AddWebResourceRequestedFilter('*',[Microsoft.Web.WebView2.Core.CoreWebView2WebResourceContext]::All)
            $script:Core.add_WebResourceRequested({param($s,$e)
                $uri=[Uri]$e.Request.Uri
                if($uri.Scheme -ne 'data' -and ($uri.Scheme -ne 'https' -or $uri.Host -ne 'compost.invalid')){$e.Response=$s.Environment.CreateWebResourceResponse((New-Object IO.MemoryStream),403,'Blocked','Content-Type: text/plain')}
            })
            $script:Core.add_WebMessageReceived({param($s,$e)
                try {
                    if(([Uri]$e.Source).GetLeftPart([UriPartial]::Path) -ne 'https://compost.invalid/desktop.html'){return}
                    $raw=$e.WebMessageAsJson;if($raw.Length -gt 3*1024*1024){throw 'Renderer request exceeds limit.'}
                    $message=$raw|ConvertFrom-Json
                    if($message.type -eq 'rendererReady'){$script:Renderer=$true;return}
                    if($message.type -eq 'applicationReady'){$script:Ready=$true;Write-Readiness;return}
                    if($message.type -ne 'invoke' -or [string]$message.id -notmatch '^[\w-]{1,80}$'){throw 'Invalid renderer request.'}
                    Send-Worker @{op='invoke';id=[string]$message.id;command=$message.command}
                }catch {$s.PostWebMessageAsJson((@{type='fatal';error='Связь с приложением прервана. Сохранённые данные остаются на диске.'}|ConvertTo-Json -Compress))}
            })
            $script:Core.SetVirtualHostNameToFolderMapping('compost.invalid',(Join-Path $PSScriptRoot 'ui'),[Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::Deny)
            $script:Preload=$script:Core.AddScriptToExecuteOnDocumentCreatedAsync([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'webview-preload.js')))
        }catch{$script:Failure=$_.Exception.Message;$script:Closing=$true;$script:Form.Close()}
    })
    $script:Form.add_FormClosing({param($s,$e) if(-not $script:Closing){$e.Cancel=$true;$script:Form.Hide();Write-Readiness}})
    $script:Tray=New-Object Windows.Forms.NotifyIcon;$script:Tray.Text='Compost Club · React';$script:Tray.Icon=$script:Form.Icon
    $menu=New-Object Windows.Forms.ContextMenuStrip
    [void]$menu.Items.Add('Открыть Compost Club',$null,{Show-Main})
    [void]$menu.Items.Add('Пауза',$null,{Send-Worker @{op='interrupt';target='pause'}})
    [void]$menu.Items.Add('Завершить',$null,{Request-Shutdown})
    $script:Tray.ContextMenuStrip=$menu;$script:Tray.add_DoubleClick({Show-Main});$script:Tray.Visible=(-not [bool]$AcceptanceFile)
    $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$NodeExecutable
    $start.Arguments='"'+(Join-Path $PSScriptRoot 'native-worker.cjs')+'" --webview --data-dir "'+$DataDirectory+'" --package-root "'+$PSScriptRoot+'"'
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true;$start.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
    $script:Worker=New-Object Diagnostics.Process;$script:Worker.StartInfo=$start;[void]$script:Worker.Start()
    $script:Input=[IO.StreamWriter]::new($script:Worker.StandardInput.BaseStream,[Text.UTF8Encoding]::new($false),4096,$true)
    $script:Read=$script:Worker.StandardOutput.ReadLineAsync();$script:Stderr=$script:Worker.StandardError.ReadToEndAsync()
    $script:Timer=New-Object Windows.Forms.Timer;$script:Timer.Interval=100
    $script:Timer.add_Tick({
        try {
            if($activate.WaitOne(0)){Show-Main}
            $now=[DateTime]::UtcNow
            if(($now-$script:LastActivity).TotalSeconds -gt 15 -and $script:Ready){Send-Worker @{op='suspend'}}
            $script:LastActivity=$now
            if(-not $script:Ready -and $now -gt $script:StartupDeadline){throw 'React не подтвердил готовность окна за 60 секунд. Исходные данные сохранены.'}
            if($script:EnvironmentTask -and $script:EnvironmentTask.IsCompleted){$environment=$script:EnvironmentTask.GetAwaiter().GetResult();$script:EnvironmentTask=$null;[void]$script:Web.EnsureCoreWebView2Async($environment)}
            if($script:Preload -and $script:Preload.IsCompleted){[void]$script:Preload.GetAwaiter().GetResult();$script:Preload=$null;$script:Core.Navigate('https://compost.invalid/desktop.html')}
            for($i=0;$i -lt 8 -and $script:Read.IsCompleted;$i++) {
                $line=$script:Read.GetAwaiter().GetResult()
                if($null -eq $line){if(-not $script:Closing){throw 'Рабочий процесс завершился. Данные сохранены.'};$script:Form.Close();return}
                $script:Read=$script:Worker.StandardOutput.ReadLineAsync()
                if($line.Length -gt 64*1024*1024){throw 'Worker message exceeds limit.'}
                if($line -match '^\{"type":"(view|reply)"') {if($script:Core -and $script:Renderer){$script:Core.PostWebMessageAsJson($line)};continue}
                $message=$line|ConvertFrom-Json
                switch($message.type) {
                    'service' {Handle-Service $message}
                    'ready' {$script:BackendReady=$true;$startup=Join-Path ([Environment]::GetFolderPath('Startup')) 'Compost Club WebView.lnk';Send-Worker @{op='autostartState';enabled=(Test-Path -LiteralPath $startup)}}
                    'closed' {$script:Closing=$true;$script:Form.Close();return}
                    'shutdownFailed' {$script:Closing=$false;throw [string]$message.error}
                    'fatal' {throw [string]$message.error}
                    'error' {throw [string]$message.error}
                }
            }
            Test-Step
        }catch{
            $script:Failure=$_.Exception.Message
            if(-not $AcceptanceFile){[Windows.Forms.MessageBox]::Show($script:Failure,'Compost Club: требуется внимание')|Out-Null}
            $script:Closing=$true;$script:Form.Close()
        }
    })
    $script:Form.add_Shown({
        if(-not $AcceptanceFile){
            $scale=(Get-WebViewDpi $script:Form).windowDpi/96
            $area=[Windows.Forms.Screen]::FromControl($script:Form).WorkingArea
            $script:Form.ClientSize=[Drawing.Size]::new([int][Math]::Min(1260*$scale,$area.Width*0.95),[int][Math]::Min(900*$scale,$area.Height*0.9))
            $script:Form.Location=[Drawing.Point]::new([int]($area.Left+($area.Width-$script:Form.Width)/2),[int]($area.Top+($area.Height-$script:Form.Height)/2))
        }
        $script:EnvironmentTask=[Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync($null,(Join-Path $DataDirectory 'webview-cache'),$options)
        $script:Timer.Start();if($StartHidden -and -not $AcceptanceFile){$script:Form.Hide()}
    })
    if($AcceptanceFile){$script:Form.Opacity=0;$script:Form.ShowInTaskbar=$false;$script:Form.ClientSize=New-Object Drawing.Size(1100,820)}
    [Windows.Forms.Application]::Run($script:Form)
}catch{$script:Failure=$_.Exception.Message}
finally {
    if($script:Timer){$script:Timer.Stop();$script:Timer.Dispose()}
    if($script:Tray){$script:Tray.Visible=$false;$script:Tray.Dispose()}
    if($script:Web){$script:Web.Dispose()}
    if($script:Worker){if(-not $script:Worker.HasExited){$script:Input.Close();[void]$script:Worker.WaitForExit(15000)};$script:Worker.Dispose()}
    if($script:Form){$script:Form.Dispose()}
    if($activate){$activate.Dispose()};if($locked){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}
    if($AcceptanceFile -and -not $script:Duplicate -and $script:Test){$result=@{ok=(-not [bool]$script:Failure);error=$script:Failure;ready=$script:Ready;steps=@($script:TestResults.ToArray())};[IO.File]::WriteAllText([string]$script:Test.result,($result|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))}
}
if($script:Failure){if(-not $AcceptanceFile){[Windows.Forms.MessageBox]::Show($script:Failure,'Compost Club: запуск не завершён')|Out-Null};exit 1}
