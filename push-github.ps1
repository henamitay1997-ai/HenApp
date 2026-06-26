# העלאה ל-GitHub — הרץ/י אחרי יצירת repo ריק ב-GitHub
# 1. היכנס/י ל-https://github.com/new
# 2. שם: coparent-app | Public | בלי README
# 3. החלף/י YOUR_USERNAME למטה והרץ/י:
#    powershell -ExecutionPolicy Bypass -File .\push-github.ps1

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUsername,

    [string]$RepoName = "coparent-app"
)

$git = Join-Path $PSScriptRoot ".tools\MinGit\cmd\git.exe"
if (-not (Test-Path $git)) {
    Write-Error "Git לא נמצא. הרץ/י קודם את ההתקנה או התקן/י Git for Windows."
    exit 1
}

Set-Location $PSScriptRoot

$remoteUrl = "https://github.com/$GitHubUsername/$RepoName.git"

& $git remote remove origin 2>$null
& $git remote add origin $remoteUrl
& $git branch -M main
& $git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "הועלה בהצלחה!" -ForegroundColor Green
    Write-Host "https://github.com/$GitHubUsername/$RepoName"
} else {
    Write-Host "ההעלאה נכשלה. ודא/י שיצרת repo ריק ב-GitHub והתחברת (ייפתח חלון התחברות)." -ForegroundColor Yellow
}
