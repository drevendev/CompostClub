[CmdletBinding()]
param(
    [string]$DataDirectory='',
    [string]$NodeExecutable='',
    [string]$AcceptanceFile='',
    [switch]$StartHidden
)
$ErrorActionPreference='Stop'
# ShellExecute may inherit PowerShell 7's module path. Use only this Windows
# PowerShell runtime's built-in modules, without changing any machine setting.
$env:PSModulePath=(Join-Path $PSHOME 'Modules')+';'+(Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules')
trap {
    $message=$_.Exception.Message
    if($AcceptanceFile){
        try{$failedPlan=Get-Content -LiteralPath $AcceptanceFile -Raw -Encoding UTF8|ConvertFrom-Json;[IO.File]::WriteAllText([string]$failedPlan.result,(@{ok=$false;error=$message;steps=@();ready=$false}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))}catch{}
    }else{try{Add-Type -AssemblyName PresentationFramework;[Windows.MessageBox]::Show($message,'Compost Club: запуск не завершён')|Out-Null}catch{}}
    exit 1
}
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
$script:Worker=$null
$script:Window=$null
$script:Closing=$false
$script:Screen=$null
$script:Busy=$false
$script:Ready=$false
$script:Controls=@{}
$script:Forms=@{}
$script:Drafts=@{}
$script:Submitted=''
$script:ProtocolErrors=0
$script:TestResults=New-Object Collections.Generic.List[object]
$script:LastActivity=[DateTime]::UtcNow
if(-not $DataDirectory){$DataDirectory=Join-Path $env:APPDATA 'Compost Club'}
$DataDirectory=[IO.Path]::GetFullPath($DataDirectory)
if(-not $NodeExecutable){$NodeExecutable=(Get-Command node.exe -ErrorAction Stop).Source}
$NodeExecutable=[IO.Path]::GetFullPath($NodeExecutable)
if($NodeExecutable.Contains('"') -or $DataDirectory.Contains('"')){throw 'Invalid launch path.'}
if(-not(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'native-worker.cjs') -PathType Leaf)){throw 'Native worker is missing.'}
$nodeSignature=Get-AuthenticodeSignature -LiteralPath $NodeExecutable
if($nodeSignature.Status -ne 'Valid'){throw 'Choose an installed Node.js runtime with a valid publisher signature.'}
$nodeVersion=& $NodeExecutable --version
if($nodeVersion -notmatch '^v24\.'){throw 'Node.js 24 is required. No runtime will be downloaded.'}
$packageIdentity=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'PACKAGE-IDENTITY.json') -Raw -Encoding UTF8|ConvertFrom-Json
foreach($file in $packageIdentity.files.PSObject.Properties){
    $absolute=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot $file.Name))
    if(-not $absolute.StartsWith($PSScriptRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Package path escaped its directory.'}
    if((Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.Value){throw 'Package integrity check failed. Preserve the previous version.'}
}
if($AcceptanceFile){
    $marker=Join-Path $DataDirectory 'native-acceptance-profile.private.json'
    if($DataDirectory -match '[\\/]primary-data[\\/]?$' -or -not(Test-Path -LiteralPath $marker)){throw 'Acceptance requires an explicitly marked isolated profile.'}
    $markerData=Get-Content -LiteralPath $marker -Raw -Encoding UTF8|ConvertFrom-Json
    if($markerData.format -ne 'compost-native-acceptance-1' -or $markerData.inference -ne 'disabled'){throw 'Invalid acceptance profile.'}
    $env:COMPOST_NO_INFERENCE='1'
    $script:Test=Get-Content -LiteralPath $AcceptanceFile -Raw -Encoding UTF8|ConvertFrom-Json
    $script:TestStep=0
    $script:ServiceIndex=@{}
    $script:TestDeadline=[DateTime]::UtcNow.AddSeconds(120)
}
$sha=[Security.Cryptography.SHA256]::Create()
try {$key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataDirectory.ToLowerInvariant())))).Replace('-','')}
finally {$sha.Dispose()}
$mutex=New-Object Threading.Mutex($false,('Local\CompostWpf-'+$key))
$activate=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::AutoReset,('Local\CompostWpfShow-'+$key))
$locked=$false
try {$locked=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$locked=$true}
if(-not $locked){[void]$activate.Set();$activate.Dispose();$mutex.Dispose();exit 0}

