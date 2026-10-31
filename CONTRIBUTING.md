# 参与贡献

这个项目最看重的一件事：**不伪造数据**。任何改动如果会让「测速、榜单、版本检查」在拿不到真实结果时给出看起来正常的数字或结论，都会被拒。

## 本地开发

```bash
git clone git@github.com:NEETnina/dsh-model-master.git
cd dsh-model-master
npm install --no-save prettier@3      # 只有一个开发依赖

node --check index.js && node --check client.js
npm test                              # 65 项
npx prettier --check "*.js" "tests/*.js" "*.md" "*.json" "*.yml"
```

装进本地 DSH 试用：

```bash
dsh plugin --profile web add .
# 改完代码重启 DSH，或等 HMR 自行重载
```

## 项目结构

| 路径               | 内容                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| `index.js`         | 宿主侧：HTTP 路由（`/api/model-master/*`）、真实测速探针、榜单同步、版本检查 |
| `client.js`        | 浏览器侧：Spotlight 面板、搜索 / 分组 / 优选、15 语言文案、推理档位 FX       |
| `cordis.patch.yml` | 把插件挂进 DSH 运行时 profile 的 bundle patch                                |
| `tests/`           | `node:test`，纯函数与网络路径都覆盖，网络一律用桩替换                        |
| `assets/`          | 截图与图标（`screenshots.json` 决定插件市场里的顺序）                        |

## 提交信息

沿用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(probe): 支持 ×5 稳定模式
fix(update): 回退源结果比 API 结果更早过期
docs(readme): 补 30 秒上手
```

## 发版流程

1. 更新 `package.json` 的 `version` 与 `CHANGELOG.md`（格式参考既有条目）
2. `npm test` 与 prettier 检查全绿
3. 打 tag 并推送：`git tag v1.1.3 && git push origin v1.1.3`
4. 建 release 并附上打包产物（**资产名不要带版本号**，否则 `releases/latest/download/<名字>` 会在下次发版后 404）
5. 需要时发布到 npm：`npm publish --access public`

## 新增界面语言

语言表在 `client.js` 里，键名与现有语言保持一致；阿拉伯语 / 乌尔都语这类 RTL 语言会被自动识别并翻转方向。新增语言请同时提供：界面文案、`README` 里的语言列表更新，以及一张该语言的截图（放进 `assets/` 并登记到 `screenshots.json`）。
