@echo off
setlocal EnableDelayedExpansion

for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b

if "!BRANCH!"=="develop" goto :develop
if "!BRANCH!"=="main" goto :main
echo [X] Releases only run from 'main' or 'develop'. Switch branch first.
exit /b 1

:develop
echo Checking for uncommitted changes...
git add .
set /p commit_msg="Enter commit message (feat: / fix: / chore:): "
git commit -m "!commit_msg!"
echo Bumping version...
call npm run release -- --skip.changelog
echo Pushing to develop...
git push origin develop
git push origin --tags
echo [OK] Pushed to develop. Production (main) was NOT touched.
goto :eof

:main
echo [!] You are about to release directly to PRODUCTION (main), where a live user is connected. Continue? (y/n)
set /p confirm=
if /i NOT "!confirm!"=="y" (
    echo Aborted.
    goto :eof
)
echo Checking for uncommitted changes...
git add .
set /p commit_msg="Enter commit message (feat: / fix: / chore:): "
git commit -m "!commit_msg!"
echo Bumping version...
call npm run release -- --skip.changelog
echo Pushing to GitHub...
git push origin main
git push origin --tags
echo Done! Railway will deploy automatically.
goto :eof
