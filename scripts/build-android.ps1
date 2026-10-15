$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!$env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (!(Test-Path (Join-Path $env:ANDROID_HOME 'platforms\android-36'))) { throw 'Install Android SDK 36 using Android Studio' }
if (!$env:JAVA_HOME) {
    $jdk = Get-ChildItem (Join-Path $env:USERPROFILE '.jdks') -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*21*' } | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
if (!$env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 21 or newer' }
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
('sdk.dir=' + $env:ANDROID_HOME.Replace('\','/')) | Set-Content android/local.properties
& npm.cmd run android:sync
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
Push-Location android
try {
    $gradleArgs = @('assembleDebug')
    if ($env:HTTPS_PROXY) {
        $proxyUri = [Uri]$env:HTTPS_PROXY
        if ($proxyUri.Scheme -eq 'http' -and !$proxyUri.UserInfo) {
            $gradleArgs += "-Dhttps.proxyHost=$($proxyUri.Host)"
            $gradleArgs += "-Dhttps.proxyPort=$($proxyUri.Port)"
            $gradleArgs += "-Dhttp.proxyHost=$($proxyUri.Host)"
            $gradleArgs += "-Dhttp.proxyPort=$($proxyUri.Port)"
        }
    }
    & .\gradlew.bat @gradleArgs
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
}
finally { Pop-Location }
New-Item output -ItemType Directory -Force | Out-Null
Copy-Item android/app/build/outputs/apk/debug/app-debug.apk output/cover-maker-debug.apk -Force
$apkPath = (Resolve-Path output/cover-maker-debug.apk).Path
$apkStream = [System.IO.File]::OpenRead($apkPath)
try {
    $checksum = [System.Security.Cryptography.SHA256]::Create().ComputeHash($apkStream)
    Write-Output ($apkPath + ' SHA256=' + ([BitConverter]::ToString($checksum).Replace('-','').ToLowerInvariant()))
} finally { $apkStream.Dispose() }
