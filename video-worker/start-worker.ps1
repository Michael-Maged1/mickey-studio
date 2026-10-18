$ErrorActionPreference = 'Stop'
$workerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $workerDirectory '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'بيئة العامل غير مثبتة. اتبع خطوات التثبيت في README.md.' }
$env:LTX_ROOT = Join-Path $env:LOCALAPPDATA 'MickeyStudio\LTX-Video'
$logDirectory = Join-Path $env:LOCALAPPDATA 'MickeyStudio\logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$stdout = Join-Path $logDirectory 'video-worker.log'
$stderr = Join-Path $logDirectory 'video-worker-error.log'
$existing = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($existing) { Write-Output 'عامل الفيديو يعمل بالفعل على 127.0.0.1:8765'; exit 0 }
Start-Process -FilePath $python -ArgumentList '-m','uvicorn','app:app','--host','127.0.0.1','--port','8765' -WorkingDirectory $workerDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Output 'بدأ عامل LTX المحلي على 127.0.0.1:8765. قد يستغرق تنزيل النموذج دقائق.'
