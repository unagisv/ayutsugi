# claude-code-starter ―『歩継ぎ』Claude Code スターターキット

このフォルダは、開発プロジェクトフォルダにそのままコピーして使う設定一式です。
使い方はマニュアル第4章（docs/Claude_Code開発マニュアル_歩継ぎ_v1.0.md）を参照。

## 内容

```text
claude-code-starter/
├── README.md                      ← このファイル（コピー不要）
├── CLAUDE.md                      ← プロジェクトの記憶（自動読込）
└── .claude/
    ├── settings.json              ← パーミッション初期設定
    ├── agents/
    │   ├── tech-architect.md      ← 技術設計担当
    │   ├── spec-guardian.md       ← 仕様整合性チェック（読取り専用）
    │   ├── test-engineer.md       ← テスト担当
    │   └── code-reviewer.md       ← コード品質レビュー（読取り専用）
    └── commands/
        └── spec-check.md          ← /spec-check コマンド
```

## セットアップ（PowerShell・コピペ用）

```powershell
mkdir C:\Users\mocho\dev\ayutsugi
cd C:\Users\mocho\dev\ayutsugi
mkdir specs, docs
Copy-Item "C:\Users\mocho\Documents\ayutsugi\specs\*" .\specs\
Copy-Item "C:\Users\mocho\Documents\ayutsugi\docs\*" .\docs\
Copy-Item -Recurse "C:\Users\mocho\Documents\ayutsugi\claude-code-starter\.claude" .\
Copy-Item "C:\Users\mocho\Documents\ayutsugi\claude-code-starter\CLAUDE.md" .\
git init
git add .
git commit -m "プロジェクト初期化：仕様書・Claude Code設定一式"
claude
```

## 確認方法

Claude Code起動後に `/agents` と打つと、4体のエージェントが表示されれば成功です。
