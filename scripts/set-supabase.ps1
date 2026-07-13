<#
  PowerShell helper to create a .env file for the project.
  Run with: .\scripts\set-supabase.ps1
  If execution is blocked, run PowerShell as admin and:
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#>

param()

function Read-Secret([string]$prompt) {
  Write-Host $prompt -NoNewline
  $secure = Read-Host -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

Write-Host "This will create or overwrite a .env file in the project root.`n" -ForegroundColor Cyan

$projectId = Read-Host "Enter VITE_SUPABASE_PROJECT_ID (project id)"
$url = Read-Host "Enter VITE_SUPABASE_URL (https://<ref>.supabase.co)"
$publishable = Read-Host "Enter VITE_SUPABASE_PUBLISHABLE_KEY (anon/public key)"

$serviceRole = Read-Host "(Optional) Enter SUPABASE_SERVICE_ROLE_KEY (leave blank for none)"

$content = @()
$content += "VITE_SUPABASE_PROJECT_ID=\"$projectId\""
$content += "VITE_SUPABASE_PUBLISHABLE_KEY=\"$publishable\""
$content += "VITE_SUPABASE_URL=\"$url\""
if ($serviceRole -ne "") {
  $content += "SUPABASE_SERVICE_ROLE_KEY=\"$serviceRole\""
}

$path = Join-Path -Path (Get-Location) -ChildPath ".env"

Write-Host "Writing .env to $path" -ForegroundColor Green
Set-Content -Path $path -Value $content -Encoding UTF8

Write-Host "Done. Restart your dev server if it's running." -ForegroundColor Yellow