function Send-Native($request){
    if(-not $script:Worker -or $script:Worker.HasExited){throw 'Native worker is unavailable.'}
    if(-not $request.id){$request.id=[Guid]::NewGuid().ToString()}
    $script:InputWriter.WriteLine(($request|ConvertTo-Json -Depth 30 -Compress))
    $script:InputWriter.Flush()
    if($request.op -in @('navigate','action','snapshot','shutdown','suspend','autostartState')){$script:Busy=$true}
}
function Show-Main {
    $script:Window.Show();if($script:Window.WindowState -eq 'Minimized'){$script:Window.WindowState='Normal'}
    [void]$script:Window.Activate()
}
function Write-Readiness {
    if(-not $script:Ready -or -not $script:Screen){return}
    $script:Window.UpdateLayout()
    $nativeHandle=([Windows.Interop.WindowInteropHelper]::new($script:Window)).Handle
    $value=@{format='compost-native-window-1';pid=$PID;workerPid=$script:Worker.Id;ready=($Content.Children.Count -gt 0);visible=$script:Window.IsVisible;version=$script:Screen.version;handle=$nativeHandle.ToInt64();package=$PSScriptRoot;at=[DateTime]::UtcNow.ToString('o')}
    [IO.File]::WriteAllText((Join-Path $DataDirectory 'native-window.private.json'),($value|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
}
function New-Text($text,[double]$size=15){
    $t=New-Object Windows.Controls.TextBlock
    $t.Text=[string]$text;$t.TextWrapping='Wrap';$t.FontSize=$size;$t.Margin='0,5,0,10'
    return $t
}
function New-Button($text,$callback,$id=''){
    $b=New-Object Windows.Controls.Button
    $b.Content=[string]$text;$b.Padding='12,7';$b.Margin='0,4,8,4';$b.HorizontalAlignment='Left'
    $b.Add_Click($callback)
    if($id){[Windows.Automation.AutomationProperties]::SetAutomationId($b,$id);$script:Controls[$id]=$b}
    return $b
}
function Get-FieldValue($control,$type){
    switch($type){
        'bool' {return [bool]$control.IsChecked}
        'password' {return $control.Password}
        'choice' {if($control.SelectedItem){return [string]$control.SelectedItem.Tag};return ''}
        'multi' {return ,@($control.Children|Where-Object {$_.IsChecked}|ForEach-Object {[string]$_.Tag})}
        default {return [string]$control.Text}
    }
}
function Save-Drafts {
    foreach($entry in $script:Forms.Values){foreach($f in $entry.Fields){if($f.Type -ne 'password'){$script:Drafts[$entry.Cache+'/'+$f.Key]=Get-FieldValue $f.Control $f.Type}}}
}
function Invoke-Action($action,$values,$formKey=''){
    if($script:Busy){return}
    Save-Drafts
    $script:Submitted=$formKey
    Send-Native @{op='action';renderId=$script:Screen.renderId;action=$action;values=$values}
}
function Add-NativeElements($parent,$elements){
    foreach($item in @($elements)){
        switch($item.kind){
            'text' {
                $read=New-Object Windows.Controls.TextBox;$read.Text=[string]$item.text
                $read.IsReadOnly=$true;$read.AcceptsReturn=$true;$read.TextWrapping='Wrap'
                $read.BorderThickness=0;$read.Background=[Windows.Media.Brushes]::Transparent
                $read.Margin='0,5,0,10';$read.MaxHeight=700;$read.VerticalScrollBarVisibility='Auto'
                [void]$parent.Children.Add($read)
            }
            'heading' {$h=New-Text $item.text 22;$h.FontWeight='SemiBold';$h.Margin='0,20,0,8';[void]$parent.Children.Add($h)}
            'button' {
                $action=[string]$item.action
                $priority=[string]$item.priority
                $callback={if($script:Busy -and $priority){Send-Native @{op='interrupt';target=$priority}}else{Invoke-Action $action @{}}}.GetNewClosure()
                $b=New-Button $item.text $callback $action;$b.IsEnabled=(-not $item.disabled)
                [void]$parent.Children.Add($b)
            }
            'detail' {
                $ex=New-Object Windows.Controls.Expander;$ex.Header=[string]$item.text;$ex.Margin='0,10,0,10'
                $inner=New-Object Windows.Controls.StackPanel
                # No XAML is parsed from data. Text is assigned only to native text controls.
                $children=$item.children
                $handler={if($inner.Children.Count -eq 0){Add-NativeElements $inner $children}}.GetNewClosure()
                $ex.Add_Expanded($handler);$ex.Content=$inner;[void]$parent.Children.Add($ex)
            }
            'form' {
                $group=New-Object Windows.Controls.GroupBox;$group.Header=[string]$item.text;$group.Margin='0,10,0,12';$group.Padding='14'
                $stack=New-Object Windows.Controls.StackPanel;$group.Content=$stack
                $fields=New-Object Collections.Generic.List[object]
                $formIdentity=$item.key;if(-not $formIdentity){$formIdentity=$item.text}
                $cache=$script:Screen.garden+'/'+$script:Screen.page+'/'+$script:Screen.selected+'/'+$formIdentity
                foreach($f in @($item.fields)){
                    [void]$stack.Children.Add((New-Text $f.label 14))
                    $value=$f.value;$draftKey=$cache+'/'+$f.key
                    if($f.type -ne 'password' -and $script:Drafts.ContainsKey($draftKey)){$value=$script:Drafts[$draftKey]}
                    switch($f.type){
                        'bool' {$control=New-Object Windows.Controls.CheckBox;$control.IsChecked=[bool]$value;$control.Content=[string]$f.label}
                        'password' {$control=New-Object Windows.Controls.PasswordBox;$control.MaxLength=4096}
                        'choice' {
                            $control=New-Object Windows.Controls.ComboBox
                            foreach($o in @($f.options)){$option=New-Object Windows.Controls.ComboBoxItem;$option.Content=[string]$o.label;$option.Tag=[string]$o.value;[void]$control.Items.Add($option);if([string]$o.value -eq [string]$value){$control.SelectedItem=$option}}
                        }
                        'multi' {
                            $control=New-Object Windows.Controls.StackPanel
                            foreach($o in @($f.options)){$option=New-Object Windows.Controls.CheckBox;$option.Content=New-Text $o.label 14;$option.Tag=[string]$o.value;$option.IsChecked=(@($value) -contains [string]$o.value);$option.Margin='0,3,0,3';[void]$control.Children.Add($option)}
                        }
                        default {
                            $control=New-Object Windows.Controls.TextBox;$control.Text=[string]$value;$control.Padding='7';$control.MaxLength=2097152
                            if($f.type -eq 'area'){$control.AcceptsReturn=$true;$control.TextWrapping='Wrap';$control.MinHeight=90;$control.MaxHeight=260;$control.VerticalScrollBarVisibility='Auto'}
                        }
                    }
                    $control.Margin='0,0,0,10'
                    $automation=$item.action+'/'+$f.key
                    [Windows.Automation.AutomationProperties]::SetAutomationId($control,$automation)
                    $script:Controls[$automation]=$control
                    $fields.Add(@{Key=[string]$f.key;Type=[string]$f.type;Control=$control})
                    if($f.type -eq 'multi'){$scroll=New-Object Windows.Controls.ScrollViewer;$scroll.MaxHeight=230;$scroll.VerticalScrollBarVisibility='Auto';$scroll.Content=$control;[void]$stack.Children.Add($scroll)}else{[void]$stack.Children.Add($control)}
                }
                $action=[string]$item.action
                $entry=@{Fields=$fields;Cache=$cache}
                $script:Forms[$action]=$entry
                $callback={
                    $values=@{}
                    foreach($f in $entry.Fields){$values[$f.Key]=Get-FieldValue $f.Control $f.Type}
                    Invoke-Action $action $values $entry.Cache
                    foreach($f in $entry.Fields){if($f.Type -eq 'password'){$f.Control.Clear()}}
                }.GetNewClosure()
                [void]$stack.Children.Add((New-Button $item.text $callback $action))
                [void]$parent.Children.Add($group)
            }
        }
    }
}
function Navigate($page,$garden=''){
    if($script:Busy){return};Save-Drafts
    $command=@{op='navigate';page=$page}
    if($garden){$command.garden=$garden}
    Send-Native $command
}
function Render-Screen($screen){
    if($script:Submitted -and -not $screen.error){foreach($key in @($script:Drafts.Keys)){if($key.StartsWith($script:Submitted+'/')){$script:Drafts.Remove($key)}}}
    $script:Submitted=''
    $script:Screen=$screen;$script:Controls=@{};$script:Forms=@{}
    $Title.Text=$screen.title+' · v'+$screen.version+' · WPF'
    $Status.Text=[string]$screen.status
    $ErrorText.Text=[string]$screen.error
    $Refresh.Visibility='Collapsed'
    $Garden.Items.Clear()
    foreach($g in @($screen.gardens)){$o=New-Object Windows.Controls.ComboBoxItem;$o.Content=[string]$g.label;$o.Tag=[string]$g.value;[void]$Garden.Items.Add($o);if($g.value -eq $screen.garden){$Garden.SelectedItem=$o}}
    $Nav.Children.Clear()
    foreach($p in @($screen.pages)){$page=[string]$p.value;$callback={Navigate $page}.GetNewClosure();$b=New-Button $p.label $callback ('nav-'+$page);$b.HorizontalAlignment='Stretch';if($page -eq $screen.page){$b.FontWeight='Bold'};[void]$Nav.Children.Add($b)}
    $Toolbar.Children.Clear();Add-NativeElements $Toolbar $screen.toolbar
    $Content.Children.Clear();Add-NativeElements $Content $screen.body
    Write-Readiness
}
function Handle-Service($message){
    $value=$null;$failure=$false
    try {
        if($AcceptanceFile){
            $name=[string]$message.kind
            if(-not $script:ServiceIndex.ContainsKey($name)){$script:ServiceIndex[$name]=0}
            $responses=@($script:Test.services.$name)
            $index=$script:ServiceIndex[$name];$script:ServiceIndex[$name]=$index+1
            if($index -lt $responses.Count){$value=$responses[$index]}
            elseif($name -eq 'confirm'){$value=$false}
            elseif($name -eq 'pick'){$value=@()}
            else {$value=$null}
        } else {
            switch($message.kind){
                'pick' {
                    $kind=$message.payload.kind
                    if($kind -in @('models','export')){
                        $dialog=New-Object Windows.Forms.FolderBrowserDialog;$dialog.Description='Выберите папку Compost Club'
                        try{if($dialog.ShowDialog() -eq 'OK'){$value=@($dialog.SelectedPath)}else{$value=@()}}finally{$dialog.Dispose()}
                    }else{
                        $dialog=New-Object Microsoft.Win32.OpenFileDialog;$dialog.Multiselect=($kind -eq 'import')
                        if($kind -eq 'executable'){$dialog.Filter='Программа Ollama|*.exe'}elseif($kind -eq 'restore'){$dialog.Filter='Полная копия JSON|*.json'}else{$dialog.Filter='Исходные идеи|*.md;*.txt;*.json|Все файлы|*.*'}
                        if($dialog.ShowDialog($script:Window)){$value=@($dialog.FileNames)}else{$value=@()}
                    }
                }
                'saveBackup' {$dialog=New-Object Microsoft.Win32.SaveFileDialog;$dialog.Filter='Полная приватная копия JSON|*.json';$dialog.FileName='compost-backup-'+(Get-Date -Format yyyy-MM-dd)+'.json';if($dialog.ShowDialog($script:Window)){$value=$dialog.FileName}}
                'confirm' {$value=([Windows.MessageBox]::Show($script:Window,[string]$message.payload.message,'Проверьте изменения','YesNo','Warning','No') -eq 'Yes')}
                'openDirectory' {Start-Process -FilePath 'explorer.exe' -ArgumentList ('"'+[string]$message.payload.directory+'"');$value=$true}
                'showWindow' {Show-Main;Write-Readiness;$value=@{visible=$script:Window.IsVisible;minimized=($script:Window.WindowState -eq 'Minimized');focused=$script:Window.IsActive;ready=($Content.Children.Count -gt 0)}}
                'openLink' {$url=[Uri]$message.payload.url;if($url.Scheme -notin @('http','https')){throw 'Unsupported link'};Start-Process -FilePath $url.AbsoluteUri;$value=$true}
                'autostart' {
                    $startup=[Environment]::GetFolderPath('Startup');$shortcut=Join-Path $startup 'Compost Club WPF.lnk'
                    if($message.payload.enabled){
                        $shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut($shortcut)
                        $link.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
                        $link.Arguments='-NoProfile -STA -WindowStyle Hidden -File "'+(Join-Path $PSScriptRoot 'Start-CompostClub.ps1')+'" -DataDirectory "'+$DataDirectory+'" -NodeExecutable "'+$NodeExecutable+'" -StartHidden'
                        $link.WorkingDirectory=$PSScriptRoot;$link.Save();$value=$true
                    }else{if(Test-Path -LiteralPath $shortcut){Remove-Item -LiteralPath $shortcut};$value=$false}
                }
            }
        }
    }catch{$failure=$true}
    Send-Native @{op='serviceResult';id=$message.id;value=$value;error=$failure}
}
function Request-Shutdown {
    if($script:Closing){return};$script:Closing=$true
    Send-Native @{op='interrupt';target='pause'}
    Send-Native @{op='shutdown'}
    $Status.Text='Завершаем работу и сохраняем данные…'
}
function Test-Step {
    if(-not $AcceptanceFile -or -not $script:Ready -or $script:Busy -or $script:Closing){return}
    if([DateTime]::UtcNow -gt $script:TestDeadline){throw 'Acceptance timeout'}
    if($script:TestWaitUntil -and [DateTime]::UtcNow -lt $script:TestWaitUntil){return}
    if($script:TestStep -ge @($script:Test.steps).Count){Request-Shutdown;return}
    $step=$script:Test.steps[$script:TestStep];$script:TestStep++
    switch($step.kind){
        'relaunch' {Start-Process -FilePath ([string]$script:Test.shortcut);$script:TestWaitUntil=[DateTime]::UtcNow.AddSeconds(3)}
        'assertOwner' {$owner=Get-Content -LiteralPath (Join-Path $DataDirectory 'native-window.private.json') -Raw -Encoding UTF8|ConvertFrom-Json;if($owner.workerPid -ne $script:Worker.Id -or $owner.pid -ne $PID){throw 'Repeated shortcut changed the profile owner.'}}
        'navigate' {
            $targetGarden=$step.garden
            if($step.gardenName){$targetGarden=(@($script:Screen.gardens|Where-Object label -eq $step.gardenName)[0]).value}
            Navigate $step.page $targetGarden
        }
        'fill' {
            $form=@($script:Screen.body|Where-Object {$_.kind -eq 'form' -and $_.text -eq $step.form})|Select-Object -First 1
            if(-not $form){throw ('Form missing: '+$step.form)}
            foreach($property in $step.values.PSObject.Properties){
                $f=@($script:Forms[$form.action].Fields|Where-Object Key -eq $property.Name)[0]
                if(-not $f){throw ('Field missing: '+$property.Name)}
                switch($f.Type){
                    'bool' {$f.Control.IsChecked=[bool]$property.Value}
                    'password' {$f.Control.Password=[string]$property.Value}
                    'choice' {$f.Control.SelectedItem=@($f.Control.Items|Where-Object Tag -eq ([string]$property.Value))[0]}
                    'multi' {foreach($o in $f.Control.Children){$o.IsChecked=(@($property.Value) -contains $o.Tag)}}
                    default {$f.Control.Text=[string]$property.Value}
                }
            }
        }
        'click' {
            $items=@($script:Controls.Values|Where-Object {$_ -is [Windows.Controls.Button] -and ([string]$_.Content) -eq [string]$step.text})
            if(-not $items.Count){throw ('Button missing: '+$step.text)}
            if(-not $items[0].IsEnabled){throw ('Button disabled: '+$step.text)}
            $items[0].RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        }
        'assert' {
            $serialized=$script:Screen|ConvertTo-Json -Depth 60
            if($step.contains -and -not $serialized.Contains([string]$step.contains)){throw ('Expected text missing: '+$step.contains)}
            if($step.noError -and $script:Screen.error){throw ('Unexpected UI error: '+$script:Screen.error)}
        }
        'capture' {
            $script:Window.UpdateLayout()
            $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$script:Window.ActualWidth,[int]$script:Window.ActualHeight,96,96,[Windows.Media.PixelFormats]::Pbgra32)
            $bitmap.Render($script:Window.Content);$encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder
            $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
            $stream=[IO.File]::Create([string]$step.file);try{$encoder.Save($stream)}finally{$stream.Dispose()}
        }
        default {throw 'Unknown acceptance step'}
    }
    $script:TestResults.Add(@{step=$script:TestStep;kind=$step.kind;ok=$true})
}
try {
    [xml]$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Title="Compost Club" Width="1260" Height="900" MinWidth="720" MinHeight="600" Background="#F6F3EB" FontFamily="Segoe UI" FontSize="15" WindowStartupLocation="CenterScreen">
  <Grid Margin="20"><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/></Grid.RowDefinitions>
    <DockPanel Grid.Row="0"><TextBlock Name="Title" Text="Compost Club · открываем сад…" FontSize="25" FontWeight="SemiBold"/><Button Name="Exit" Content="Завершить" DockPanel.Dock="Right" Margin="20,0,0,0" Padding="12,7"/></DockPanel>
    <StackPanel Grid.Row="1" Margin="0,14,0,12"><TextBlock Name="Status" TextWrapping="Wrap"/><TextBlock Name="ErrorText" Foreground="#922525" TextWrapping="Wrap" Margin="0,6,0,0"/><WrapPanel Name="Toolbar"/><Button Name="Refresh" Content="Есть изменения — обновить экран" Visibility="Collapsed" HorizontalAlignment="Left" Padding="10,6"/></StackPanel>
    <Grid Grid.Row="2"><Grid.ColumnDefinitions><ColumnDefinition Width="225"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
      <ScrollViewer Grid.Column="0" VerticalScrollBarVisibility="Auto" Margin="0,0,20,0"><StackPanel><TextBlock Text="ВАШИ САДЫ" Margin="0,0,0,6"/><ComboBox Name="Garden" Margin="0,0,0,12"/><StackPanel Name="Nav"/><TextBlock Text="Закрыть окно — скрыть в трей. Завершить — остановить приложение." TextWrapping="Wrap" Margin="0,20,0,0" Foreground="#52614F"/></StackPanel></ScrollViewer>
      <ScrollViewer Name="ContentScroll" Grid.Column="1" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled"><StackPanel Name="Content" Margin="8,0,16,20"/></ScrollViewer>
    </Grid>
  </Grid>
</Window>
'@
    $reader=New-Object Xml.XmlNodeReader($xaml)
    $script:Window=[Windows.Markup.XamlReader]::Load($reader)
    if([Windows.SystemParameters]::HighContrast){$script:Window.Background=[Windows.SystemColors]::WindowBrush;$script:Window.Foreground=[Windows.SystemColors]::WindowTextBrush}
    foreach($name in @('Title','Status','ErrorText','Toolbar','Garden','Nav','Content','ContentScroll','Refresh','Exit')){Set-Variable -Name $name -Value $script:Window.FindName($name) -Scope Script}
    $Garden.Add_SelectionChanged({if($script:Screen -and $Garden.SelectedItem -and $Garden.SelectedItem.Tag -ne $script:Screen.garden){Navigate 'cards' ([string]$Garden.SelectedItem.Tag)}})
    $Refresh.Add_Click({if(-not $script:Busy){Save-Drafts;Send-Native @{op='snapshot'}}})
    $Exit.Add_Click({Request-Shutdown})
    $script:Window.Add_Closing({param($sender,$eventArgs);if(-not $script:Closing){$eventArgs.Cancel=$true;$script:Window.Hide()}})
    $tray=New-Object Windows.Forms.NotifyIcon
    $tray.Text='Compost Club · WPF';$tray.Icon=[Drawing.SystemIcons]::Application
    $icon=Join-Path $PSScriptRoot 'garden-icon.ico';if(Test-Path -LiteralPath $icon){$tray.Icon=New-Object Drawing.Icon($icon)}
    $menu=New-Object Windows.Forms.ContextMenuStrip
    [void]$menu.Items.Add('Открыть Compost Club',$null,{Show-Main})
    [void]$menu.Items.Add('Пауза',$null,{Send-Native @{op='interrupt';target='pause'}})
    [void]$menu.Items.Add('Завершить',$null,{Request-Shutdown})
    $tray.ContextMenuStrip=$menu;$tray.Add_DoubleClick({Show-Main});$tray.Visible=(-not [bool]$AcceptanceFile)
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$NodeExecutable
    $start.Arguments='"'+(Join-Path $PSScriptRoot 'native-worker.cjs')+'" --data-dir "'+$DataDirectory+'" --package-root "'+$PSScriptRoot+'"'
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $start.StandardOutputEncoding=[Text.UTF8Encoding]::new($false)
    $script:Worker=New-Object Diagnostics.Process;$script:Worker.StartInfo=$start
    [void]$script:Worker.Start()
    $script:InputWriter=[IO.StreamWriter]::new($script:Worker.StandardInput.BaseStream,[Text.UTF8Encoding]::new($false),4096,$true)
    $script:Read=$script:Worker.StandardOutput.ReadLineAsync()
    $script:Stderr=$script:Worker.StandardError.ReadToEndAsync()
    $script:Timer=New-Object Windows.Threading.DispatcherTimer
    $script:Timer.Interval=[TimeSpan]::FromMilliseconds(100)
    $script:Timer.Add_Tick({
        try {
            if($activate.WaitOne(0)){Show-Main;Write-Readiness}
            $now=[DateTime]::UtcNow
            if(($now-$script:LastActivity).TotalSeconds -gt 15 -and -not $script:Busy -and $script:Ready){Send-Native @{op='suspend'}}
            $script:LastActivity=$now
            for($i=0;$i -lt 6 -and $script:Read.IsCompleted;$i++){
                $line=$script:Read.GetAwaiter().GetResult()
                if($null -eq $line){
                    if(-not $script:Closing){throw 'Рабочий процесс завершился. Данные сохранены; проверьте журнал запуска.'}
                    $script:Window.Close();return
                }
                if($line.Length -gt 64*1024*1024){throw 'Native output exceeds limit.'}
                $message=$line|ConvertFrom-Json
                $script:Read=$script:Worker.StandardOutput.ReadLineAsync()
                switch($message.type){
                    'screen' {Render-Screen $message.screen}
                    'status' {
                        $Status.Text=[string]$message.status;$Refresh.Visibility='Visible'
                        if($message.controls -and $script:Screen){
                            $pause=$script:Controls[[string]$script:Screen.toolbar[0].action]
                            $eureka=$script:Controls[[string]$script:Screen.toolbar[1].action]
                            if($pause){$pause.Content=[string]$message.controls.pauseText;$pause.IsEnabled=[bool]$message.controls.pauseEnabled}
                            if($eureka){$eureka.IsEnabled=[bool]$message.controls.eurekaEnabled}
                        }
                    }
                    'service' {Handle-Service $message}
                    'done' {$script:Busy=$false}
                    'ready' {
                        $script:Ready=$true
                        $startupLink=Join-Path ([Environment]::GetFolderPath('Startup')) 'Compost Club WPF.lnk'
                        Send-Native @{op='autostartState';enabled=(Test-Path -LiteralPath $startupLink)}
                        if(-not $StartHidden -and -not $AcceptanceFile){Show-Main}
                        Write-Readiness
                    }
                    'closed' {$script:Closing=$true;$script:Window.Close()}
                    'shutdownFailed' {$script:Closing=$false;$script:Busy=$false;$ErrorText.Text=[string]$message.error;Show-Main}
                    'fatal' {throw [string]$message.error}
                    'error' {$script:ProtocolErrors++;$ErrorText.Text=[string]$message.error}
                }
            }
            Test-Step
        }catch{
            $script:Failure=$_.Exception.Message
            if($AcceptanceFile){$script:Closing=$true;$script:Window.Close()}
            else{$ErrorText.Text=$script:Failure;Show-Main}
        }
    })
    $script:Timer.Start()
    if($AcceptanceFile){$script:Window.ShowInTaskbar=$false;$script:Window.Width=1100;$script:Window.Height=820;$script:Window.Opacity=0}
    $application=New-Object Windows.Application
    $application.ShutdownMode='OnExplicitShutdown'
    $script:Window.Add_Closed({$application.Shutdown()})
    $application.Add_SessionEnding({param($sender,$eventArgs);$eventArgs.Cancel=$true;Request-Shutdown})
    if($AcceptanceFile){$script:Window.Show()}
    [void]$application.Run()
}catch{
    $script:Failure=$_.Exception.Message
    if(-not $AcceptanceFile){[Windows.MessageBox]::Show('Не удалось открыть Compost Club. Данные оставлены на месте. '+$script:Failure,'Compost Club')|Out-Null}
}finally{
    if($script:Timer){$script:Timer.Stop()}
    if($tray){$tray.Visible=$false;$tray.Dispose()}
    if($script:Worker){
        if(-not $script:Worker.HasExited){$script:Worker.StandardInput.Close();[void]$script:Worker.WaitForExit(15000)}
        # Do not kill a worker holding unsaved emergency evidence.
        $script:Worker.Dispose()
    }
    $activate.Dispose();if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()
    if($AcceptanceFile){
        $result=@{ok=(-not [bool]$script:Failure);error=$script:Failure;steps=@($script:TestResults.ToArray());protocolErrors=$script:ProtocolErrors;ready=$script:Ready}
        [IO.File]::WriteAllText([string]$script:Test.result,($result|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
    }
}
if($script:Failure){exit 1}
