# 開発ログ
## 20220724
- [ ] codemirrorの構成を理解する。
### codemirrorとは
- what
- why
- how
### その他
- 行ベースのWebテキストエディタを作ってみる
    - 画面にはVSCODEみたいに、各行の左側に、対応する行番号が表示される。
    - フォーカスが、ある行のある列にあたっている（デフォルトは0行0列）。
    - キーボードを押すと、対応する文字がサーバ上のDBに保存される。
    - そのDBの内容に対応する文字列が画面に表示される。
- シンプルな挙動
    - ${name}.txtファイルを作成
    - ブラウザでhttp://.../${name}.txtにアクセス時、${name}.txtをロードしてエディタ画面に表示
    - エディタ内にカーソルを配置
        - マルチカーソル
    - キーボード入力に対応して、動作する
        - 追加
            - レコード追加なし
                 - 各種入力キー
                 - ctrl-v(enterなし)
            - レコード追加あり
                 - enter
                 - ctrl-v(enterあり)
        - 削除
            - レコード削除なし
                 - BS(enterなし)
                 - Delete(enterなし)
                 - ctrl-x(enterなし)
            - レコード削除あり
                 - BS(enterあり)
                 - Delete(enterあり)
                 - ctrl-x(enterあり)
        - 選択
            - shift-←↑→↓キー
            - マウスクリック＋ドラッグ
        - カーソル変更
            - ←↑→↓キー
            - マウスクリック
## 20220723
- [ ] [EasyMDE](https://github.com/Ionaru/easy-markdown-editor)がreactで書かれているかを調べる
- [ ] EasyMDEの実装メカニズムをアウトプットする
    - SimpleMDE, made by Sparksuite.をforkして開発を引き継いだもの。
    - 構文に合わせたレンダリングが編集画面で走る。
    - 自動保存とかテーマ変更とかもできる。
    - codemirrorの方がパクリ元として良さそう。
## 20220717
- [x] 構文チェック: typescript標準
- [x] フォーマットチェック: prettier
    - save時に動くようにする
