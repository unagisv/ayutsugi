# GitHub Pages へのデプロイ：web/ の内容を gh-pages ブランチとして push し直す
# 使い方: powershell -File tools/deploy-pages.ps1（コミット済みの web/ が公開される）
git branch -D gh-pages 2>$null
git subtree split --prefix web -b gh-pages
if (-not $?) { Write-Error 'subtree split に失敗しました'; exit 1 }
git push -f origin gh-pages
git branch -D gh-pages
Write-Host '公開URL: https://unagisv.github.io/ayutsugi/（反映まで1〜2分）'
