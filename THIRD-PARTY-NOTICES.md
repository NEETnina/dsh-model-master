# Third-Party Notices

本文件按 MIT 许可的署名要求，列出本仓库中包含的第三方代码、其版权归属与许可条款。
适用于 npm 发布包、发行 tarball 与源码仓库。

## 组件清单

| 组件                       | 位置                    | 许可 | 版权                                |
| -------------------------- | ----------------------- | ---- | ----------------------------------- |
| 推理档位滑条（`EffortFX`） | `client.js`             | MIT  | 见下方版权声明                      |
| 本项目的其余代码           | `client.js`、`index.js` | MIT  | Model Selection Master Contributors |

## 推理档位滑条（`EffortFX`）

`client.js` 中的 `EffortFX` 模块由以下项目移植而来：

| 次序     | 项目                                                                                | 许可 |
| -------- | ----------------------------------------------------------------------------------- | ---- |
| 直接来源 | `dsh-better-panel` — https://github.com/Bai-2008/dsh-better-panel                   | MIT  |
| 上游     | `dsh-codex-effort-slider` — https://github.com/Microqian2th/dsh-codex-effort-slider | MIT  |

### 涵盖范围

该模块在 `client.js` 中以 IIFE 形式定义，包含：

- 轨道 / 旋钮几何（`TRACK_HEIGHT`、`KNOB_SIZE`、`knobOffsetOf`）
- 位置到颜色的映射（`fillColorFor`、`fillBackgroundFor`、`valueColorFor`、`energyFor`）
- 星尘粒子（`starHash01`、`starDurationFor`、`starDelayFor`、`starLayerOpacityFor` 及相关 CSS）
- 推理档位字典与解析（`LV`、`tiers`、`resolveModel`、`tiersForModel`）
- 禁用态渲染投影、`focusNoScroll`、`setView` 的滚动稳定化
- 官方菜单 DOM 桥（`findEffortRow`、`decorateMenu`、`createMenuBridge` 等）

### 版权声明

```
Copyright (c) 2026 dsh-codex-effort-slider contributors
Copyright (c) 2026 better-dsh-codex-effort-slider contributors
```

上述两行已并入本仓库根目录的 [LICENSE](./LICENSE)。

## 相对上游的修改

以下变更由本项目完成，非上游内容：

- 轨道 / 旋钮尺寸与对比度调整；对 DSH 全局超椭圆（superellipse）圆角显式 opt-out
- 拖动交互改为按档位步进，写回改为停顿去抖
- 移除上游的三处只读注记（档位徽标、provider 归属、API 取值）
- `prefers-reduced-motion` 下将粒子放缓而非冻结
- 上游的自建浮层（picker）分支已移除；本项目中滑条为唯一接线路径
  （`ENABLE_OFFICIAL_MENU_SLIDER` 恒为 `true`）

## 版本对应

上游公开版本线为 `1.0.0` → `1.1.0` → `1.2.0` → `1.3.0` … `1.3.10` → `2.0.0`。
本模块的移植内容与其中如下版本对应：

| 上游版本 | 对应内容                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------ |
| `1.1.0`  | 球大于轨道（`TRACK_HEIGHT=20`、`KNOB_SIZE=28`）；超椭圆 opt-out；`COMMIT_SETTLE_MS=260` 停顿去抖 |
| `1.2.0`  | `LV` 档位字典、`tiers()` 校验、`resolveModel()` 三级检测；禁用态渲染投影；`setView` 滚动稳定化   |
| `1.3.7`  | 插件级 `inject` 补入 `remote` / `remote.session`                                                 |

> 注：源码内早期注释曾标注为「`dsh-better-panel` v3.1」。该版本号在上游公开版本线中不存在，
> 已更正为不标注具体版本号；上表为可核对的对应关系。

## 许可正文

两个上游项目均以 MIT 许可发布，其许可全文与本仓库 [LICENSE](./LICENSE) 一致。
再分发本仓库或其实质部分时，须保留 [LICENSE](./LICENSE) 中的全部版权声明。
