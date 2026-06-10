# Deploy web/ to GitHub Pages (gh-pages branch).
# Usage: powershell -File tools/deploy-pages.ps1  (publishes committed contents of web/)
git branch -D gh-pages 2>$null
git subtree split --prefix web -b gh-pages
if (-not $?) { Write-Error 'subtree split failed'; exit 1 }
git push -f origin gh-pages
git branch -D gh-pages
Write-Host 'URL: https://unagisv.github.io/ayutsugi/ (live in 1-2 min)'
