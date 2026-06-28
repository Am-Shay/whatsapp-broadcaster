@echo off
echo Checking for uncommitted changes...
git add .
set /p commit_msg="Enter commit message (feat: / fix: / chore:): "
git commit -m "%commit_msg%"
echo Bumping version...
call npm run release -- --skip.changelog
echo Pushing to GitHub...
git push origin main
git push origin --tags
echo Done! Railway will deploy automatically.
