$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$workspaceDirectory = Split-Path -Parent $projectDirectory
$outputDirectory = Join-Path $workspaceDirectory 'outputs\audiojoin'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compilerPath)) {
    $compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compilerPath)) { throw '未找到 Windows .NET Framework C# 编译器。' }
$launcherSource = Join-Path $PSScriptRoot 'Launcher.cs'
$executablePath = Join-Path $outputDirectory '音频合并.exe'
$compilerArguments = @('/nologo', '/target:winexe', '/platform:anycpu', '/optimize+', '/codepage:65001', '/reference:System.Windows.Forms.dll', "/out:$executablePath")
foreach ($resourceName in @('index.html', 'style.css', 'wav-engine.js', 'app.js')) {
    $resourcePath = Join-Path $projectDirectory $resourceName
    $compilerArguments += "/resource:$resourcePath,$resourceName"
}
$compilerArguments += $launcherSource
& $compilerPath @compilerArguments
if ($LASTEXITCODE -ne 0) { throw '桌面启动程序编译失败。' }
$webFiles = @('index.html', 'style.css', 'wav-engine.js', 'app.js', '使用说明.txt') | ForEach-Object { Join-Path $projectDirectory $_ }
Compress-Archive -LiteralPath $webFiles -DestinationPath (Join-Path $outputDirectory '音频合并-离线网页版.zip') -Force
Copy-Item -LiteralPath (Join-Path $projectDirectory '使用说明.txt') -Destination (Join-Path $outputDirectory '使用说明.txt') -Force
Get-Item -LiteralPath $executablePath, (Join-Path $outputDirectory '音频合并-离线网页版.zip') | Select-Object Name, Length
