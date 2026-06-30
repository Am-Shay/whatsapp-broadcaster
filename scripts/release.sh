#!/bin/bash
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "develop" ]; then
    echo "Checking for uncommitted changes..."
    git add .
    read -rp "Enter commit message (feat: / fix: / chore:): " commit_msg
    git commit -m "$commit_msg"
    echo "Bumping version..."
    npm run release -- --skip.changelog
    echo "Pushing to develop..."
    git push origin develop
    git push origin --tags
    echo "✅ Pushed to develop. Production (main) was NOT touched."

elif [ "$BRANCH" = "main" ]; then
    echo "⚠️  You are about to release directly to PRODUCTION (main), where a live user is connected. Continue? (y/n)"
    read -r confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        exit 0
    fi
    echo "Checking for uncommitted changes..."
    git add .
    read -rp "Enter commit message (feat: / fix: / chore:): " commit_msg
    git commit -m "$commit_msg"
    echo "Bumping version..."
    npm run release -- --skip.changelog
    echo "Pushing to GitHub..."
    git push origin main
    git push origin --tags
    echo "Done! Railway will deploy automatically."

else
    echo "❌ Releases only run from 'main' or 'develop'. Switch branch first."
    exit 1
fi
