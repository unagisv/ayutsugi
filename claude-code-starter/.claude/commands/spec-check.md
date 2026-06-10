---
description: 仕様整合性チェック一式を実行（spec-guardian + code-reviewer 並列）
---

直近の変更（git diff で未コミットの変更、引数があれば $ARGUMENTS を対象範囲とする）に対して、品質チェック一式を実行してください：

1. spec-guardian を使って specs/ の仕様書4部との整合性を検証
2. code-reviewer を使って実装品質をレビュー
3. 1と2は並列で実行する
4. 両者の結果を統合し、重大度順（High → Medium → Low）に一覧化
5. 修正が必要な項目があれば、対応方針を提案して私の承認を待つ（勝手に修正しない）
