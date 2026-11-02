# Windows PowerShell 5.1 uses .NET Framework, without Application.SetHighDpiMode.
# Reuse the signed framework's user32 wrappers; do not compile a helper DLL or
# modify powershell.exe, compatibility flags, registry or Windows display settings.
function Initialize-WebViewDpi {
    $script:DpiFlags=[Reflection.BindingFlags]'Public,NonPublic,Static'
    $framework=[Windows.Forms.Form].Assembly
    $script:DpiSafe=$framework.GetType('System.Windows.Forms.SafeNativeMethods')
    $script:DpiCommon=$framework.GetType('System.Windows.Forms.CommonUnsafeNativeMethods')
    $script:DpiUnsafe=$framework.GetType('System.Windows.Forms.UnsafeNativeMethods')
    $setter=$script:DpiSafe.GetMethod('SetProcessDpiAwarenessContext',$script:DpiFlags)
    if(-not $setter){throw 'Для чёткого интерфейса требуется Windows 10/11 и .NET Framework 4.8.'}
    [void]$setter.Invoke($null,@(-4))
    $current=$script:DpiSafe.GetMethod('GetThreadDpiAwarenessContext',$script:DpiFlags).Invoke($null,@())
    $equal=$script:DpiSafe.GetMethod('AreDpiAwarenessContextsEqual',$script:DpiFlags)
    if(-not $equal.Invoke($null,@($current,-4))) {
        $contextType=$framework.GetType('System.Windows.Forms.DpiAwarenessContext')
        $target=[Enum]::ToObject($contextType,-4)
        $script:PreviousDpi=$script:DpiCommon.GetMethod('SetThreadDpiAwarenessContext',$script:DpiFlags).Invoke($null,@($target))
    }
    $current=$script:DpiSafe.GetMethod('GetThreadDpiAwarenessContext',$script:DpiFlags).Invoke($null,@())
    if(-not $equal.Invoke($null,@($current,-4))){throw 'Не удалось включить чёткую отрисовку PerMonitorV2.'}
}
function Get-WebViewDpi($form) {
    $context=$script:DpiCommon.GetMethod('GetWindowDpiAwarenessContext',$script:DpiFlags).Invoke($null,@($form.Handle))
    $perMonitor=$script:DpiSafe.GetMethod('AreDpiAwarenessContextsEqual',$script:DpiFlags).Invoke($null,@($context.ToInt32(),-4))
    $handle=[Runtime.InteropServices.HandleRef]::new($form,$form.Handle)
    $dpi=$script:DpiUnsafe.GetMethod('GetDpiForWindow',$script:DpiFlags).Invoke($null,@($handle))
    return @{perMonitorV2=[bool]$perMonitor;windowDpi=[int]$dpi;clientWidth=$form.ClientSize.Width;clientHeight=$form.ClientSize.Height}
}
