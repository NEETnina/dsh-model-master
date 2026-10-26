# 向 awesome-dsh-plugin 提交

目标清单：[awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
规则来源：[contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)

## 提交内容：一个文件

```
data/plugins/NEETnina__dsh-model-master.yml
```

内容见 [`awesome-entry.example.yml`](./awesome-entry.example.yml)（**文件名里的 `__` 是两个下划线**）。

**不要改 README。** 两个 README 由脚本从 `data/plugins/*.yml` 生成，合并后自动重建。手工改 README 是这类 PR 最常见的翻车方式（行号移位，改动落到邻居条目上）。

## 分类选择：`model`（Models & Providers）

这一条值得说明，因为容易被质疑。

**为什么不是 `ui`：** 本插件外观上确实动了输入框的模型按钮，但 `ui`（UI Enhancements）分类收的是「界面增强」——折叠、时间轴、贴纸、面板布局这类。而 `model`（Models & Providers）分类收的正是**模型选择器与模型测速**，同类项都在那里：

| 已有条目                                                                | 与本插件的关系                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `masknull/dsh-model-tester`                                             | 模型可用性 / TPS / 首 token 测试 —— 与本插件的测速最接近 |
| `qgx1992/dsh-model-select-style`                                        | 替换输入框模型选择控件                                   |
| `vb2250158/dsh-codex-model-selector`                                    | 模型选择器                                               |
| `ZhenXifu/dsh-collapsible-models` / `lakabuji-arch/dsh-model-accordion` | 模型列表形态改造                                         |
| `kingsunb/dsh-model-plus` / `fonlan/dsh-model-router`                   | 模型能力扩展                                             |

所以选 `model`。指南也明说了：分类不会被用来打回，选得不准维护者会直接改。

## 提 PR 前必须完成的事项

这些是 CI **会检查**的硬条件：

- [ ] **仓库创建满 1 天**（CI 自动查，硬门槛）
- [ ] 仓库声明了 `dsh.bundle` —— ✅ 已满足（`{"dsh":{"bundle":{"patch":"./cordis.patch.yml"}}}`，且有 `cordis.patch.yml`）
  - ⚠️ 专有名词：**只声明 `dsh.client` 是不算的**，这是最常见的被拒原因
- [ ] 给仓库打上 [**`dsh-plugin`** topic](https://github.com/topics/dsh-plugin)
- [x] `package.json` 里的 `repository` 指回这个仓库（已填 `NEETnina/dsh-model-master`）
  - 这条决定了 npm 包能否与列表条目自动关联（能关联才会显示下载量）
- [ ] 一个 PR **最多 3 条**（我们只交 1 条）

## 描述准确性：会被逐句对着代码核

指南原文：_"if you write '46 tools across six domains', there should be 46 tools and six domains"_。

我们的描述里每个可核对的数字/能力都已验证：

| 描述里的说法             | 代码中的对应                                             | 状态 |
| ------------------------ | -------------------------------------------------------- | ---- |
| 100-model leaderboard    | `index.js` → `MAX_LEADERBOARD_ROWS = 100`                | ✅   |
| TTFT / TPS               | `index.js` → `runProbeOnce()` 返回 `ttft` / `tps`        | ✅   |
| "real streaming request" | `index.js` → `llmService.stream()` / `prepared.stream()` | ✅   |
| jump to a local search   | `client.js` → `jumpToLocalSearch()`                      | ✅   |
| search across providers  | `client.js` → 搜索框 + 渠道分组                          | ✅   |

**描述刻意没写的东西**（避免夸大）：没写工具数量、没写支持的 DSH 版本号以外的承诺、没用 \"best/fastest/最强\" 这类营销词。

## 可选但强烈建议

### 1. 发布到 npm（我们没有构建步骤，收益最大）

npm 安装免掉 `allowBuilds` 授权步骤。而且**市场会按下载量排序**——前提是已发布包的 `repository` 字段指回清单收录的仓库。

```bash
npm publish --access public
```

不需要额外通知清单维护者，registry 里的映射会被自动采集。

### 2. 截图（`screenshots.json`）

放在**我们自己仓库**的 `package.json` 旁边：

```json
["assets/screenshot-1.png", "assets/screenshot-2.png"]
```

- 1–8 张，路径相对该文件、不能跳出插件目录（不能以 `/` 开头、不能含 `..`）
- 想换图推自己仓库即可，下次构建自动生效，不用再来提 PR
- 不声明也行，市场会从 README 自动抽取——声明只是为了控制顺序和取舍

### 3. `icon:`（可选，**不能用我们的 icon.svg**）

清单只收 **GitHub 托管的位图**（`png`/`jpg`/`jpeg`/`webp`），**SVG 与第三方图床会被拒绝**，约 96px 方形显示最清楚。不写则回退到作者 GitHub 头像。

👉 我们仓库里只有 `icon.svg`（插件自己的图标，那个是给 DSH 插件页用的，两者用途不同）。想要好看的卡片图标，需要额外做一张 180×180 的 PNG 提交到仓库，再在条目里写绝对 URL。

### 4. `tarball:`（不发 npm 时才需要）

```yaml
tarball: https://github.com/NEETnina/dsh-model-master/releases/latest/download/dsh-model-master.tgz
```

⚠️ 指南专门警告过的坑：`latest/download/` 只在请求时解析 `latest`，**文件名是照字面取的**。资产名带版本号的话，提交当天有效，下次发版就 404。

- 要么让**资产名不带版本号**（如上）
- 要么钉住 release tag：`.../releases/download/v1.0.0/dsh-model-master.tgz`

我们是纯 JS、可从源码安装，所以这一项非必需；但发了 npm 就更好。

## 会被打回的几种情况（针对性自查）

| 打回原因                 | 我们的情况                        |
| ------------------------ | --------------------------------- |
| 只声明 `dsh.client`      | ✅ 有 `dsh.bundle`                |
| 占位/纯 README 仓库      | ✅ 约 9200 行真实代码 + 25 项测试 |
| 描述夸大                 | ✅ 每个数字都可核对               |
| 纯聚合包（只有依赖清单） | ✅ 自带全部行为，零 dependencies  |
| 依赖指向别人的副本       | ✅ 零 runtime dependencies        |
| 仓库不满 1 天            | ⏳ 发布后需等                     |

## 一个 PR 的交法

```bash
# fork + clone awesome-dsh-plugin，然后
mkdir -p data/plugins
# 把 awesome-entry.example.yml 的内容存成（注意两个下划线）：
#   data/plugins/NEETnina__dsh-model-master.yml
git checkout -b add-dsh-model-master
git add data/plugins/NEETnina__dsh-model-master.yml
git commit -m "Add dsh-model-master"
git push
```

唯一允许在你本地跑的验证（可选，想预览那一行长什么样）：

```bash
npm ci
node scripts/generate-readme.mjs
```

CI 依次检查：条目数 → `dsh.bundle` → 仓库年龄 → `awesome-lint` 与站点构建。失败会明确说改什么，**在同一分支 push 修复即可，不用重开 PR**。
