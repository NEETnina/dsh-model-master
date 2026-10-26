/**
 * 模型选择大师 — Web Client
 *
 * Precision-engineered Spotlight modal replacing and elevating DSH's native
 * `conversation.input.model` slot:
 *   1. Preserves DSH native provider grouping as clean, smooth-scrolling tabs.
 *   2. Real-time streaming speed benchmark (TTFT ms & TPS tok/s) with clean monospace metrics.
 *   3. Intelligent Optimal Node routing scoped to the active category.
 *   4. Live LLM leaderboard (up to 100 scored models) built from OpenRouter's real
 *      benchmark payload — display only; clicking a row jumps to a local search
 *      so the user picks the channel (no automatic model matching by design).
 *   5. Minimalist, distraction-free craftsmanship inspired by Raycast & Linear.
 *   6. Dual theme system: Dark (Obsidian) and Light (Paper), persisted in localStorage.
 *   7. Inline reasoning-effort switching (high / medium / low).
 *   8. Loopback-only backend: catalog / probe / leaderboard / results over HTTP.
 *
 * Zero personal privacy leaks: zero hardcoded paths, usernames, or keys.
 *
 * @license MIT
 */

window.__ModuleLoader__.load({
  id: 'dsh-model-master',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const ReactDOM = require('react-dom')

    const {
      createElement: h,
      Fragment,
      useState,
      useEffect,
      useMemo,
      useRef,
      useCallback,
      useSyncExternalStore
    } = React
    const { createPortal } = ReactDOM

    // ── UI text table (i18n scaffold) ──────────────────────────────────────
    // Single zh-CN locale today. All static labels route through this map —
    // swap or extend it to translate the UI without touching the JSX.

    /* ══════════════ i18n：15 语言（全球使用人数前列）══════════════
       en/zh 全量；其余语言为 UI 级翻译。键 = 英文语义名，缺译文回退中文。 */
    var UI_LANG_KEY = 'dsh_model_master_lang'
    var LANGUAGES = [
      ['en', 'English'],
      ['zh', '中文'],
      ['hi', 'हिन्दी'],
      ['es', 'Español'],
      ['fr', 'Français'],
      ['ar', 'العربية'],
      ['bn', 'বাংলা'],
      ['pt', 'Português'],
      ['ru', 'Русский'],
      ['ur', 'اردو'],
      ['id', 'Bahasa Indonesia'],
      ['de', 'Deutsch'],
      ['ja', '日本語'],
      ['ko', '한국어'],
      ['tr', 'Türkçe']
    ]
    var uiLang = 'zh'
    // NOTE: the persisted language is restored AFTER every dictionary is
    // assigned (search "restore the persisted language" below). Reading it here
    // used to run while `I18N` was still undefined, so `I18N_HAS` always
    // answered false and every saved language silently reverted to zh.
    function I18N_HAS(l) {
      return l === 'zh' || !!(I18N && I18N[l])
    }
    function t(key, params) {
      var d = I18N[uiLang] || I18N.zh
      var s = d[key] != null ? d[key] : I18N.zh[key]
      if (s == null) return key
      if (params) for (var i = 0; i < params.length; i++) s = s.split('{' + i + '}').join(String(params[i]))
      return s
    }
    function isRTLLang() {
      return uiLang === 'ar' || uiLang === 'ur'
    }
    function setUiLang(l) {
      if (!I18N_HAS(l)) return
      uiLang = l
      try {
        localStorage.setItem(UI_LANG_KEY, l)
      } catch {}
    }

    // 中文基准字典（回退源）
    var I18N_ZH = {
      title: '模型选择',
      searchPlaceholder: '搜索模型名称、提供商或推理模式...',
      sortSmart: '综合跑分最高',
      sortTtft: '首字响应最快 (TTFT)',
      sortTps: '生成吞吐最高 (TPS)',
      sortDefault: '默认排序',
      probeFast: '测速 ×1 快速',
      probeStable: '测速 ×3 稳定',
      probeFastTip: '单次测速：最快，但存在约 17-22% 的随机波动',
      probeStableTip: '三次测速取中位数：结果更稳定，但耗时与额度约为 3 倍',
      batchStop: '停止测速 ({0} 进行中)',
      batchConfirm: '再次点击确认 ({0})',
      batchProbe: '测速 ({0})',
      batchStopTitle: '停止当前批量测速',
      batchTip: '对「{0}」的 {1} 款模型逐个发起真实流式请求（每个约 3-6 秒，超时上限 20s，并发 2）',
      batchTestingPill: '测速中 {0}',
      batchTestingTitle: '批量测速进行中，点击可查看进度',
      smartPick: '优选 · {0}',
      smartTag: '智能优选',
      apply: '选用',
      scopeAll: '全局',
      scopeSearch: '搜索结果',
      clearAll: '清除测速',
      confirmClearAll: '确认清除全部',
      cancel: '取消',
      clearAllTitle: '删除全部已保存的测速记录（包括失败记录）',
      confirmClearTitle: '确认清除全部测速记录（不可撤销）',
      clearConfirmTip: '再次点击才会真正清除，6 秒后自动取消',
      clearedToast: '已清除全部测速数据',
      clearFailedToast: '清除失败，请稍后重试',
      clearRowTitle: '清除该模型的测速记录',
      clearRowAria: '清除 {0} 的测速记录',
      closeTitle: '关闭 (Esc)',
      close: '关闭',
      themeToLight: '当前：明亮主题，点击切换到暗黑',
      themeToDark: '当前：暗黑主题，点击切换到明亮',
      langTitle: '界面语言',
      tabAll: '全部',
      tabAllBadge: '全部',
      groupAllModels: '全部模型',
      scopeGroup: '「{0}」',
      boardName: 'TOP100',
      boardBtnTitle: '全球百强榜（Top 100，纯展示，点击行可搜索本机同名渠道）',
      scrollLeft: '向左滚动',
      scrollRight: '向右滚动',
      loadingCatalog: '正在加载渠道与模型目录…（DSH 刚启动时渠道初始化约需数秒）',
      retryLoad: '重试加载',
      backendEmpty1: '后端已连接，但当前没有返回任何模型渠道。',
      backendEmpty2: '若 DSH 刚重启，渠道可能仍在初始化；也请检查各渠道账号是否已登录。',
      groupEmpty: '当前分组暂无模型',
      searchBanner: '检索 “{0}”，匹配到 {1} 款模型',
      noMatch: '未找到与 “{0}” 匹配的模型',
      clearSearch: '清空',
      untested: '未测速',
      testing: '测速中',
      probeBtn: '测速',
      reasonTimeout: '响应超时',
      reasonUnreachable: '服务不可达',
      reasonForbidden: '访问受限',
      reasonQuota: '额度不足',
      reasonNoKey: '未配密钥',
      reasonNotReady: '未就绪',
      reasonEmpty: '空响应',
      reasonFail: '测速失败',
      estimate: ' (估算)',
      estimateLegacyTitle: '旧版本生成的估算值（非真实测量），重启 DSH 后将被自动清除',
      medianTip: '{0} 次取中位数，TTFT 波动 {1} ms',
      measuredAt: '测于 {0}',
      agoMinutes: '{0} 分钟前',
      agoHours: '{0} 小时前',
      agoDays: '{0} 天前',
      agoLong: '30 天以前',
      justNow: '刚刚',
      showAll: '显示全部',
      loadMore: '加载更多（已显示 {0} / {1}）',
      collapse: '收起列表（回到前 {0} 条）',
      reasoningTagTip: '支持推理（档位请在输入框的推理等级菜单中调整）',
      unknownProvider: '未知渠道',
      unnamedModel: '未命名模型',
      selectModel: '选择模型',
      selectModelAria: '请选择模型',
      fallbackTitle: '模型选择大师 —— 原生模型按钮被其它插件占用时的备用入口',
      boundaryError: '模型选择器加载失败：{0}\n点击重试',
      navHint: '导航',
      pickHint: '选用模型',
      closeHint: '关闭',
      tabHint: '循环焦点',
      boardHeader: '{0} 款有实测分数的模型 · 点击行即可在本机搜索同名渠道',
      boardEmptyHeader: '暂无榜单数据，点击右侧同步',
      boardSync: '同步最新榜单',
      boardSyncing: '同步中…',
      boardEmpty: '暂无榜单数据。点击「同步最新榜单」从 OpenRouter 拉取真实评测数据。',
      boardSource: '数据来源：',
      boardStale: ' · 已超过 24 小时未更新，建议点击右侧同步',
      boardUpdated: ' · 更新于 {0}',
      boardAge: '（{0}）',
      searchLocal: '搜本机',
      searchLocalTip: '在本机模型列表中搜索同名模型',
      rowClickTip: '点击行：在本机模型中搜索同名渠道',
      rowAria: '第 {0} 名 {1}，激活可在本机搜索同名模型',
      intMetric: '智能 {0}',
      tipVendor: '厂商: {0}',
      tipInt: '智能指数: {0}',
      tipCoding: '代码指数: {0}',
      tipAgentic: 'Agent 指数: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: '上下文: {0}',
      tipPrice: '价格: {0} / {1} 每百万 token',
      switchedTo: '已切换至: {0}',
      switchedBest: '已选用 [{0}] 最佳: {1}',
      switchedBestNode: '已切换至最优节点: {0}',
      noTestData: '「{0}」暂无测速数据，请先测速！',
      searchedLocal: '已在本机搜索「{0}」，请在结果中自行挑选渠道',
      syncedOk: '已从 OpenRouter 同步最新榜单数据',
      syncedFail: '同步失败：无法访问 OpenRouter，当前显示缓存数据',
      switchFail: '切换失败: {0}',
      switchError: '切换出错: {0}',
      sessionLocked: '当前会话不可切换模型',
      channelNotReady: '通道未就绪',
      batchDone: '批量测速完成：成功 {0} · 失败 {1}',
      batchAborted: '（已手动停止）',
      batchDedupeNote: '；同名多渠道仅测首个，其余可单独测速',
      probeUnreachable: '测速服务不可达：请确认 DSH 正在运行且从本机访问',
      probe403: '插件后端仅允许本机访问（403）',
      catalog403: '目录加载失败：插件后端仅允许本机访问（403），请从 127.0.0.1 打开 DSH',
      catalogHttp: '目录加载失败（HTTP {0}）',
      catalogUnreachable: '目录加载失败：无法连接插件后端（DSH 正在运行吗？）',
      seatToastOk: '已成功切换模型至「{0}」{1}',
      subtitle: '· {0} 个渠道 · {1} 款模型',
      catalogLoadingSub: '· 目录加载中…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter 模型目录 · Artificial Analysis 指数 + Design Arena Elo（每日同步）',
      boardSourceOffline: 'OpenRouter 模型目录（离线，无可用榜单数据）',
      boardSourcePending: '尚无数据 · 等待首次同步（OpenRouter 模型目录）',
      boardSourceAATip: '打开 Artificial Analysis 官方排行榜 —— 智能/代码/Agent 指数的原始出处，可直接对照本榜单',
      boardSourceDATip: '打开 Design Arena 官方排行榜 —— Elo 盲测分的原始出处'
    }

    var I18N = { zh: I18N_ZH }

    I18N.en = {
      title: 'Select Model',
      searchPlaceholder: 'Search models, providers or reasoning mode...',
      sortSmart: 'Top composite score',
      sortTtft: 'Fastest first token (TTFT)',
      sortTps: 'Highest throughput (TPS)',
      sortDefault: 'Default order',
      probeFast: 'Probe ×1 fast',
      probeStable: 'Probe ×3 stable',
      probeFastTip: 'Single probe: fastest, but ~17-22% random variance',
      probeStableTip: 'Median of three probes: stabler, ~3× time and quota',
      batchStop: 'Stop ({0} running)',
      batchConfirm: 'Click again to confirm ({0})',
      batchProbe: 'Probe ({0})',
      batchStopTitle: 'Stop the running batch probe',
      batchTip: 'Stream-probe {1} models of "{0}" one by one (~3-6s each, 20s timeout, 2 concurrent)',
      batchTestingPill: 'Probing {0}',
      batchTestingTitle: 'Batch probe running, click to view',
      smartPick: 'Best · {0}',
      smartTag: 'Smart Pick',
      apply: 'Apply',
      scopeAll: 'Global',
      scopeSearch: 'search results',
      clearAll: 'Clear results',
      confirmClearAll: 'Confirm clear all',
      cancel: 'Cancel',
      clearAllTitle: 'Delete all saved probe results (including failures)',
      confirmClearTitle: 'Confirm clearing ALL probe results (irreversible)',
      clearConfirmTip: 'Click again to actually clear; auto-cancels in 6s',
      clearedToast: 'All probe results cleared',
      clearFailedToast: 'Clear failed, try again later',
      clearRowTitle: "Clear this model's probe result",
      clearRowAria: 'Clear probe result of {0}',
      closeTitle: 'Close (Esc)',
      close: 'Close',
      themeToLight: 'Light theme — click for dark',
      themeToDark: 'Dark theme — click for light',
      langTitle: 'UI language',
      tabAll: 'All',
      tabAllBadge: 'All',
      groupAllModels: 'All models',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'Global Top 100 (display-only; click a row to search local channels)',
      scrollLeft: 'Scroll left',
      scrollRight: 'Scroll right',
      loadingCatalog: 'Loading providers & models… (providers take seconds after a DSH start)',
      retryLoad: 'Retry',
      backendEmpty1: 'Backend reachable, but no model providers returned.',
      backendEmpty2: 'If DSH just restarted, providers may still be initializing; check provider logins too.',
      groupEmpty: 'No models in this group',
      searchBanner: 'Search \"{0}\" — {1} models matched',
      noMatch: 'No models match \"{0}\"',
      clearSearch: 'Clear',
      untested: 'Untested',
      testing: 'Probing',
      probeBtn: 'Probe',
      reasonTimeout: 'Timeout',
      reasonUnreachable: 'Unreachable',
      reasonForbidden: 'Forbidden',
      reasonQuota: 'Quota',
      reasonNoKey: 'No key',
      reasonNotReady: 'Not ready',
      reasonEmpty: 'Empty reply',
      reasonFail: 'Probe failed',
      estimate: ' (est.)',
      estimateLegacyTitle: 'Legacy estimate (not measured); auto-purged after DSH restart',
      medianTip: 'Median of {0} runs, TTFT spread {1} ms',
      measuredAt: 'measured {0}',
      agoMinutes: '{0} min ago',
      agoHours: '{0} h ago',
      agoDays: '{0} d ago',
      agoLong: 'over 30 days ago',
      justNow: 'just now',
      showAll: 'Show all',
      loadMore: 'Load more ({0} / {1} shown)',
      collapse: 'Collapse (back to first {0})',
      reasoningTagTip: 'Supports reasoning (adjust the level in the composer reasoning menu)',
      unknownProvider: 'Unknown provider',
      unnamedModel: 'Unnamed model',
      selectModel: 'Select model',
      selectModelAria: 'Choose a model',
      fallbackTitle: 'Model Master — fallback entry while another plugin occupies the native model button',
      boundaryError: 'Model Master failed to load: {0}\nClick to retry',
      navHint: 'navigate',
      pickHint: 'select model',
      closeHint: 'close',
      tabHint: 'cycle focus',
      boardHeader: '{0} models with real scores · click a row to search local channels',
      boardEmptyHeader: 'No leaderboard data — sync on the right',
      boardSync: 'Sync latest board',
      boardSyncing: 'Syncing…',
      boardEmpty: 'No leaderboard data. Click "Sync latest board" to fetch real scores from OpenRouter.',
      boardSource: 'Source: ',
      boardStale: ' · older than 24h — consider syncing',
      boardUpdated: ' · updated {0}',
      boardAge: ' ({0})',
      searchLocal: 'Find local',
      searchLocalTip: 'Search local model list for the same name',
      rowClickTip: 'Click row: search local channels with the same name',
      rowAria: 'No.{0} {1} — activate to search local models',
      intMetric: 'Int {0}',
      tipVendor: 'Vendor: {0}',
      tipInt: 'Intelligence: {0}',
      tipCoding: 'Coding: {0}',
      tipAgentic: 'Agentic: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Context: {0}',
      tipPrice: 'Price: {0} / {1} per M tokens',
      switchedTo: 'Switched to: {0}',
      switchedBest: 'Applied best of [{0}]: {1}',
      switchedBestNode: 'Switched to best node: {0}',
      noTestData: '"{0}" has no probe data yet — probe first!',
      searchedLocal: 'Searched local for "{0}" — pick a channel yourself',
      syncedOk: 'Leaderboard synced from OpenRouter',
      syncedFail: 'Sync failed: OpenRouter unreachable, showing cache',
      switchFail: 'Switch failed: {0}',
      switchError: 'Switch error: {0}',
      sessionLocked: 'Cannot switch models in this session',
      channelNotReady: 'channel not ready',
      batchDone: 'Batch probe done: {0} ok · {1} failed',
      batchAborted: ' (stopped)',
      batchDedupeNote: '; same-name multi-channel probes only the first',
      probeUnreachable: 'Probe service unreachable: confirm DSH is running and accessed locally',
      probe403: 'Plugin backend allows local access only (403)',
      catalog403: 'Catalog failed: backend is local-only (403). Open DSH from 127.0.0.1',
      catalogHttp: 'Catalog failed (HTTP {0})',
      catalogUnreachable: 'Catalog failed: cannot reach the plugin backend (is DSH running?)',
      seatToastOk: 'Switched to \"{0}\" {1}',
      subtitle: '· {0} channels · {1} models',
      catalogLoadingSub: '· loading catalog…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter model catalogue · Artificial Analysis indices + Design Arena Elo (daily sync)',
      boardSourceOffline: 'OpenRouter model catalogue (offline — no scored data available)',
      boardSourcePending: 'No data yet · waiting for the first sync (OpenRouter model catalogue)',
      boardSourceAATip:
        'Open the official Artificial Analysis leaderboard — original source of the intelligence/coding/agentic indices',
      boardSourceDATip: 'Open the official Design Arena leaderboard — original source of the blind-test Elo'
    }

    I18N.ja = {
      title: 'モデル選択',
      searchPlaceholder: 'モデル / プロバイダー / 推理モードを検索...',
      sortSmart: '総合スコア順',
      sortTtft: '初トークン最速 (TTFT)',
      sortTps: 'スループット順 (TPS)',
      sortDefault: 'デフォルト順',
      probeFast: '計測 ×1 高速',
      probeStable: '計測 ×3 安定',
      probeFastTip: '単発：最速だが約17-22%のばらつき',
      probeStableTip: '3回の中央値：安定だが時間と_quotaは約3倍',
      batchStop: '停止 ({0} 実行中)',
      batchConfirm: 'もう一度クリックで確認 ({0})',
      batchProbe: '計測 ({0})',
      batchStopTitle: '一括計測を停止',
      batchTip: '「{0}」の{1}モデルを順にストリーム計測（各3-6秒、タイムアウト20秒、同時2）',
      batchTestingPill: '計測中 {0}',
      batchTestingTitle: '一括計測が進行中',
      smartPick: '最速 · {0}',
      smartTag: 'スマート選択',
      apply: '適用',
      scopeAll: '全体',
      scopeSearch: '検索結果',
      clearAll: '計測結果を削除',
      confirmClearAll: '全件削除を確認',
      cancel: 'キャンセル',
      clearAllTitle: '保存済み計測結果をすべて削除（失敗含む）',
      confirmClearTitle: '全計測結果の削除を確認（元に戻せません）',
      clearConfirmTip: 'もう一度クリックで実行、6秒で自動キャンセル',
      clearedToast: '計測結果を全削除しました',
      clearFailedToast: '削除に失敗しました',
      clearRowTitle: 'このモデルの計測結果を削除',
      clearRowAria: '{0} の計測結果を削除',
      closeTitle: '閉じる (Esc)',
      close: '閉じる',
      themeToLight: '現在ライト、クリックでダークへ',
      themeToDark: '現在ダーク、クリックでライトへ',
      langTitle: '表示言語',
      tabAll: 'すべて',
      tabAllBadge: 'すべて',
      groupAllModels: '全モデル',
      scopeGroup: '「{0}」',
      boardName: 'TOP100',
      boardBtnTitle: '世界トップ100（表示専用、行クリックでローカル検索）',
      scrollLeft: '左へスクロール',
      scrollRight: '右へスクロール',
      loadingCatalog: 'プロバイダーとモデル一覧を読み込み中…（DSH起動直後は数秒かかります）',
      retryLoad: '再試行',
      backendEmpty1: 'バックエンドに接続しましたが、プロバイダーが返ってきません。',
      backendEmpty2: 'DSH再起動直後は初期化中の可能性があります。各プロバイダーのログインも確認してください。',
      groupEmpty: 'このグループにモデルはありません',
      searchBanner: '「{0}」を検索 — {1}件一致',
      noMatch: '「{0}」に一致するモデルはありません',
      clearSearch: 'クリア',
      untested: '未計測',
      testing: '計測中',
      probeBtn: '計測',
      reasonTimeout: 'タイムアウト',
      reasonUnreachable: '到達不能',
      reasonForbidden: 'アクセス制限',
      reasonQuota: 'quota不足',
      reasonNoKey: 'キー未設定',
      reasonNotReady: '準備中',
      reasonEmpty: '空の応答',
      reasonFail: '計測失敗',
      estimate: ' (推定)',
      estimateLegacyTitle: '旧バージョンの推定値（実測ではない）。DSH再起動後に自動削除',
      medianTip: '{0}回の中央値、TTFTぶれ {1}ms',
      measuredAt: '計測 {0}',
      agoMinutes: '{0}分前',
      agoHours: '{0}時間前',
      agoDays: '{0}日前',
      agoLong: '30日以上前',
      justNow: 'たった今',
      showAll: 'すべて表示',
      loadMore: 'さらに表示（{0} / {1}）',
      collapse: '折りたたむ（先頭{0}件へ）',
      reasoningTagTip: '推論対応（レベルは入力欄の推理等級メニューで調整）',
      unknownProvider: '不明なプロバイダー',
      unnamedModel: '名称未設定モデル',
      selectModel: 'モデルを選択',
      selectModelAria: 'モデルを選択してください',
      fallbackTitle: 'Model Master — ネイティブボタンが他プラグインに占拠された場合の代替入口',
      boundaryError: 'Model Master の読み込みに失敗: {0}\nクリックで再試行',
      navHint: '移動',
      pickHint: 'モデル決定',
      closeHint: '閉じる',
      tabHint: 'フォーカス移動',
      boardHeader: '実スコア付き {0} モデル · 行クリックでローカル検索',
      boardEmptyHeader: 'ランキングなし — 右から同期',
      boardSync: '最新を同期',
      boardSyncing: '同期中…',
      boardEmpty: 'データがありません。「最新を同期」でOpenRouterから取得してください。',
      boardSource: 'ソース: ',
      boardStale: ' · 24時間以上未更新 — 同期を推奨',
      boardUpdated: ' · 更新 {0}',
      boardAge: ' ({0})',
      searchLocal: 'ローカル検索',
      searchLocalTip: '同名のローカルモデルを検索',
      rowClickTip: '行クリック：同名のローカルチャネルを検索',
      rowAria: '{0}位 {1} — 有効化でローカルを検索',
      intMetric: '知能 {0}',
      tipVendor: 'ベンダー: {0}',
      tipInt: '知能指数: {0}',
      tipCoding: 'コーディング: {0}',
      tipAgentic: 'エージェント: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'コンテキスト: {0}',
      tipPrice: '価格: {0} / {1}（100万トークンあたり）',
      switchedTo: '切り替え: {0}',
      switchedBest: '[{0}] の最速を適用: {1}',
      switchedBestNode: '最速ノードへ切替: {0}',
      noTestData: '「{0}」の計測データがありません。先に計測してください！',
      searchedLocal: '「{0}」をローカル検索しました。チャネルを選んでください',
      syncedOk: 'OpenRouterからランキングを同期しました',
      syncedFail: '同期失敗：OpenRouterに接続できず、キャッシュを表示',
      switchFail: '切替失敗: {0}',
      switchError: '切替エラー: {0}',
      sessionLocked: 'このセッションではモデルを切替できません',
      channelNotReady: 'チャネル未準備',
      batchDone: '一括計測完了：成功 {0} · 失敗 {1}',
      batchAborted: '（手動停止）',
      batchDedupeNote: '；同名の複数チャネルは最初の1つのみ計測',
      probeUnreachable: '計測サービスに接続できません。DSHの起動とローカルアクセスを確認してください',
      probe403: 'プラグインバックエンドはローカルのみ許可 (403)',
      catalog403: '一覧取得失敗：バックエンドはローカル限定 (403)。127.0.0.1から開いてください',
      catalogHttp: '一覧取得失敗 (HTTP {0})',
      catalogUnreachable: '一覧取得失敗：プラグインバックエンドに接続できません（DSHは起動中？）',
      seatToastOk: '「{0}」へ切替しました {1}',
      subtitle: '· {0} チャネル · {1} モデル',
      catalogLoadingSub: '· 一覧を読み込み中…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter モデルカタログ · Artificial Analysis 指数 + Design Arena Elo（毎日同期）',
      boardSourceOffline: 'OpenRouter モデルカタログ（オフライン — 利用可能な評価データなし）',
      boardSourcePending: 'データなし · 初回同期を待機中（OpenRouter モデルカタログ）',
      boardSourceAATip: 'Artificial Analysis 公式リーダーボードを開く — 知能/コーディング/エージェント指数の原典',
      boardSourceDATip: 'Design Arena 公式リーダーボードを開く — Elo ブラインドテストの原典'
    }

    I18N.ko = {
      title: '모델 선택',
      searchPlaceholder: '모델 / 제공자 / 추론 모드 검색...',
      sortSmart: '종합 점수순',
      sortTtft: '첫 토큰 최속 (TTFT)',
      sortTps: '처리량순 (TPS)',
      sortDefault: '기본 순서',
      probeFast: '측정 ×1 빠름',
      probeStable: '측정 ×3 안정',
      probeFastTip: '단발: 빠르지만 약 17-22% 편차',
      probeStableTip: '3회 중앙값: 안정적, 시간·한도 약 3배',
      batchStop: '중지 ({0} 진행)',
      batchConfirm: '다시 클릭해 확인 ({0})',
      batchProbe: '측정 ({0})',
      batchStopTitle: '일괄 측정 중지',
      batchTip: '\"{0}\"의 {1}개 모델을 순차 스트림 측정 (각 3-6초, 타임아웃 20초, 동시 2)',
      batchTestingPill: '측정중 {0}',
      batchTestingTitle: '일괄 측정 진행 중',
      smartPick: '최적 · {0}',
      smartTag: '스마트 선택',
      apply: '적용',
      scopeAll: '전체',
      scopeSearch: '검색 결과',
      clearAll: '측정 기록 삭제',
      confirmClearAll: '전체 삭제 확인',
      cancel: '취소',
      clearAllTitle: '저장된 측정 기록 전체 삭제 (실패 포함)',
      confirmClearTitle: '모든 측정 기록 삭제 확인 (되돌릴 수 없음)',
      clearConfirmTip: '다시 클릭하면 실제 삭제, 6초 후 자동 취소',
      clearedToast: '측정 기록을 모두 삭제했습니다',
      clearFailedToast: '삭제 실패, 다시 시도하세요',
      clearRowTitle: '이 모델의 측정 기록 삭제',
      clearRowAria: '{0}의 측정 기록 삭제',
      closeTitle: '닫기 (Esc)',
      close: '닫기',
      themeToLight: '현재 라이트, 클릭 시 다크',
      themeToDark: '현재 다크, 클릭 시 라이트',
      langTitle: 'UI 언어',
      tabAll: '전체',
      tabAllBadge: '전체',
      groupAllModels: '전체 모델',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: '글로벌 톱100 (표시 전용, 행 클릭으로 로컬 검색)',
      scrollLeft: '왼쪽 스크롤',
      scrollRight: '오른쪽 스크롤',
      loadingCatalog: '제공자·모델 목록 로딩 중… (DSH 시작 직후 몇 초 소요)',
      retryLoad: '재시도',
      backendEmpty1: '백엔드 연결됨, 그러나 제공자가 없습니다.',
      backendEmpty2: 'DSH 재시작 직후라면 초기화 중일 수 있습니다. 각 제공자 로그인도 확인하세요.',
      groupEmpty: '이 그룹에 모델이 없습니다',
      searchBanner: '\"{0}\" 검색 — {1}개 일치',
      noMatch: '\"{0}\"와 일치하는 모델 없음',
      clearSearch: '지우기',
      untested: '미측정',
      testing: '측정중',
      probeBtn: '측정',
      reasonTimeout: '시간초과',
      reasonUnreachable: '접근불가',
      reasonForbidden: '접근제한',
      reasonQuota: '한도초과',
      reasonNoKey: '키 없음',
      reasonNotReady: '준비중',
      reasonEmpty: '빈 응답',
      reasonFail: '측정 실패',
      estimate: ' (추정)',
      estimateLegacyTitle: '구버전 추정값(실측 아님), DSH 재시작 후 자동 삭제',
      medianTip: '{0}회 중앙값, TTFT 편차 {1}ms',
      measuredAt: '측정 {0}',
      agoMinutes: '{0}분 전',
      agoHours: '{0}시간 전',
      agoDays: '{0}일 전',
      agoLong: '30일 이상 전',
      justNow: '방금',
      showAll: '모두 표시',
      loadMore: '더 보기 ({0} / {1})',
      collapse: '접기 (처음 {0}개로)',
      reasoningTagTip: '추론 지원 (단계는 입력창의 추론 메뉴에서 조정)',
      unknownProvider: '알 수 없는 제공자',
      unnamedModel: '이름 없는 모델',
      selectModel: '모델 선택',
      selectModelAria: '모델을 선택하세요',
      fallbackTitle: 'Model Master — 네이티브 버튼이 다른 플러그인에 점유된 경우의 대체 진입',
      boundaryError: 'Model Master 로드 실패: {0}\n클릭해서 재시도',
      navHint: '이동',
      pickHint: '모델 선택',
      closeHint: '닫기',
      tabHint: '포커스 순환',
      boardHeader: '실측 점수 {0}개 모델 · 행 클릭으로 로컬 검색',
      boardEmptyHeader: '순위 데이터 없음 — 오른쪽에서 동기화',
      boardSync: '최신 동기화',
      boardSyncing: '동기화 중…',
      boardEmpty: '데이터가 없습니다. "최신 동기화"를 눌러 OpenRouter에서 가져오세요.',
      boardSource: '출처: ',
      boardStale: ' · 24시간 이상 미갱신 — 동기화 권장',
      boardUpdated: ' · 갱신 {0}',
      boardAge: ' ({0})',
      searchLocal: '로컬 검색',
      searchLocalTip: '같은 이름의 로컬 모델 검색',
      rowClickTip: '행 클릭: 동명 로컬 채널 검색',
      rowAria: '{0}위 {1} — 활성화하면 로컬 검색',
      intMetric: '지능 {0}',
      tipVendor: '벤더: {0}',
      tipInt: '지능 지수: {0}',
      tipCoding: '코딩: {0}',
      tipAgentic: '에이전트: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: '컨텍스트: {0}',
      tipPrice: '가격: {0} / {1} (백만 토큰당)',
      switchedTo: '전환됨: {0}',
      switchedBest: '[{0}] 최적 적용: {1}',
      switchedBestNode: '최속 노드로 전환: {0}',
      noTestData: '"{0}"의 측정 데이터가 없습니다. 먼저 측정하세요!',
      searchedLocal: '"{0}"을(를) 로컬 검색했습니다. 채널을 직접 선택하세요',
      syncedOk: 'OpenRouter에서 순위 동기화 완료',
      syncedFail: '동기화 실패: OpenRouter 접근 불가, 캐시 표시',
      switchFail: '전환 실패: {0}',
      switchError: '전환 오류: {0}',
      sessionLocked: '이 세션에서는 모델을 전환할 수 없습니다',
      channelNotReady: '채널 미준비',
      batchDone: '일괄 측정 완료: 성공 {0} · 실패 {1}',
      batchAborted: ' (수동 중지)',
      batchDedupeNote: '; 동명 다채널은 첫 번째만 측정',
      probeUnreachable: '측정 서비스 접근 불가: DSH 실행 및 로컬 접근을 확인하세요',
      probe403: '플러그인 백엔드는 로컬 전용 (403)',
      catalog403: '목록 실패: 백엔드는 로컬 전용 (403). 127.0.0.1에서 여세요',
      catalogHttp: '목록 실패 (HTTP {0})',
      catalogUnreachable: '목록 실패: 플러그인 백엔드에 접근할 수 없습니다 (DSH 실행 중?)',
      seatToastOk: '\"{0}\"(으)로 전환 {1}',
      subtitle: '· {0}개 채널 · {1}개 모델',
      catalogLoadingSub: '· 목록 로딩 중…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter 모델 카탈로그 · Artificial Analysis 지수 + Design Arena Elo (매일 동기화)',
      boardSourceOffline: 'OpenRouter 모델 카탈로그 (오프라인 — 사용 가능한 평가 데이터 없음)',
      boardSourcePending: '데이터 없음 · 최초 동기화 대기 중 (OpenRouter 모델 카탈로그)',
      boardSourceAATip: 'Artificial Analysis 공식 리더보드 열기 — 지능/코딩/에이전트 지수의 원출처',
      boardSourceDATip: 'Design Arena 공식 리더보드 열기 — Elo 블라인드 테스트의 원출처'
    }

    I18N.de = {
      title: 'Modell wählen',
      searchPlaceholder: 'Modelle, Anbieter oder Denkmodus suchen...',
      sortSmart: 'Beste Gesamtwertung',
      sortTtft: 'Schnellstes Ersttoken (TTFT)',
      sortTps: 'Höchster Durchsatz (TPS)',
      sortDefault: 'Standardreihenfolge',
      probeFast: 'Test ×1 schnell',
      probeStable: 'Test ×3 stabil',
      probeFastTip: 'Einzelmessung: am schnellsten, ~17-22% Streuung',
      probeStableTip: 'Median von dreien: stabiler, ~3× Zeit/Kontingent',
      batchStop: 'Stopp ({0} aktiv)',
      batchConfirm: 'Erneut klicken zum Bestätigen ({0})',
      batchProbe: 'Test ({0})',
      batchStopTitle: 'Laufenden Serientest stoppen',
      batchTip: '{1} Modelle von „{0}" nacheinander streamen (~3-6s je, 20s Timeout, 2 parallel)',
      batchTestingPill: 'Testet {0}',
      batchTestingTitle: 'Serientest läuft',
      smartPick: 'Bester · {0}',
      smartTag: 'Smart-Wahl',
      apply: 'Anwenden',
      scopeAll: 'Global',
      scopeSearch: 'Suchergebnisse',
      clearAll: 'Ergebnisse löschen',
      confirmClearAll: 'Alles löschen bestätigen',
      cancel: 'Abbrechen',
      clearAllTitle: 'Alle gespeicherten Messergebnisse löschen (inkl. Fehler)',
      confirmClearTitle: 'Löschen ALLER Messergebnisse bestätigen (unumkehrbar)',
      clearConfirmTip: 'Erneut klicken zum Löschen; Abbruch nach 6s',
      clearedToast: 'Alle Messergebnisse gelöscht',
      clearFailedToast: 'Löschen fehlgeschlagen',
      clearRowTitle: 'Messergebnis dieses Modells löschen',
      clearRowAria: 'Messergebnis von {0} löschen',
      closeTitle: 'Schließen (Esc)',
      close: 'Schließen',
      themeToLight: 'Hell aktiv — Klick für dunkel',
      themeToDark: 'Dunkel aktiv — Klick für hell',
      langTitle: 'Oberflächensprache',
      tabAll: 'Alle',
      tabAllBadge: 'Alle',
      groupAllModels: 'Alle Modelle',
      scopeGroup: '„{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'Welt-Top 100 (nur Ansicht; Zeile klicken für lokale Suche)',
      scrollLeft: 'Nach links',
      scrollRight: 'Nach rechts',
      loadingCatalog: 'Anbieter & Modelle werden geladen… (nach DSH-Start einige Sekunden)',
      retryLoad: 'Erneut',
      backendEmpty1: 'Backend erreichbar, aber keine Anbieter zurückgegeben.',
      backendEmpty2: 'Nach DSH-Neustart ggf. noch Initialisierung; auch Anbieter-Logins prüfen.',
      groupEmpty: 'Keine Modelle in dieser Gruppe',
      searchBanner: '„{0}\" gesucht — {1} Treffer',
      noMatch: 'Keine Modelle für „{0}\"',
      clearSearch: 'Leeren',
      untested: 'Ungetestet',
      testing: 'Testet',
      probeBtn: 'Test',
      reasonTimeout: 'Timeout',
      reasonUnreachable: 'Nicht erreichbar',
      reasonForbidden: 'Gesperrt',
      reasonQuota: 'Kontingent',
      reasonNoKey: 'Kein Key',
      reasonNotReady: 'Nicht bereit',
      reasonEmpty: 'Leere Antwort',
      reasonFail: 'Test fehlgeschlagen',
      estimate: ' (geschätzt)',
      estimateLegacyTitle: 'Alte Schätzung (nicht gemessen); nach DSH-Neustart automatisch entfernt',
      medianTip: 'Median aus {0}, TTFT-Streuung {1} ms',
      measuredAt: 'gemessen {0}',
      agoMinutes: 'vor {0} Min.',
      agoHours: 'vor {0} Std.',
      agoDays: 'vor {0} Tg.',
      agoLong: 'vor über 30 Tagen',
      justNow: 'gerade eben',
      showAll: 'Alle zeigen',
      loadMore: 'Mehr laden ({0} / {1})',
      collapse: 'Einklappen (erste {0})',
      reasoningTagTip: 'Reasoning-fähig (Stufe im Denkmodus-Menü des Eingabefelds)',
      unknownProvider: 'Unbekannter Anbieter',
      unnamedModel: 'Unbenanntes Modell',
      selectModel: 'Modell wählen',
      selectModelAria: 'Modell auswählen',
      fallbackTitle: 'Model Master — Ersatzeingriff, solange ein anderes Plugin den nativen Knopf belegt',
      boundaryError: 'Model Master konnte nicht geladen werden: {0}\nZum Wiederholen klicken',
      navHint: 'navigieren',
      pickHint: 'Modell wählen',
      closeHint: 'schließen',
      tabHint: 'Fokus rotieren',
      boardHeader: '{0} Modelle mit echten Werten · Zeile klicken = lokal suchen',
      boardEmptyHeader: 'Keine Ranking-Daten — rechts synchronisieren',
      boardSync: 'Neueste laden',
      boardSyncing: 'Läuft…',
      boardEmpty: 'Keine Daten. „Neueste laden" holt echte Werte von OpenRouter.',
      boardSource: 'Quelle: ',
      boardStale: ' · älter als 24h — Sync empfohlen',
      boardUpdated: ' · aktualisiert {0}',
      boardAge: ' ({0})',
      searchLocal: 'Lokal suchen',
      searchLocalTip: 'Lokale Modellliste nach gleichem Namen durchsuchen',
      rowClickTip: 'Zeile klicken: gleichnamige lokale Kanäle suchen',
      rowAria: 'Nr. {0} {1} — aktivieren für lokale Suche',
      intMetric: 'Int {0}',
      tipVendor: 'Anbieter: {0}',
      tipInt: 'Intelligenz: {0}',
      tipCoding: 'Coding: {0}',
      tipAgentic: 'Agentic: {0}',
      tipArena: 'Arena-Elo: {0}{1}',
      tipContext: 'Kontext: {0}',
      tipPrice: 'Preis: {0} / {1} je Mio. Tokens',
      switchedTo: 'Gewechselt zu: {0}',
      switchedBest: 'Bester von [{0}]: {1}',
      switchedBestNode: 'Bester Knoten: {0}',
      noTestData: '„{0}" hat noch keine Messdaten — erst testen!',
      searchedLocal: '„{0}" lokal gesucht — Kanal bitte selbst wählen',
      syncedOk: 'Ranking von OpenRouter synchronisiert',
      syncedFail: 'Sync fehlgeschlagen: OpenRouter unerreichbar, Cache angezeigt',
      switchFail: 'Wechsel fehlgeschlagen: {0}',
      switchError: 'Wechselfehler: {0}',
      sessionLocked: 'Modellwechsel in dieser Sitzung nicht möglich',
      channelNotReady: 'Kanal nicht bereit',
      batchDone: 'Serientest fertig: {0} ok · {1} Fehler',
      batchAborted: ' (gestoppt)',
      batchDedupeNote: '; gleiche Namen werden nur einmal gemessen',
      probeUnreachable: 'Testdienst unerreichbar: DSH läuft und lokaler Zugriff?',
      probe403: 'Plugin-Backend erlaubt nur lokal (403)',
      catalog403: 'Katalog fehlgeschlagen: Backend nur lokal (403). DSH von 127.0.0.1 öffnen',
      catalogHttp: 'Katalog fehlgeschlagen (HTTP {0})',
      catalogUnreachable: 'Katalog fehlgeschlagen: Plugin-Backend unerreichbar (läuft DSH?)',
      seatToastOk: 'Zu „{0}\" gewechselt {1}',
      subtitle: '· {0} Kanäle · {1} Modelle',
      catalogLoadingSub: '· Katalog lädt…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter-Modellkatalog · Artificial-Analysis-Indizes + Design-Arena-Elo (täglicher Abgleich)',
      boardSourceOffline: 'OpenRouter-Modellkatalog (offline — keine bewerteten Daten verfügbar)',
      boardSourcePending: 'Noch keine Daten · warte auf den ersten Abgleich (OpenRouter-Modellkatalog)',
      boardSourceAATip:
        'Offizielles Artificial-Analysis-Ranking öffnen — Originalquelle der Intelligenz-/Coding-/Agent-Indizes',
      boardSourceDATip: 'Offizielles Design-Arena-Ranking öffnen — Originalquelle des Blindtest-Elo'
    }

    I18N.fr = {
      title: 'Choisir un modèle',
      searchPlaceholder: 'Rechercher modèles, fournisseurs ou mode de raisonnement...',
      sortSmart: 'Meilleur score global',
      sortTtft: 'Premier token le plus rapide (TTFT)',
      sortTps: 'Débit max (TPS)',
      sortDefault: 'Ordre par défaut',
      probeFast: 'Test ×1 rapide',
      probeStable: 'Test ×3 stable',
      probeFastTip: 'Unique : le plus rapide, ~17-22% de variance',
      probeStableTip: 'Médiane de trois : plus stable, ~3× temps et quota',
      batchStop: 'Arrêter ({0} en cours)',
      batchConfirm: 'Recliquez pour confirmer ({0})',
      batchProbe: 'Test ({0})',
      batchStopTitle: 'Arrêter le test par lot en cours',
      batchTip: 'Tester en flux {1} modèles de « {0} » (~3-6s chacun, timeout 20s, 2 en parallèle)',
      batchTestingPill: 'Test {0}',
      batchTestingTitle: 'Test par lot en cours',
      smartPick: 'Le meilleur · {0}',
      smartTag: 'Sélection intelligente',
      apply: 'Appliquer',
      scopeAll: 'Global',
      scopeSearch: 'résultats',
      clearAll: 'Effacer résultats',
      confirmClearAll: 'Confirmer tout effacer',
      cancel: 'Annuler',
      clearAllTitle: 'Supprimer tous les résultats enregistrés (échecs inclus)',
      confirmClearTitle: 'Confirmer la suppression de TOUT (irréversible)',
      clearConfirmTip: 'Recliquez pour effacer ; annulation auto après 6s',
      clearedToast: 'Tous les résultats ont été effacés',
      clearFailedToast: 'Échec de la suppression',
      clearRowTitle: 'Effacer le résultat de ce modèle',
      clearRowAria: 'Effacer le résultat de {0}',
      closeTitle: 'Fermer (Échap)',
      close: 'Fermer',
      themeToLight: 'Thème clair — cliquer pour sombre',
      themeToDark: 'Thème sombre — cliquer pour clair',
      langTitle: "Langue de l'interface",
      tabAll: 'Tous',
      tabAllBadge: 'Tous',
      groupAllModels: 'Tous les modèles',
      scopeGroup: '« {0} »',
      boardName: 'TOP100',
      boardBtnTitle: 'Top 100 mondial (affichage seul ; cliquer une ligne pour chercher en local)',
      scrollLeft: 'Défiler à gauche',
      scrollRight: 'Défiler à droite',
      loadingCatalog: 'Chargement des fournisseurs et modèles… (quelques secondes après un démarrage de DSH)',
      retryLoad: 'Réessayer',
      backendEmpty1: 'Backend joignable, mais aucun fournisseur renvoyé.',
      backendEmpty2: "Si DSH vient de redémarrer, les fournisseurs s'initialisent ; vérifiez aussi les connexions.",
      groupEmpty: 'Aucun modèle dans ce groupe',
      searchBanner: 'Recherche « {0} » — {1} modèles trouvés',
      noMatch: 'Aucun modèle pour « {0} »',
      clearSearch: 'Effacer',
      untested: 'Non testé',
      testing: 'Test…',
      probeBtn: 'Tester',
      reasonTimeout: 'Délai dépassé',
      reasonUnreachable: 'Injoignable',
      reasonForbidden: 'Accès refusé',
      reasonQuota: 'Quota',
      reasonNoKey: 'Pas de clé',
      reasonNotReady: 'Pas prêt',
      reasonEmpty: 'Réponse vide',
      reasonFail: 'Test échoué',
      estimate: ' (estimé)',
      estimateLegacyTitle: 'Ancienne estimation (non mesurée) ; purgée après redémarrage de DSH',
      medianTip: 'Médiane de {0}, dispersion TTFT {1} ms',
      measuredAt: 'mesuré {0}',
      agoMinutes: 'il y a {0} min',
      agoHours: 'il y a {0} h',
      agoDays: 'il y a {0} j',
      agoLong: 'il y a plus de 30 jours',
      justNow: "à l'instant",
      showAll: 'Tout afficher',
      loadMore: 'Charger plus ({0} / {1})',
      collapse: 'Replier (retour aux {0} premières)',
      reasoningTagTip: 'Raisonnement pris en charge (niveau dans le menu du champ de saisie)',
      unknownProvider: 'Fournisseur inconnu',
      unnamedModel: 'Modèle sans nom',
      selectModel: 'Choisir un modèle',
      selectModelAria: 'Veuillez choisir un modèle',
      fallbackTitle: 'Model Master — entrée de secours quand un autre plugin occupe le bouton natif',
      boundaryError: 'Échec du chargement de Model Master : {0}\nCliquer pour réessayer',
      navHint: 'naviguer',
      pickHint: 'choisir',
      closeHint: 'fermer',
      tabHint: 'cycle du focus',
      boardHeader: '{0} modèles avec scores réels · cliquer une ligne pour chercher en local',
      boardEmptyHeader: 'Pas de données — synchronisez à droite',
      boardSync: 'Synchroniser',
      boardSyncing: 'Synchro…',
      boardEmpty: 'Aucune donnée. Cliquez « Synchroniser » pour récupérer les scores OpenRouter.',
      boardSource: 'Source : ',
      boardStale: ' · plus de 24 h — synchronisation conseillée',
      boardUpdated: ' · mis à jour {0}',
      boardAge: ' ({0})',
      searchLocal: 'Chercher en local',
      searchLocalTip: 'Chercher le même nom dans les modèles locaux',
      rowClickTip: 'Clic de ligne : chercher les canaux locaux du même nom',
      rowAria: 'N°{0} {1} — activer pour chercher en local',
      intMetric: 'Int {0}',
      tipVendor: 'Fournisseur : {0}',
      tipInt: 'Intelligence : {0}',
      tipCoding: 'Code : {0}',
      tipAgentic: 'Agent : {0}',
      tipArena: 'Arena Elo : {0}{1}',
      tipContext: 'Contexte : {0}',
      tipPrice: 'Prix : {0} / {1} par million de tokens',
      switchedTo: 'Basculé vers : {0}',
      switchedBest: 'Appliqué le meilleur de [{0}] : {1}',
      switchedBestNode: 'Basculé vers le meilleur nœud : {0}',
      noTestData: "« {0} » n'a pas de données de test — testez d'abord !",
      searchedLocal: '« {0} » recherché en local — choisissez vous-même le canal',
      syncedOk: 'Classement synchronisé depuis OpenRouter',
      syncedFail: 'Échec : OpenRouter injoignable, affichage du cache',
      switchFail: 'Échec du changement : {0}',
      switchError: 'Erreur de changement : {0}',
      sessionLocked: 'Impossible de changer de modèle dans cette session',
      channelNotReady: 'canal non prêt',
      batchDone: 'Test par lot terminé : {0} ok · {1} échecs',
      batchAborted: ' (arrêté)',
      batchDedupeNote: ' ; noms identiques : seul le premier canal est testé',
      probeUnreachable: 'Service de test injoignable : vérifiez que DSH tourne et un accès local',
      probe403: "Le backend du plugin n'accepte que le local (403)",
      catalog403: 'Catalogue impossible : backend local uniquement (403). Ouvrez DSH depuis 127.0.0.1',
      catalogHttp: 'Échec catalogue (HTTP {0})',
      catalogUnreachable: 'Catalogue impossible : backend du plugin injoignable (DSH lancé ?)',
      seatToastOk: 'Basculé vers « {0} » {1}',
      subtitle: '· {0} canaux · {1} modèles',
      catalogLoadingSub: '· chargement du catalogue…',
      effortSuffix: ' · {0}',
      boardSourceLive:
        'Catalogue de modèles OpenRouter · indices Artificial Analysis + Elo Design Arena (synchro quotidienne)',
      boardSourceOffline: 'Catalogue de modèles OpenRouter (hors ligne — aucune donnée notée disponible)',
      boardSourcePending: 'Pas encore de données · en attente de la première synchro (catalogue de modèles OpenRouter)',
      boardSourceAATip:
        'Ouvrir le classement officiel Artificial Analysis — source d’origine des indices intelligence/code/agent',
      boardSourceDATip: 'Ouvrir le classement officiel Design Arena — source d’origine de l’Elo en test à l’aveugle'
    }

    I18N.es = {
      title: 'Elegir modelo',
      searchPlaceholder: 'Buscar modelos, proveedores o modo de razonamiento...',
      sortSmart: 'Mejor puntuación global',
      sortTtft: 'Primer token más rápido (TTFT)',
      sortTps: 'Mayor rendimiento (TPS)',
      sortDefault: 'Orden predeterminado',
      probeFast: 'Prueba ×1 rápida',
      probeStable: 'Prueba ×3 estable',
      probeFastTip: 'Única: la más rápida, ~17-22% de varianza',
      probeStableTip: 'Mediana de tres: más estable, ~3× tiempo y cuota',
      batchStop: 'Detener ({0} en curso)',
      batchConfirm: 'Pulsa otra vez para confirmar ({0})',
      batchProbe: 'Prueba ({0})',
      batchStopTitle: 'Detener la prueba por lotes',
      batchTip: 'Probar en streaming {1} modelos de «{0}» (~3-6 s cada uno, tiempo límite 20 s, 2 en paralelo)',
      batchTestingPill: 'Probando {0}',
      batchTestingTitle: 'Prueba por lotes en curso',
      smartPick: 'El mejor · {0}',
      smartTag: 'Selección inteligente',
      apply: 'Aplicar',
      scopeAll: 'Global',
      scopeSearch: 'resultados',
      clearAll: 'Borrar resultados',
      confirmClearAll: 'Confirmar borrado total',
      cancel: 'Cancelar',
      clearAllTitle: 'Eliminar todos los resultados guardados (incluidos fallos)',
      confirmClearTitle: 'Confirmar el borrado de TODO (irreversible)',
      clearConfirmTip: 'Pulsa otra vez para borrar; se cancela en 6 s',
      clearedToast: 'Todos los resultados borrados',
      clearFailedToast: 'No se pudo borrar',
      clearRowTitle: 'Borrar el resultado de este modelo',
      clearRowAria: 'Borrar resultado de {0}',
      closeTitle: 'Cerrar (Esc)',
      close: 'Cerrar',
      themeToLight: 'Tema claro — pulsa para oscuro',
      themeToDark: 'Tema oscuro — pulsa para claro',
      langTitle: 'Idioma de la interfaz',
      tabAll: 'Todos',
      tabAllBadge: 'Todos',
      groupAllModels: 'Todos los modelos',
      scopeGroup: '«{0}»',
      boardName: 'TOP100',
      boardBtnTitle: 'Top 100 mundial (solo lectura; pulsa una fila para buscar canales locales)',
      scrollLeft: 'Desplazar a la izquierda',
      scrollRight: 'Desplazar a la derecha',
      loadingCatalog: 'Cargando proveedores y modelos… (tarda segundos tras iniciar DSH)',
      retryLoad: 'Reintentar',
      backendEmpty1: 'Backend accesible, pero no devolvió proveedores.',
      backendEmpty2: 'Si DSH se reinició, los proveedores siguen inicializando; revisa también sus sesiones.',
      groupEmpty: 'Sin modelos en este grupo',
      searchBanner: 'Búsqueda «{0}» — {1} modelos',
      noMatch: 'Ningún modelo coincide con «{0}»',
      clearSearch: 'Limpiar',
      untested: 'Sin probar',
      testing: 'Probando',
      probeBtn: 'Probar',
      reasonTimeout: 'Tiempo agotado',
      reasonUnreachable: 'Inaccesible',
      reasonForbidden: 'Restringido',
      reasonQuota: 'Cuota',
      reasonNoKey: 'Sin clave',
      reasonNotReady: 'No listo',
      reasonEmpty: 'Respuesta vacía',
      reasonFail: 'Prueba fallida',
      estimate: ' (est.)',
      estimateLegacyTitle: 'Estimación antigua (no medida); se purga al reiniciar DSH',
      medianTip: 'Mediana de {0}, dispersión TTFT {1} ms',
      measuredAt: 'medido {0}',
      agoMinutes: 'hace {0} min',
      agoHours: 'hace {0} h',
      agoDays: 'hace {0} d',
      agoLong: 'hace más de 30 días',
      justNow: 'ahora mismo',
      showAll: 'Mostrar todo',
      loadMore: 'Cargar más ({0} / {1})',
      collapse: 'Contraer (volver a los primeros {0})',
      reasoningTagTip: 'Admite razonamiento (ajusta el nivel en el menú de razonamiento del compositor)',
      unknownProvider: 'Proveedor desconocido',
      unnamedModel: 'Modelo sin nombre',
      selectModel: 'Elegir modelo',
      selectModelAria: 'Elige un modelo',
      fallbackTitle: 'Model Master — entrada de respaldo mientras otro plugin ocupe el botón nativo',
      boundaryError: 'Error al cargar Model Master: {0}\nPulsa para reintentar',
      navHint: 'navegar',
      pickHint: 'elegir modelo',
      closeHint: 'cerrar',
      tabHint: 'ciclo de foco',
      boardHeader: '{0} modelos con puntuaciones reales · pulsa una fila para buscar canales locales',
      boardEmptyHeader: 'Sin datos del ranking — sincroniza a la derecha',
      boardSync: 'Sincronizar',
      boardSyncing: 'Sincronizando…',
      boardEmpty: 'Sin datos. Pulsa «Sincronizar» para obtener puntuaciones reales de OpenRouter.',
      boardSource: 'Fuente: ',
      boardStale: ' · más de 24 h sin actualizar — conviene sincronizar',
      boardUpdated: ' · actualizado {0}',
      boardAge: ' ({0})',
      searchLocal: 'Buscar local',
      searchLocalTip: 'Buscar el mismo nombre en los modelos locales',
      rowClickTip: 'Pulsa la fila: buscar canales locales con el mismo nombre',
      rowAria: 'N.º {0} {1} — activar para buscar en local',
      intMetric: 'Int {0}',
      tipVendor: 'Proveedor: {0}',
      tipInt: 'Inteligencia: {0}',
      tipCoding: 'Código: {0}',
      tipAgentic: 'Agente: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Contexto: {0}',
      tipPrice: 'Precio: {0} / {1} por millón de tokens',
      switchedTo: 'Cambiado a: {0}',
      switchedBest: 'Aplicado el mejor de [{0}]: {1}',
      switchedBestNode: 'Cambiado al mejor nodo: {0}',
      noTestData: '«{0}» aún no tiene datos — ¡pruébalo primero!',
      searchedLocal: '«{0}» buscado en local — elige tú el canal',
      syncedOk: 'Ranking sincronizado desde OpenRouter',
      syncedFail: 'Fallo de sincronización: OpenRouter inaccesible, se muestra la caché',
      switchFail: 'Error al cambiar: {0}',
      switchError: 'Error de cambio: {0}',
      sessionLocked: 'No se puede cambiar de modelo en esta sesión',
      channelNotReady: 'canal no listo',
      batchDone: 'Prueba por lotes terminada: {0} ok · {1} fallos',
      batchAborted: ' (detenido)',
      batchDedupeNote: '; los nombres repetidos solo se prueban una vez',
      probeUnreachable: 'Servicio de pruebas inaccesible: confirma que DSH corre y accedes en local',
      probe403: 'El backend del plugin solo permite acceso local (403)',
      catalog403: 'Catálogo fallido: backend solo local (403). Abre DSH desde 127.0.0.1',
      catalogHttp: 'Catálogo fallido (HTTP {0})',
      catalogUnreachable: 'Catálogo fallido: no se alcanza el backend del plugin (¿DSH en marcha?)',
      seatToastOk: 'Cambiado a «{0}» {1}',
      subtitle: '· {0} canales · {1} modelos',
      catalogLoadingSub: '· cargando catálogo…',
      effortSuffix: ' · {0}',
      boardSourceLive:
        'Catálogo de modelos de OpenRouter · índices Artificial Analysis + Elo de Design Arena (sincronización diaria)',
      boardSourceOffline: 'Catálogo de modelos de OpenRouter (sin conexión — no hay datos puntuados)',
      boardSourcePending: 'Sin datos aún · esperando la primera sincronización (catálogo de modelos de OpenRouter)',
      boardSourceAATip:
        'Abrir la clasificación oficial de Artificial Analysis — origen de los índices de inteligencia/código/agente',
      boardSourceDATip: 'Abrir la clasificación oficial de Design Arena — origen del Elo de prueba a ciegas'
    }

    I18N.pt = {
      title: 'Escolher modelo',
      searchPlaceholder: 'Pesquisar modelos, provedores ou modo de raciocínio...',
      sortSmart: 'Melhor pontuação global',
      sortTtft: 'Primeiro token mais rápido (TTFT)',
      sortTps: 'Maior vazão (TPS)',
      sortDefault: 'Ordem padrão',
      probeFast: 'Teste ×1 rápido',
      probeStable: 'Teste ×3 estável',
      probeFastTip: 'Único: o mais rápido, ~17-22% de variação',
      probeStableTip: 'Mediana de três: mais estável, ~3× tempo e cota',
      batchStop: 'Parar ({0} em andamento)',
      batchConfirm: 'Clique de novo para confirmar ({0})',
      batchProbe: 'Teste ({0})',
      batchStopTitle: 'Parar o teste em lote',
      batchTip: 'Testar em fluxo {1} modelos de "{0}" (~3-6s cada, limite 20s, 2 em paralelo)',
      batchTestingPill: 'Testando {0}',
      batchTestingTitle: 'Teste em lote em andamento',
      smartPick: 'O melhor · {0}',
      smartTag: 'Escolha inteligente',
      apply: 'Aplicar',
      scopeAll: 'Global',
      scopeSearch: 'resultados',
      clearAll: 'Limpar resultados',
      confirmClearAll: 'Confirmar limpar tudo',
      cancel: 'Cancelar',
      clearAllTitle: 'Excluir todos os resultados salvos (incluindo falhas)',
      confirmClearTitle: 'Confirmar exclusão de TUDO (irreversível)',
      clearConfirmTip: 'Clique de novo para excluir; cancela em 6s',
      clearedToast: 'Todos os resultados foram excluídos',
      clearFailedToast: 'Falha ao excluir',
      clearRowTitle: 'Excluir o resultado deste modelo',
      clearRowAria: 'Excluir resultado de {0}',
      closeTitle: 'Fechar (Esc)',
      close: 'Fechar',
      themeToLight: 'Tema claro — clique para escuro',
      themeToDark: 'Tema escuro — clique para claro',
      langTitle: 'Idioma da interface',
      tabAll: 'Todos',
      tabAllBadge: 'Todos',
      groupAllModels: 'Todos os modelos',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'Top 100 mundial (somente exibição; clique na linha para buscar canais locais)',
      scrollLeft: 'Rolar à esquerda',
      scrollRight: 'Rolar à direita',
      loadingCatalog: 'Carregando provedores e modelos… (leva segundos após iniciar o DSH)',
      retryLoad: 'Tentar de novo',
      backendEmpty1: 'Backend acessível, mas nenhum provedor retornado.',
      backendEmpty2: 'Se o DSH reiniciou, os provedores podem estar inicializando; verifique também os logins.',
      groupEmpty: 'Sem modelos neste grupo',
      searchBanner: 'Busca \"{0}\" — {1} modelos',
      noMatch: 'Nenhum modelo corresponde a \"{0}\"',
      clearSearch: 'Limpar',
      untested: 'Não testado',
      testing: 'Testando',
      probeBtn: 'Testar',
      reasonTimeout: 'Tempo esgotado',
      reasonUnreachable: 'Inacessível',
      reasonForbidden: 'Restrito',
      reasonQuota: 'Cota',
      reasonNoKey: 'Sem chave',
      reasonNotReady: 'Não pronto',
      reasonEmpty: 'Resposta vazia',
      reasonFail: 'Teste falhou',
      estimate: ' (estimado)',
      estimateLegacyTitle: 'Estimativa antiga (não medida); purgada ao reiniciar o DSH',
      medianTip: 'Mediana de {0}, dispersão de TTFT {1} ms',
      measuredAt: 'medido {0}',
      agoMinutes: 'há {0} min',
      agoHours: 'há {0} h',
      agoDays: 'há {0} d',
      agoLong: 'há mais de 30 dias',
      justNow: 'agora mesmo',
      showAll: 'Mostrar tudo',
      loadMore: 'Carregar mais ({0} / {1})',
      collapse: 'Recolher (voltar aos primeiros {0})',
      reasoningTagTip: 'Suporta raciocínio (ajuste o nível no menu de raciocínio do compositor)',
      unknownProvider: 'Provedor desconhecido',
      unnamedModel: 'Modelo sem nome',
      selectModel: 'Escolher modelo',
      selectModelAria: 'Escolha um modelo',
      fallbackTitle: 'Model Master — entrada alternativa enquanto outro plugin ocupa o botão nativo',
      boundaryError: 'Falha ao carregar o Model Master: {0}\nClique para tentar de novo',
      navHint: 'navegar',
      pickHint: 'escolher modelo',
      closeHint: 'fechar',
      tabHint: 'ciclo de foco',
      boardHeader: '{0} modelos com pontuações reais · clique na linha para buscar canais locais',
      boardEmptyHeader: 'Sem dados do ranking — sincronize à direita',
      boardSync: 'Sincronizar',
      boardSyncing: 'Sincronizando…',
      boardEmpty: 'Sem dados. Clique em "Sincronizar" para obter pontuações reais do OpenRouter.',
      boardSource: 'Fonte: ',
      boardStale: ' · mais de 24 h sem atualizar — sincronize',
      boardUpdated: ' · atualizado {0}',
      boardAge: ' ({0})',
      searchLocal: 'Buscar local',
      searchLocalTip: 'Pesquisar o mesmo nome nos modelos locais',
      rowClickTip: 'Clique na linha: buscar canais locais com o mesmo nome',
      rowAria: 'N.º {0} {1} — ative para buscar localmente',
      intMetric: 'Int {0}',
      tipVendor: 'Fornecedor: {0}',
      tipInt: 'Inteligência: {0}',
      tipCoding: 'Código: {0}',
      tipAgentic: 'Agente: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Contexto: {0}',
      tipPrice: 'Preço: {0} / {1} por milhão de tokens',
      switchedTo: 'Mudado para: {0}',
      switchedBest: 'Aplicado o melhor de [{0}]: {1}',
      switchedBestNode: 'Mudado para o melhor nó: {0}',
      noTestData: '"{0}" ainda não tem dados — teste primeiro!',
      searchedLocal: '"{0}" pesquisado localmente — escolha você o canal',
      syncedOk: 'Ranking sincronizado do OpenRouter',
      syncedFail: 'Falha na sincronização: OpenRouter inacessível, exibindo cache',
      switchFail: 'Falha ao mudar: {0}',
      switchError: 'Erro ao mudar: {0}',
      sessionLocked: 'Não é possível trocar de modelo nesta sessão',
      channelNotReady: 'canal não pronto',
      batchDone: 'Teste em lote concluído: {0} ok · {1} falhas',
      batchAborted: ' (interrompido)',
      batchDedupeNote: '; nomes iguais testam só o primeiro canal',
      probeUnreachable: 'Serviço de teste inacessível: confirme que o DSH roda e o acesso é local',
      probe403: 'O backend do plugin só permite acesso local (403)',
      catalog403: 'Catálogo falhou: backend só local (403). Abra o DSH de 127.0.0.1',
      catalogHttp: 'Catálogo falhou (HTTP {0})',
      catalogUnreachable: 'Catálogo falhou: backend do plugin inacessível (DSH rodando?)',
      seatToastOk: 'Mudado para \"{0}\" {1}',
      subtitle: '· {0} canais · {1} modelos',
      catalogLoadingSub: '· carregando catálogo…',
      effortSuffix: ' · {0}',
      boardSourceLive:
        'Catálogo de modelos do OpenRouter · índices Artificial Analysis + Elo do Design Arena (sincronização diária)',
      boardSourceOffline: 'Catálogo de modelos do OpenRouter (offline — nenhum dado pontuado disponível)',
      boardSourcePending: 'Ainda sem dados · aguardando a primeira sincronização (catálogo de modelos do OpenRouter)',
      boardSourceAATip:
        'Abrir o ranking oficial do Artificial Analysis — origem dos índices de inteligência/código/agente',
      boardSourceDATip: 'Abrir o ranking oficial do Design Arena — origem do Elo de teste às cegas'
    }

    I18N.ru = {
      title: 'Выбор модели',
      searchPlaceholder: 'Поиск моделей, провайдеров или режима рассуждений...',
      sortSmart: 'Лучший общий балл',
      sortTtft: 'Быстрейший первый токен (TTFT)',
      sortTps: 'Максимальная скорость (TPS)',
      sortDefault: 'Порядок по умолчанию',
      probeFast: 'Тест ×1 быстро',
      probeStable: 'Тест ×3 стабильно',
      probeFastTip: 'Однократно: быстрее всего, разброс ~17-22%',
      probeStableTip: 'Медиана из трёх: стабильнее, ~3× время и квота',
      batchStop: 'Стоп ({0} идёт)',
      batchConfirm: 'Нажмите ещё раз для подтверждения ({0})',
      batchProbe: 'Тест ({0})',
      batchStopTitle: 'Остановить пакетный тест',
      batchTip: 'Потоковое тестирование {1} моделей «{0}» по очереди (~3-6 с, таймаут 20 с, 2 параллельно)',
      batchTestingPill: 'Тест {0}',
      batchTestingTitle: 'Пакетный тест идёт',
      smartPick: 'Лучший · {0}',
      smartTag: 'Умный выбор',
      apply: 'Применить',
      scopeAll: 'Все',
      scopeSearch: 'результаты поиска',
      clearAll: 'Очистить результаты',
      confirmClearAll: 'Подтвердить полную очистку',
      cancel: 'Отмена',
      clearAllTitle: 'Удалить все сохранённые результаты (включая ошибки)',
      confirmClearTitle: 'Подтвердите удаление ВСЕХ результатов (необратимо)',
      clearConfirmTip: 'Ещё раз — чтобы удалить; автоотмена через 6 с',
      clearedToast: 'Все результаты удалены',
      clearFailedToast: 'Не удалось удалить',
      clearRowTitle: 'Удалить результат этой модели',
      clearRowAria: 'Удалить результат {0}',
      closeTitle: 'Закрыть (Esc)',
      close: 'Закрыть',
      themeToLight: 'Светлая тема — щёлкните для тёмной',
      themeToDark: 'Тёмная тема — щёлкните для светлой',
      langTitle: 'Язык интерфейса',
      tabAll: 'Все',
      tabAllBadge: 'Все',
      groupAllModels: 'Все модели',
      scopeGroup: '«{0}»',
      boardName: 'TOP100',
      boardBtnTitle: 'Мировой топ-100 (только просмотр; клик по строке — локальный поиск)',
      scrollLeft: 'Прокрутить влево',
      scrollRight: 'Прокрутить вправо',
      loadingCatalog: 'Загрузка провайдеров и моделей… (после старта DSH — несколько секунд)',
      retryLoad: 'Повторить',
      backendEmpty1: 'Бэкенд доступен, но провайдеров не вернул.',
      backendEmpty2: 'Если DSH только перезапущен — провайдеры ещё инициализируются; проверьте и входы в аккаунты.',
      groupEmpty: 'В этой группе нет моделей',
      searchBanner: 'Поиск «{0}» — найдено {1}',
      noMatch: 'Нет моделей по запросу «{0}»',
      clearSearch: 'Очистить',
      untested: 'Не тестировался',
      testing: 'Тестируется',
      probeBtn: 'Тест',
      reasonTimeout: 'Таймаут',
      reasonUnreachable: 'Недоступен',
      reasonForbidden: 'Ограничено',
      reasonQuota: 'Квота',
      reasonNoKey: 'Нет ключа',
      reasonNotReady: 'Не готов',
      reasonEmpty: 'Пустой ответ',
      reasonFail: 'Ошибка теста',
      estimate: ' (оценка)',
      estimateLegacyTitle: 'Старая оценка (не измерение); удалится при перезапуске DSH',
      medianTip: 'Медиана из {0}, разброс TTFT {1} мс',
      measuredAt: 'измерено {0}',
      agoMinutes: '{0} мин назад',
      agoHours: '{0} ч назад',
      agoDays: '{0} дн назад',
      agoLong: 'более 30 дней назад',
      justNow: 'только что',
      showAll: 'Показать все',
      loadMore: 'Ещё (показано {0} / {1})',
      collapse: 'Свернуть (первые {0})',
      reasoningTagTip: 'Поддерживает рассуждения (уровень — в меню рассуждений поля ввода)',
      unknownProvider: 'Неизвестный провайдер',
      unnamedModel: 'Модель без имени',
      selectModel: 'Выбрать модель',
      selectModelAria: 'Выберите модель',
      fallbackTitle: 'Model Master — запасной вход, пока нативную кнопку занял другой плагин',
      boundaryError: 'Не удалось загрузить Model Master: {0}\nНажмите для повтора',
      navHint: 'навигация',
      pickHint: 'выбрать модель',
      closeHint: 'закрыть',
      tabHint: 'цикл фокуса',
      boardHeader: '{0} моделей с реальными баллами · клик по строке — локальный поиск',
      boardEmptyHeader: 'Нет данных рейтинга — синхронизируйте справа',
      boardSync: 'Синхронизировать',
      boardSyncing: 'Синхронизация…',
      boardEmpty: 'Нет данных. Нажмите «Синхронизировать» — реальные баллы из OpenRouter.',
      boardSource: 'Источник: ',
      boardStale: ' · старше 24 ч — рекомендуется синхронизация',
      boardUpdated: ' · обновлено {0}',
      boardAge: ' ({0})',
      searchLocal: 'Локальный поиск',
      searchLocalTip: 'Искать то же имя среди локальных моделей',
      rowClickTip: 'Клик по строке: найти локальные каналы с тем же именем',
      rowAria: '№{0} {1} — активируйте для локального поиска',
      intMetric: 'Инт {0}',
      tipVendor: 'Поставщик: {0}',
      tipInt: 'Интеллект: {0}',
      tipCoding: 'Код: {0}',
      tipAgentic: 'Агент: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Контекст: {0}',
      tipPrice: 'Цена: {0} / {1} за миллион токенов',
      switchedTo: 'Переключено на: {0}',
      switchedBest: 'Применён лучший из [{0}]: {1}',
      switchedBestNode: 'Переключено на лучший узел: {0}',
      noTestData: 'У «{0}» нет данных теста — сначала протестируйте!',
      searchedLocal: '«{0}» — локальный поиск выполнен, выберите канал сами',
      syncedOk: 'Рейтинг синхронизирован с OpenRouter',
      syncedFail: 'Сбой синхронизации: OpenRouter недоступен, показан кэш',
      switchFail: 'Не удалось переключиться: {0}',
      switchError: 'Ошибка переключения: {0}',
      sessionLocked: 'В этой сессии нельзя менять модель',
      channelNotReady: 'канал не готов',
      batchDone: 'Пакетный тест завершён: успех {0} · ошибок {1}',
      batchAborted: ' (остановлено)',
      batchDedupeNote: '; одноимённые каналы тестируются только первым',
      probeUnreachable: 'Сервис тестирования недоступен: проверьте, что DSH запущен и доступ локальный',
      probe403: 'Бэкенд плагина разрешает только локальный доступ (403)',
      catalog403: 'Ошибка каталога: бэкенд только локальный (403). Откройте DSH с 127.0.0.1',
      catalogHttp: 'Ошибка каталога (HTTP {0})',
      catalogUnreachable: 'Ошибка каталога: бэкенд плагина недоступен (DSH запущен?)',
      seatToastOk: 'Переключено на «{0}» {1}',
      subtitle: '· {0} каналов · {1} моделей',
      catalogLoadingSub: '· загрузка каталога…',
      effortSuffix: ' · {0}',
      boardSourceLive:
        'Каталог моделей OpenRouter · индексы Artificial Analysis + Elo Design Arena (ежедневная синхронизация)',
      boardSourceOffline: 'Каталог моделей OpenRouter (офлайн — нет доступных оценённых данных)',
      boardSourcePending: 'Данных пока нет · ожидание первой синхронизации (каталог моделей OpenRouter)',
      boardSourceAATip:
        'Открыть официальный рейтинг Artificial Analysis — первоисточник индексов интеллекта/кода/агента',
      boardSourceDATip: 'Открыть официальный рейтинг Design Arena — первоисточник Elo слепого теста'
    }

    I18N.ar = {
      title: 'اختيار النموذج',
      searchPlaceholder: 'ابحث عن النماذج أو المزودين أو وضع التفكير...',
      sortSmart: 'أعلى نتيجة شاملة',
      sortTtft: 'أسرع رمز أول (TTFT)',
      sortTps: 'أعلى إنتاجية (TPS)',
      sortDefault: 'الترتيب الافتراضي',
      probeFast: 'قياس ×1 سريع',
      probeStable: 'قياس ×3 مستقر',
      probeFastTip: 'مفرد: الأسرع مع تفاوت ~17-22%',
      probeStableTip: 'وسيط ثلاثة: أكثر استقرارًا، ~3× الوقت والحصة',
      batchStop: 'إيقاف ({0} جارٍ)',
      batchConfirm: 'انقر مجددًا للتأكيد ({0})',
      batchProbe: 'قياس ({0})',
      batchStopTitle: 'إيقاف القياس الجماعي',
      batchTip: 'قياس {1} نموذجًا من «{0}» واحدًا تلو الآخر (~3-6 ث لكل نموذج، مهلة 20 ث، اثنان متوازيان)',
      batchTestingPill: 'قياس {0}',
      batchTestingTitle: 'القياس الجماعي جارٍ',
      smartPick: 'الأفضل · {0}',
      smartTag: 'اختيار ذكي',
      apply: 'تطبيق',
      scopeAll: 'الكل',
      scopeSearch: 'نتائج البحث',
      clearAll: 'مسح النتائج',
      confirmClearAll: 'تأكيد مسح الكل',
      cancel: 'إلغاء',
      clearAllTitle: 'حذف جميع النتائج المحفوظة (بما فيها الفاشلة)',
      confirmClearTitle: 'تأكيد حذف كل النتائج (لا يمكن التراجع)',
      clearConfirmTip: 'انقر مجددًا للمسح الفعلي؛ إلغاء تلقائي بعد 6 ثوانٍ',
      clearedToast: 'تم مسح جميع النتائج',
      clearFailedToast: 'فشل المسح، حاول لاحقًا',
      clearRowTitle: 'مسح نتيجة هذا النموذج',
      clearRowAria: 'مسح نتيجة {0}',
      closeTitle: 'إغلاق (Esc)',
      close: 'إغلاق',
      themeToLight: 'الفاتح مفعّل — انقر للداكن',
      themeToDark: 'الداكن مفعّل — انقر للفاتح',
      langTitle: 'لغة الواجهة',
      tabAll: 'الكل',
      tabAllBadge: 'الكل',
      groupAllModels: 'كل النماذج',
      scopeGroup: '«{0}»',
      boardName: 'TOP100',
      boardBtnTitle: 'أفضل 100 عالميًا (للعرض فقط؛ انقر صفًا للبحث في القنوات المحلية)',
      scrollLeft: 'تمرير لليسار',
      scrollRight: 'تمرير لليمين',
      loadingCatalog: 'تحميل المزودين والنماذج… (بعد بدء DSH يستغرق ثوانٍ)',
      retryLoad: 'إعادة المحاولة',
      backendEmpty1: 'الخادم متاح لكنه لم يُرجع أي مزودين.',
      backendEmpty2: 'إذا أُعيد تشغيل DSH للتو فقد تكون المزودات قيد التهيئة؛ تحقق أيضًا من تسجيلات الدخول.',
      groupEmpty: 'لا نماذج في هذه المجموعة',
      searchBanner: 'البحث عن «{0}» — {1} نموذجًا',
      noMatch: 'لا نماذج تطابق «{0}»',
      clearSearch: 'مسح',
      untested: 'لم يُقَس',
      testing: 'قيد القياس',
      probeBtn: 'قياس',
      reasonTimeout: 'انتهت المهلة',
      reasonUnreachable: 'غير قابل للوصول',
      reasonForbidden: 'مقيّد',
      reasonQuota: 'الحصة',
      reasonNoKey: 'لا مفتاح',
      reasonNotReady: 'غير جاهز',
      reasonEmpty: 'رد فارغ',
      reasonFail: 'فشل القياس',
      estimate: ' (تقديري)',
      estimateLegacyTitle: 'تقدير من إصدار قديم (ليس قياسًا حقيقيًا)؛ يُحذف تلقائيًا بعد إعادة تشغيل DSH',
      medianTip: 'وسيط {0}، تفاوت TTFT {1} ms',
      measuredAt: 'قيس {0}',
      agoMinutes: 'قبل {0} دقيقة',
      agoHours: 'قبل {0} ساعة',
      agoDays: 'قبل {0} يوم',
      agoLong: 'أكثر من 30 يومًا',
      justNow: 'الآن',
      showAll: 'عرض الكل',
      loadMore: 'تحميل المزيد ({0} / {1})',
      collapse: 'طيّ (العودة لأول {0})',
      reasoningTagTip: 'يدعم التفكير (اضبط المستوى من قائمة التفكير في صندوق الإدخال)',
      unknownProvider: 'مزود غير معروف',
      unnamedModel: 'نموذج بلا اسم',
      selectModel: 'اختيار النموذج',
      selectModelAria: 'اختر نموذجًا',
      fallbackTitle: 'Model Master — مدخل بديل بينما يحتلّ إضافة أخرى زر النموذج الأصلي',
      boundaryError: 'فشل تحميل Model Master: {0}\nانقر لإعادة المحاولة',
      navHint: 'تنقّل',
      pickHint: 'اختيار نموذج',
      closeHint: 'إغلاق',
      tabHint: 'تدوير التركيز',
      boardHeader: '{0} نموذجًا بنتائج حقيقية · انقر صفًا للبحث عن القنوات المحلية',
      boardEmptyHeader: 'لا بيانات للوحة — زامن من اليمين',
      boardSync: 'مزامنة الأحدث',
      boardSyncing: 'جارٍ المزامنة…',
      boardEmpty: 'لا بيانات. انقر «مزامنة الأحدث» لجلب النتائج الحقيقية من OpenRouter.',
      boardSource: 'المصدر: ',
      boardStale: ' · أقدم من 24 ساعة — يُنصح بالمزامنة',
      boardUpdated: ' · حدّث {0}',
      boardAge: ' ({0})',
      searchLocal: 'بحث محلي',
      searchLocalTip: 'البحث عن الاسم نفسه في النماذج المحلية',
      rowClickTip: 'انقر الصف: البحث عن القنوات المحلية بالاسم نفسه',
      rowAria: 'المرتبة {0} {1} — فعّل للبحث محليًا',
      intMetric: 'ذكاء {0}',
      tipVendor: 'المزود: {0}',
      tipInt: 'مؤشر الذكاء: {0}',
      tipCoding: 'البرمجة: {0}',
      tipAgentic: 'الوكيل: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'السياق: {0}',
      tipPrice: 'السعر: {0} / {1} لكل مليون رمز',
      switchedTo: 'تم التبديل إلى: {0}',
      switchedBest: 'طُبّق الأفضل من [{0}]: {1}',
      switchedBestNode: 'تم التبديل لأفضل عقدة: {0}',
      noTestData: '«{0}» بلا بيانات قياس — قِس أولًا!',
      searchedLocal: 'تم البحث المحلي عن «{0}» — اختر القناة بنفسك',
      syncedOk: 'تمت مزامنة اللوحة من OpenRouter',
      syncedFail: 'فشلت المزامنة: OpenRouter غير متاح، يُعرض المخزن المؤقت',
      switchFail: 'فشل التبديل: {0}',
      switchError: 'خطأ في التبديل: {0}',
      sessionLocked: 'لا يمكن تبديل النموذج في هذه الجلسة',
      channelNotReady: 'القناة غير جاهزة',
      batchDone: 'انتهى القياس الجماعي: نجح {0} · فشل {1}',
      batchAborted: ' (أُوقف يدويًا)',
      batchDedupeNote: '؛ الأسماء المتطابقة تُقاس أول قناة فقط',
      probeUnreachable: 'خدمة القياس غير متاحة: تأكد من تشغيل DSH والوصول المحلي',
      probe403: 'خلفية الإضافة تسمح محليًا فقط (403)',
      catalog403: 'فشل الفهرس: الخلفية محلية فقط (403). افتح DSH من 127.0.0.1',
      catalogHttp: 'فشل الفهرس (HTTP {0})',
      catalogUnreachable: 'فشل الفهرس: خلفية الإضافة غير متاحة (هل DSH يعمل؟)',
      seatToastOk: 'تم التبديل إلى «{0}» {1}',
      subtitle: '· {0} قنوات · {1} نموذجًا',
      catalogLoadingSub: '· جارٍ تحميل الفهرس…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'كتالوج نماذج OpenRouter · مؤشرات Artificial Analysis + Elo Design Arena (مزامنة يومية)',
      boardSourceOffline: 'كتالوج نماذج OpenRouter (دون اتصال — لا تتوفر بيانات مُقيّمة)',
      boardSourcePending: 'لا توجد بيانات بعد · في انتظار أول مزامنة (كتالوج نماذج OpenRouter)',
      boardSourceAATip: 'افتح لوحة Artificial Analysis الرسمية — المصدر الأصلي لمؤشرات الذكاء/البرمجة/الوكيل',
      boardSourceDATip: 'افتح لوحة Design Arena الرسمية — المصدر الأصلي لتقييم Elo بالاختبار الأعمى'
    }

    I18N.hi = {
      title: 'मॉडल चुनें',
      searchPlaceholder: 'मॉडल, प्रदाता या तर्क मोड खोजें...',
      sortSmart: 'सर्वश्रेष्ठ स्कोर',
      sortTtft: 'सबसे तेज़ पहला टोकन (TTFT)',
      sortTps: 'सर्वाधिक थ्रूपुट (TPS)',
      sortDefault: 'डिफ़ॉल्ट क्रम',
      probeFast: 'जाँच ×1 तेज़',
      probeStable: 'जाँच ×3 स्थिर',
      probeFastTip: 'एकल: सबसे तेज़, ~17-22% भिन्नता',
      probeStableTip: 'तीन का माध्यिक: अधिक स्थिर, ~3× समय व कोटा',
      batchStop: 'रोकें ({0} चल रहे)',
      batchConfirm: 'पुष्टि के लिए फिर क्लिक करें ({0})',
      batchProbe: 'जाँच ({0})',
      batchStopTitle: 'चालू बैच जाँच रोकें',
      batchTip: '"{0}" के {1} मॉडल को क्रमवार स्ट्रीम-जाँच (~3-6से प्रति, 20से टाइमआउट, 2 समानांतर)',
      batchTestingPill: 'जाँच {0}',
      batchTestingTitle: 'बैच जाँच चल रही है',
      smartPick: 'सर्वोत्तम · {0}',
      smartTag: 'स्मार्ट चयन',
      apply: 'लागू करें',
      scopeAll: 'सार्वजनिक',
      scopeSearch: 'खोज परिणाम',
      clearAll: 'परिणाम मिटाएँ',
      confirmClearAll: 'पूर्ण मिटाने की पुष्टि',
      cancel: 'रद्द',
      clearAllTitle: 'सहेजे गए सभी परिणाम हटाएँ (विफल सहित)',
      confirmClearTitle: 'सभी परिणाम हटाने की पुष्टि (अपरिवर्तनीय)',
      clearConfirmTip: 'वास्तव में मिटाने के लिए फिर क्लिक करें; 6 सेकंड में रद्द',
      clearedToast: 'सभी परिणाम मिटा दिए गए',
      clearFailedToast: 'मिटाना विफल, फिर कोशिश करें',
      clearRowTitle: 'इस मॉडल का परिणाम मिटाएँ',
      clearRowAria: '{0} का परिणाम मिटाएँ',
      closeTitle: 'बंद करें (Esc)',
      close: 'बंद करें',
      themeToLight: 'लाइट थीम — डार्क के लिए क्लिक',
      themeToDark: 'डार्क थीम — लाइट के लिए क्लिक',
      langTitle: 'इंटरफ़ेस भाषा',
      tabAll: 'सभी',
      tabAllBadge: 'सभी',
      groupAllModels: 'सभी मॉडल',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'वैश्विक शीर्ष 100 (केवल प्रदर्शन; स्थानीय खोज हेतु पंक्ति पर क्लिक)',
      scrollLeft: 'बाएँ स्क्रॉल',
      scrollRight: 'दाएँ स्क्रॉल',
      loadingCatalog: 'प्रदाता व मॉडल लोड हो रहे हैं… (DSH शुरू होने के बाद कुछ सेकंड)',
      retryLoad: 'पुनः प्रयास',
      backendEmpty1: 'बैकएंड उपलब्ध, पर कोई प्रदाता नहीं मिला।',
      backendEmpty2: 'DSH अभी रीस्टार्ट हुआ हो तो प्रदाता तैयार हो रहे होंगे; लॉगिन भी जाँचें।',
      groupEmpty: 'इस समूह में कोई मॉडल नहीं',
      searchBanner: '\"{0}\" खोज — {1} मॉडल मिले',
      noMatch: '\"{0}\" से मिलता कोई मॉडल नहीं',
      clearSearch: 'साफ़ करें',
      untested: 'अजाँच',
      testing: 'जाँच हो रही',
      probeBtn: 'जाँच',
      reasonTimeout: 'समय समाप्त',
      reasonUnreachable: 'अनुपलब्ध',
      reasonForbidden: 'प्रतिबंधित',
      reasonQuota: 'कोटा',
      reasonNoKey: 'कुंजी नहीं',
      reasonNotReady: 'तैयार नहीं',
      reasonEmpty: 'खाली उत्तर',
      reasonFail: 'जाँच विफल',
      estimate: ' (अनुमान)',
      estimateLegacyTitle: 'पुराना अनुमान (वास्तविक माप नहीं); DSH रीस्टार्ट पर स्वतः हटेगा',
      medianTip: '{0} का माध्यिक, TTFT फैलाव {1} ms',
      measuredAt: 'मापा {0}',
      agoMinutes: '{0} मिनट पहले',
      agoHours: '{0} घंटे पहले',
      agoDays: '{0} दिन पहले',
      agoLong: '30 दिन से अधिक पहले',
      justNow: 'अभी',
      showAll: 'सभी दिखाएँ',
      loadMore: 'और लोड ({0} / {1})',
      collapse: 'संकुचित (पहले {0} पर)',
      reasoningTagTip: 'तर्क समर्थित (स्तर इनपुट बॉक्स के तर्क मेनू में बदलें)',
      unknownProvider: 'अज्ञात प्रदाता',
      unnamedModel: 'बेनाम मॉडल',
      selectModel: 'मॉडल चुनें',
      selectModelAria: 'कृपया मॉडल चुनें',
      fallbackTitle: 'Model Master — जब कोई अन्य प्लगइन मूल मॉडल बटन पर कब्ज़ा करे तब वैकल्पिक प्रवेश',
      boundaryError: 'Model Master लोड विफल: {0}\nपुनः प्रयास हेतु क्लिक करें',
      navHint: 'नेविगेट',
      pickHint: 'मॉडल चुनें',
      closeHint: 'बंद',
      tabHint: 'फ़ोकस चक्र',
      boardHeader: 'वास्तविक स्कोर वाले {0} मॉडल · स्थानीय खोज हेतु पंक्ति पर क्लिक',
      boardEmptyHeader: 'कोई रैंकिंग डेटा नहीं — दाईं ओर से समन्वयित करें',
      boardSync: 'नवीनतम सिंक',
      boardSyncing: 'सिंक हो रहा…',
      boardEmpty: 'कोई डेटा नहीं। OpenRouter से वास्तविक स्कोर लाने "नवीनतम सिंक" दबाएँ।',
      boardSource: 'स्रोत: ',
      boardStale: ' · 24 घंटे से पुराना — सिंक करें',
      boardUpdated: ' · अद्यतन {0}',
      boardAge: ' ({0})',
      searchLocal: 'स्थानीय खोज',
      searchLocalTip: 'स्थानीय मॉडलों में वही नाम खोजें',
      rowClickTip: 'पंक्ति क्लिक: उसी नाम के स्थानीय चैनल खोजें',
      rowAria: 'क्रम {0} {1} — स्थानीय खोज हेतु सक्रिय करें',
      intMetric: 'बुद्धि {0}',
      tipVendor: 'प्रदाता: {0}',
      tipInt: 'बुद्धिमत्ता: {0}',
      tipCoding: 'कोडिंग: {0}',
      tipAgentic: 'एजेंट: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'संदर्भ: {0}',
      tipPrice: 'मूल्य: {0} / {1} प्रति मिलियन टोकन',
      switchedTo: 'बदला: {0}',
      switchedBest: '[{0}] का सर्वोत्तम: {1}',
      switchedBestNode: 'सर्वोत्तम नोड पर: {0}',
      noTestData: '"{0}" का कोई जाँच डेटा नहीं — पहले जाँचें!',
      searchedLocal: '"{0}" स्थानीय रूप से खोजा गया — चैनल स्वयं चुनें',
      syncedOk: 'OpenRouter से रैंकिंग सिंक हुई',
      syncedFail: 'सिंक विफल: OpenRouter अनुपलब्ध, कैश दिख रहा है',
      switchFail: 'बदलना विफल: {0}',
      switchError: 'बदलने में त्रुटि: {0}',
      sessionLocked: 'इस सत्र में मॉडल नहीं बदल सकते',
      channelNotReady: 'चैनल तैयार नहीं',
      batchDone: 'बैच जाँच पूरी: सफल {0} · विफल {1}',
      batchAborted: ' (रोका गया)',
      batchDedupeNote: '; समान नाम के चैनलों में पहला ही जाँचा जाता है',
      probeUnreachable: 'जाँच सेवा अनुपलब्ध: DSH चालू और स्थानीय एक्सेस सुनिश्चित करें',
      probe403: 'प्लगइन बैकएंड केवल स्थानीय (403)',
      catalog403: 'सूची विफल: बैकएंड केवल स्थानीय (403)। 127.0.0.1 से DSH खोलें',
      catalogHttp: 'सूची विफल (HTTP {0})',
      catalogUnreachable: 'सूची विफल: प्लगइन बैकएंड अनुपलब्ध (DSH चल रहा है?)',
      seatToastOk: '\"{0}\" पर बदला {1}',
      subtitle: '· {0} चैनल · {1} मॉडल',
      catalogLoadingSub: '· सूची लोड हो रही…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter मॉडल सूची · Artificial Analysis सूचकांक + Design Arena Elo (दैनिक सिंक)',
      boardSourceOffline: 'OpenRouter मॉडल सूची (ऑफ़लाइन — कोई स्कोर वाला डेटा उपलब्ध नहीं)',
      boardSourcePending: 'अभी कोई डेटा नहीं · पहले सिंक की प्रतीक्षा (OpenRouter मॉडल सूची)',
      boardSourceAATip: 'आधिकारिक Artificial Analysis लीडरबोर्ड खोलें — बुद्धि/कोडिंग/एजेंट सूचकांकों का मूल स्रोत',
      boardSourceDATip: 'आधिकारिक Design Arena लीडरबोर्ड खोलें — ब्लाइंड-टेस्ट Elo का मूल स्रोत'
    }

    I18N.bn = {
      title: 'মডেল নির্বাচন',
      searchPlaceholder: 'মডেল, প্রোভাইডার বা রিজনিং মোড খুঁজুন...',
      sortSmart: 'সর্বোচ্চ সম্মিলিত স্কোর',
      sortTtft: 'দ্রুততম প্রথম টোকেন (TTFT)',
      sortTps: 'সর্বোচ্চ থ্রুপুট (TPS)',
      sortDefault: 'ডিফল্ট ক্রম',
      probeFast: 'পরীক্ষা ×১ দ্রুত',
      probeStable: 'পরীক্ষা ×৩ স্থিতিশীল',
      probeFastTip: 'একক: দ্রুততম, ~১৭-২২% ভিন্নতা',
      probeStableTip: 'তিনটির মধ্যমা: স্থিতিশীল, ~৩× সময় ও কোটা',
      batchStop: 'থামান ({0} চলছে)',
      batchConfirm: 'নিশ্চিত করতে আবার ক্লিক ({0})',
      batchProbe: 'পরীক্ষা ({0})',
      batchStopTitle: 'চলমান ব্যাচ পরীক্ষা থামান',
      batchTip: '"{0}"-এর {1}টি মডেল পরপর স্ট্রিম-পরীক্ষা (প্রতিটি ~৩-৬সে, টাইমআউট ২০সে, ২ সমান্তরাল)',
      batchTestingPill: 'পরীক্ষা {0}',
      batchTestingTitle: 'ব্যাচ পরীক্ষা চলছে',
      smartPick: 'সেরা · {0}',
      smartTag: 'স্মার্ট নির্বাচন',
      apply: 'প্রয়োগ',
      scopeAll: 'গ্লোবাল',
      scopeSearch: 'ফলাফল',
      clearAll: 'ফলাফল মুছুন',
      confirmClearAll: 'সব মুছতে নিশ্চিত করুন',
      cancel: 'বাতিল',
      clearAllTitle: 'সংরক্ষিত সব ফলাফল মুছুন (ব্যর্থগুলোসহ)',
      confirmClearTitle: 'সব ফলাফল মুছে ফেলার নিশ্চিতকরণ (অপরিবর্তনীয়)',
      clearConfirmTip: 'প্রকৃত মুছতে আবার ক্লিক করুন; ৬ সেকেন্ডে স্বতঃবাতিল',
      clearedToast: 'সব ফলাফল মুছে ফেলা হয়েছে',
      clearFailedToast: 'মুছতে ব্যর্থ, পরে চেষ্টা করুন',
      clearRowTitle: 'এই মডেলের ফলাফল মুছুন',
      clearRowAria: '{0}-এর ফলাফল মুছুন',
      closeTitle: 'বন্ধ (Esc)',
      close: 'বন্ধ',
      themeToLight: 'লাইট থিম — ডার্কের জন্য ক্লিক',
      themeToDark: 'ডার্ক থিম — লাইটের জন্য ক্লিক',
      langTitle: 'ইন্টারফেস ভাষা',
      tabAll: 'সব',
      tabAllBadge: 'সব',
      groupAllModels: 'সব মডেল',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'বিশ্ব সেরা ১০০ (শুধু প্রদর্শন; স্থানীয় খোঁজে সারিতে ক্লিক)',
      scrollLeft: 'বামে স্ক্রল',
      scrollRight: 'ডানে স্ক্রল',
      loadingCatalog: 'প্রোভাইডার ও মডেল লোড হচ্ছে… (DSH শুরুর পরে কয়েক সেকেন্ড)',
      retryLoad: 'আবার চেষ্টা',
      backendEmpty1: 'ব্যাকএন্ড সংযুক্ত, কিন্তু কোনো প্রোভাইডার নেই।',
      backendEmpty2: 'DSH এইমাত্র রিস্টার্ট হলে প্রোভাইডাররা প্রস্তুত হচ্ছে; লগইনও দেখুন।',
      groupEmpty: 'এই গ্রুপে কোনো মডেল নেই',
      searchBanner: '\"{0}\" খোঁজা — {1}টি মডেল মিলেছে',
      noMatch: '\"{0}\"-এর সাথে মেলে এমন মডেল নেই',
      clearSearch: 'পরিষ্কার',
      untested: 'অপরীক্ষিত',
      testing: 'পরীক্ষা চলছে',
      probeBtn: 'পরীক্ষা',
      reasonTimeout: 'সময় শেষ',
      reasonUnreachable: 'অ্যাক্সেসযোগ্য নয়',
      reasonForbidden: 'সীমাবদ্ধ',
      reasonQuota: 'কোটা',
      reasonNoKey: 'কী নেই',
      reasonNotReady: 'প্রস্তুত নয়',
      reasonEmpty: 'খালি উত্তর',
      reasonFail: 'পরীক্ষা ব্যর্থ',
      estimate: ' (আনুমানিক)',
      estimateLegacyTitle:
        'পুরোনো সংস্করণের আনুমানিক মান (প্রকৃত পরিমাপ নয়); DSH রিস্টার্টে স্বয়ংক্রিয়ভাবে মুছে যাবে',
      medianTip: '{0}টির মধ্যমা, TTFT বিচরণ {1} ms',
      measuredAt: 'পরিমাপ {0}',
      agoMinutes: '{0} মিনিট আগে',
      agoHours: '{0} ঘণ্টা আগে',
      agoDays: '{0} দিন আগে',
      agoLong: '৩০ দিনের বেশি আগে',
      justNow: 'এইমাত্র',
      showAll: 'সব দেখান',
      loadMore: 'আরও লোড ({0} / {1})',
      collapse: 'সংকুচিত (প্রথম {0}টিতে)',
      reasoningTagTip: 'রিজনিং সমর্থিত (স্তর ইনপুট বক্সের রিজনিং মেনুতে বদলান)',
      unknownProvider: 'অজানা প্রোভাইডার',
      unnamedModel: 'নামহীন মডেল',
      selectModel: 'মডেল নির্বাচন',
      selectModelAria: 'একটি মডেল নির্বাচন করুন',
      fallbackTitle: 'Model Master — নেটিভ মডেল বোতাম অন্য প্লাগইন দখল করলে বিকল্প প্রবেশপথ',
      boundaryError: 'Model Master লোড ব্যর্থ: {0}\nপুনরায় চেষ্টা করতে ক্লিক করুন',
      navHint: 'নেভিগেট',
      pickHint: 'মডেল নির্বাচন',
      closeHint: 'বন্ধ',
      tabHint: 'ফোকাস চক্র',
      boardHeader: 'প্রকৃত স্কোরসহ {0}টি মডেল · স্থানীয় খোঁজে সারিতে ক্লিক',
      boardEmptyHeader: 'র‍্যাংকিং ডেটা নেই — ডানে সিঙ্ক করুন',
      boardSync: 'সর্বশেষ সিঙ্ক',
      boardSyncing: 'সিঙ্ক হচ্ছে…',
      boardEmpty: 'ডেটা নেই। OpenRouter থেকে প্রকৃত স্কোর আনতে "সর্বশেষ সিঙ্ক" চাপুন।',
      boardSource: 'উৎস: ',
      boardStale: ' · ২৪ ঘণ্টার পুরোনো — সিঙ্ক করুন',
      boardUpdated: ' · হালনাগাদ {0}',
      boardAge: ' ({0})',
      searchLocal: 'স্থানীয় খোঁজ',
      searchLocalTip: 'স্থানীয় মডেলগুলোতে একই নাম খুঁজুন',
      rowClickTip: 'সারি ক্লিক: একই নামের স্থানীয় চ্যানেল খুঁজুন',
      rowAria: '{0} নম্বর {1} — স্থানীয় খোঁজতে সক্রিয় করুন',
      intMetric: 'বুদ্ধি {0}',
      tipVendor: 'প্রোভাইডার: {0}',
      tipInt: 'বুদ্ধিমত্তা: {0}',
      tipCoding: 'কোডিং: {0}',
      tipAgentic: 'এজেন্ট: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'প্রসঙ্গ: {0}',
      tipPrice: 'মূল্য: {0} / {1} প্রতি মিলিয়ন টোকেন',
      switchedTo: 'পরিবর্তিত: {0}',
      switchedBest: '[{0}]-এর সেরা: {1}',
      switchedBestNode: 'সেরা নোডে: {0}',
      noTestData: '"{0}"-এর পরীক্ষার ডেটা নেই — আগে পরীক্ষা করুন!',
      searchedLocal: '"{0}" স্থানীয়ভাবে খোঁজা হয়েছে — চ্যানেল নিজেই বেছে নিন',
      syncedOk: 'OpenRouter থেকে র‍্যাংকিং সিঙ্ক হয়েছে',
      syncedFail: 'সিঙ্ক ব্যর্থ: OpenRouter অ্যাক্সেসযোগ্য নয়, ক্যাশ দেখানো হচ্ছে',
      switchFail: 'পরিবর্তন ব্যর্থ: {0}',
      switchError: 'পরিবর্তনে ত্রুটি: {0}',
      sessionLocked: 'এই সেশনে মডেল বদলানো যাবে না',
      channelNotReady: 'চ্যানেল প্রস্তুত নয়',
      batchDone: 'ব্যাচ পরীক্ষা শেষ: সফল {0} · ব্যর্থ {1}',
      batchAborted: ' (ম্যানুয়ালি থামানো)',
      batchDedupeNote: '; একই নামের চ্যানেলগুলোর প্রথমটিই পরীক্ষিত',
      probeUnreachable: 'পরীক্ষা সেবা অ্যাক্সেসযোগ্য নয়: DSH চালু ও স্থানীয় অ্যাক্সেস নিশ্চিত করুন',
      probe403: 'প্লাগইন ব্যাকএন্ড শুধু স্থানীয় (403)',
      catalog403: 'তালিকা ব্যর্থ: ব্যাকএন্ড শুধু স্থানীয় (403)। 127.0.0.1 থেকে DSH খুলুন',
      catalogHttp: 'তালিকা ব্যর্থ (HTTP {0})',
      catalogUnreachable: 'তালিকা ব্যর্থ: প্লাগইন ব্যাকএন্ডে পৌঁছানো যাচ্ছে না (DSH চলছে?)',
      seatToastOk: '\"{0}\"-এ পরিবর্তিত {1}',
      subtitle: '· {0} চ্যানেল · {1} মডেল',
      catalogLoadingSub: '· তালিকা লোড হচ্ছে…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter মডেল তালিকা · Artificial Analysis সূচক + Design Arena Elo (দৈনিক সিঙ্ক)',
      boardSourceOffline: 'OpenRouter মডেল তালিকা (অফলাইন — কোনো স্কোর করা ডেটা নেই)',
      boardSourcePending: 'এখনও ডেটা নেই · প্রথম সিঙ্কের অপেক্ষায় (OpenRouter মডেল তালিকা)',
      boardSourceAATip: 'সরকারি Artificial Analysis লিডারবোর্ড খুলুন — বুদ্ধি/কোডিং/এজেন্ট সূচকের মূল উৎস',
      boardSourceDATip: 'সরকারি Design Arena লিডারবোর্ড খুলুন — ব্লাইন্ড-টেস্ট Elo-র মূল উৎস'
    }

    I18N.ur = {
      title: 'ماڈل منتخب کریں',
      searchPlaceholder: 'ماڈل، فراہم کنندہ یا سوچ کا موڈ تلاش کریں...',
      sortSmart: 'بہترین مجموعی اسکور',
      sortTtft: 'تیز ترین پہلا ٹوکن (TTFT)',
      sortTps: 'زیادہ ترین تھرو پٹ (TPS)',
      sortDefault: 'پہلے سے طے شدہ ترتیب',
      probeFast: 'جانچ ×1 تیز',
      probeStable: 'جانچ ×3 مستحکم',
      probeFastTip: 'اکیلی: تیز ترین، ~17-22% فرق',
      probeStableTip: 'تین کا وسطی: زیادہ مستحکم، ~3× وقت و کوٹہ',
      batchStop: 'روکیں ({0} جاری)',
      batchConfirm: 'تصدیق کے لیے دوبارہ کلک ({0})',
      batchProbe: 'جانچ ({0})',
      batchStopTitle: 'جاری بیچ جانچ روکیں',
      batchTip: '"{0}" کے {1} ماڈل باری باری اسٹریم جانچ (~3-6 سیکنڈ فی ماڈل، 20 سیکنڈ ٹائم آؤٹ، 2 متوازی)',
      batchTestingPill: 'جانچ {0}',
      batchTestingTitle: 'بیچ جانچ جاری ہے',
      smartPick: 'بہترین · {0}',
      smartTag: 'سمارٹ انتخاب',
      apply: 'لاگو کریں',
      scopeAll: 'عالمگیر',
      scopeSearch: 'تلاش کے نتائج',
      clearAll: 'نتائج صاف کریں',
      confirmClearAll: 'مکمل صاف کرنے کی تصدیق',
      cancel: 'منسوخ',
      clearAllTitle: 'محفوظ تمام نتائج حذف کریں (ناکام بھی)',
      confirmClearTitle: 'تمام نتائج حذف کرنے کی تصدیق (واپسی ممکن نہیں)',
      clearConfirmTip: 'حقیقی حذف کے لیے دوبارہ کلک؛ 6 سیکنڈ میں خود بخود منسوخ',
      clearedToast: 'تمام نتائج حذف ہو گئے',
      clearFailedToast: 'حذف کرنے میں ناکامی',
      clearRowTitle: 'اس ماڈل کا نتیجہ حذف کریں',
      clearRowAria: '{0} کا نتیجہ حذف کریں',
      closeTitle: 'بند کریں (Esc)',
      close: 'بند کریں',
      themeToLight: 'ہلکا موڈ — گہرا کرنے کلک کریں',
      themeToDark: 'گہرا موڈ — ہلکا کرنے کلک کریں',
      langTitle: 'انٹرفیس زبان',
      tabAll: 'سب',
      tabAllBadge: 'سب',
      groupAllModels: 'تمام ماڈل',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'عالمی سرفہرست 100 (صرف نمائش؛ مقامی تلاش کے لیے قطار پر کلک)',
      scrollLeft: 'بائیں سکرول',
      scrollRight: 'دائیں سکرول',
      loadingCatalog: 'فراہم کنندگان اور ماڈل لوڈ ہو رہے ہیں… (DSH شروع ہونے کے بعد چند سیکنڈ)',
      retryLoad: 'دوبارہ کوشش',
      backendEmpty1: 'بیک اینڈ دستیاب مگر کوئی فراہم کنندہ نہیں ملا۔',
      backendEmpty2: 'اگر DSH ابھی ری اسٹارٹ ہوا ہے تو فراہم کنندگان تیار ہو رہے ہوں گے؛ لاگ ان بھی دیکھیں۔',
      groupEmpty: 'اس گروپ میں کوئی ماڈل نہیں',
      searchBanner: '\"{0}\" تلاش — {1} ماڈل ملے',
      noMatch: '\"{0}\" سے ملتا کوئی ماڈل نہیں',
      clearSearch: 'صاف کریں',
      untested: 'غیر جانچا',
      testing: 'جانچ جاری',
      probeBtn: 'جانچ',
      reasonTimeout: 'وقت ختم',
      reasonUnreachable: 'دسترس نہیں',
      reasonForbidden: 'محدود',
      reasonQuota: 'کوٹہ',
      reasonNoKey: 'کی نہیں',
      reasonNotReady: 'تیار نہیں',
      reasonEmpty: 'خالی جواب',
      reasonFail: 'جانچ ناکام',
      estimate: ' (اندازہ)',
      estimateLegacyTitle: 'پرانے ورژن کا اندازہ (حقیقی پیمائش نہیں)؛ DSH ری اسٹارٹ پر خودکار حذف',
      medianTip: '{0} کا وسطی، TTFT فرق {1} ms',
      measuredAt: 'ناپا {0}',
      agoMinutes: '{0} منٹ پہلے',
      agoHours: '{0} گھنٹے پہلے',
      agoDays: '{0} دن پہلے',
      agoLong: '30 دن سے زیادہ پہلے',
      justNow: 'ابھی',
      showAll: 'سب دکھائیں',
      loadMore: 'مزید لوڈ ({0} / {1})',
      collapse: 'سکیڑیں (پہلے {0} پر)',
      reasoningTagTip: 'سوچ کی حمایت کرتا ہے (درجہ ان پٹ باکس کے سوچ مینو میں تبدیل کریں)',
      unknownProvider: 'نامعلوم فراہم کنندہ',
      unnamedModel: 'بے نام ماڈل',
      selectModel: 'ماڈل منتخب کریں',
      selectModelAria: 'براہ کرم ماڈل منتخب کریں',
      fallbackTitle: 'Model Master — جب کوئی اور پلگ ان مقامی ماڈل بٹن پر قبضہ کرے تب متبادل داخلہ',
      boundaryError: 'Model Master لوڈ ناکام: {0}\nدوبارہ کوشش کے لیے کلک کریں',
      navHint: 'نیویگیٹ',
      pickHint: 'ماڈل منتخب',
      closeHint: 'بند',
      tabHint: 'فوکس چکر',
      boardHeader: 'حقیقی اسکور والے {0} ماڈل · مقامی تلاش کے لیے قطار پر کلک',
      boardEmptyHeader: 'درجہ بندی کا ڈیٹا نہیں — دائیں سے ہم آہنگ کریں',
      boardSync: 'تازہ ہم آہنگ',
      boardSyncing: 'ہم آہنگ ہو رہا ہے…',
      boardEmpty: 'کوئی ڈیٹا نہیں۔ OpenRouter سے حقیقی اسکور لانے "تازہ ہم آہنگ" دبائیں۔',
      boardSource: 'ذریعہ: ',
      boardStale: ' · 24 گھنٹے سے پرانا — ہم آہنگی کریں',
      boardUpdated: ' · تازہ کاری {0}',
      boardAge: ' ({0})',
      searchLocal: 'مقامی تلاش',
      searchLocalTip: 'مقامی ماڈلز میں وہی نام تلاش کریں',
      rowClickTip: 'قطار کلک: اسی نام کے مقامی چینل تلاش کریں',
      rowAria: 'نمبر {0} {1} — مقامی تلاش کے لیے فعال کریں',
      intMetric: 'ذہانت {0}',
      tipVendor: 'فراہم کنندہ: {0}',
      tipInt: 'ذہانت: {0}',
      tipCoding: 'کوڈنگ: {0}',
      tipAgentic: 'ایجنٹ: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'سیاق: {0}',
      tipPrice: 'قیمت: {0} / {1} فی ملین ٹوکن',
      switchedTo: 'تبدیل ہوا: {0}',
      switchedBest: '[{0}] کا بہترین: {1}',
      switchedBestNode: 'بہترین نوڈ پر: {0}',
      noTestData: '"{0}" کا جانچ ڈیٹا نہیں — پہلے جانچیں!',
      searchedLocal: '"{0}" مقامی طور پر تلاش کیا گیا — چینل خود منتخب کریں',
      syncedOk: 'OpenRouter سے درجہ بندی ہم آہنگ ہوئی',
      syncedFail: 'ہم آہنگی ناکام: OpenRouter دسترس نہیں، کیش دکھایا جا رہا ہے',
      switchFail: 'تبدیلی ناکام: {0}',
      switchError: 'تبدیلی میں خرابی: {0}',
      sessionLocked: 'اس سیشن میں ماڈل نہیں بدلا جا سکتا',
      channelNotReady: 'چینل تیار نہیں',
      batchDone: 'بیچ جانچ مکمل: کامیاب {0} · ناکام {1}',
      batchAborted: ' (دستی طور پر روکا)',
      batchDedupeNote: '؛ ہم نام چینلز میں صرف پہلا جانچا جاتا ہے',
      probeUnreachable: 'جانچ سروس دسترس نہیں: DSH چل رہا ہو اور مقامی رسائی ہو',
      probe403: 'پلگ ان بیک اینڈ صرف مقامی (403)',
      catalog403: 'فہرست ناکام: بیک اینڈ صرف مقامی (403)۔ 127.0.0.1 سے DSH کھولیں',
      catalogHttp: 'فہرست ناکام (HTTP {0})',
      catalogUnreachable: 'فہرست ناکام: پلگ ان بیک اینڈ دسترس نہیں (DSH چل رہا ہے؟)',
      seatToastOk: '\"{0}\" پر تبدیل {1}',
      subtitle: '· {0} چینلز · {1} ماڈل',
      catalogLoadingSub: '· فہرست لوڈ ہو رہی ہے…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'OpenRouter ماڈل فہرست · Artificial Analysis اشاریے + Design Arena Elo (روزانہ ہم آہنگی)',
      boardSourceOffline: 'OpenRouter ماڈل فہرست (آف لائن — کوئی اسکور شدہ ڈیٹا دستیاب نہیں)',
      boardSourcePending: 'ابھی کوئی ڈیٹا نہیں · پہلی ہم آہنگی کا انتظار (OpenRouter ماڈل فہرست)',
      boardSourceAATip: 'سرکاری Artificial Analysis لیڈر بورڈ کھولیں — ذہانت/کوڈنگ/ایجنٹ اشاریوں کا اصل ماخذ',
      boardSourceDATip: 'سرکاری Design Arena لیڈر بورڈ کھولیں — بلائنڈ ٹیسٹ Elo کا اصل ماخذ'
    }

    I18N.id = {
      title: 'Pilih Model',
      searchPlaceholder: 'Cari model, penyedia, atau mode penalaran...',
      sortSmart: 'Skor gabungan terbaik',
      sortTtft: 'Token pertama tercepat (TTFT)',
      sortTps: 'Throughput tertinggi (TPS)',
      sortDefault: 'Urutan bawaan',
      probeFast: 'Uji ×1 cepat',
      probeStable: 'Uji ×3 stabil',
      probeFastTip: 'Tunggal: tercepat, variasi ~17-22%',
      probeStableTip: 'Median dari tiga: lebih stabil, ~3× waktu & kuota',
      batchStop: 'Hentikan ({0} berjalan)',
      batchConfirm: 'Klik lagi untuk konfirmasi ({0})',
      batchProbe: 'Uji ({0})',
      batchStopTitle: 'Hentikan uji massal',
      batchTip: 'Uji streaming {1} model "{0}" satu per satu (~3-6 dtk, batas 20 dtk, 2 paralel)',
      batchTestingPill: 'Menguji {0}',
      batchTestingTitle: 'Uji massal berjalan',
      smartPick: 'Terbaik · {0}',
      smartTag: 'Pilihan pintar',
      apply: 'Terapkan',
      scopeAll: 'Global',
      scopeSearch: 'hasil pencarian',
      clearAll: 'Bersihkan hasil',
      confirmClearAll: 'Konfirmasi bersihkan semua',
      cancel: 'Batal',
      clearAllTitle: 'Hapus semua hasil tersimpan (termasuk gagal)',
      confirmClearTitle: 'Konfirmasi hapus SEMUA hasil (tak bisa dibatalkan)',
      clearConfirmTip: 'Klik lagi untuk benar-benar menghapus; batal otomatis 6 dtk',
      clearedToast: 'Semua hasil dihapus',
      clearFailedToast: 'Gagal menghapus, coba lagi',
      clearRowTitle: 'Hapus hasil uji model ini',
      clearRowAria: 'Hapus hasil uji {0}',
      closeTitle: 'Tutup (Esc)',
      close: 'Tutup',
      themeToLight: 'Tema terang — klik untuk gelap',
      themeToDark: 'Tema gelap — klik untuk terang',
      langTitle: 'Bahasa antarmuka',
      tabAll: 'Semua',
      tabAllBadge: 'Semua',
      groupAllModels: 'Semua model',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: '100 besar dunia (hanya tampilan; klik baris untuk cari kanal lokal)',
      scrollLeft: 'Gulir kiri',
      scrollRight: 'Gulir kanan',
      loadingCatalog: 'Memuat penyedia & model… (beberapa detik setelah DSH mulai)',
      retryLoad: 'Coba lagi',
      backendEmpty1: 'Backend terjangkau, tapi tidak mengembalikan penyedia.',
      backendEmpty2: 'Jika DSH baru restart, penyedia mungkin masih inisialisasi; cek juga login penyedia.',
      groupEmpty: 'Tidak ada model di grup ini',
      searchBanner: 'Cari \"{0}\" — {1} model cocok',
      noMatch: 'Tidak ada model untuk \"{0}\"',
      clearSearch: 'Bersihkan',
      untested: 'Belum diuji',
      testing: 'Menguji',
      probeBtn: 'Uji',
      reasonTimeout: 'Waktu habis',
      reasonUnreachable: 'Tak terjangkau',
      reasonForbidden: 'Dibatasi',
      reasonQuota: 'Kuota',
      reasonNoKey: 'Tanpa kunci',
      reasonNotReady: 'Belum siap',
      reasonEmpty: 'Balasan kosong',
      reasonFail: 'Uji gagal',
      estimate: ' (perkiraan)',
      estimateLegacyTitle: 'Perkiraan versi lama (bukan pengukuran); dihapus otomatis saat DSH restart',
      medianTip: 'Median dari {0}, rentang TTFT {1} ms',
      measuredAt: 'diukur {0}',
      agoMinutes: '{0} mnt lalu',
      agoHours: '{0} jam lalu',
      agoDays: '{0} hari lalu',
      agoLong: 'lebih dari 30 hari lalu',
      justNow: 'baru saja',
      showAll: 'Tampilkan semua',
      loadMore: 'Muat lebih ({0} / {1})',
      collapse: 'Ciutkan (kembali ke {0} pertama)',
      reasoningTagTip: 'Mendukung penalaran (atur level di menu penalaran komposer)',
      unknownProvider: 'Penyedia tidak dikenal',
      unnamedModel: 'Model tanpa nama',
      selectModel: 'Pilih model',
      selectModelAria: 'Pilih sebuah model',
      fallbackTitle: 'Model Master — pintu darurat saat tombol model asli dikuasai plugin lain',
      boundaryError: 'Model Master gagal dimuat: {0}\nKlik untuk mencoba lagi',
      navHint: 'navigasi',
      pickHint: 'pilih model',
      closeHint: 'tutup',
      tabHint: 'putar fokus',
      boardHeader: '{0} model berskor nyata · klik baris untuk cari kanal lokal',
      boardEmptyHeader: 'Belum ada data papan — sinkronkan di kanan',
      boardSync: 'Sinkron terbaru',
      boardSyncing: 'Menyinkron…',
      boardEmpty: 'Belum ada data. Klik "Sinkron terbaru" untuk ambil skor nyata dari OpenRouter.',
      boardSource: 'Sumber: ',
      boardStale: ' · lebih dari 24 jam — sebaiknya sinkron',
      boardUpdated: ' · diperbarui {0}',
      boardAge: ' ({0})',
      searchLocal: 'Cari lokal',
      searchLocalTip: 'Cari nama sama di daftar model lokal',
      rowClickTip: 'Klik baris: cari kanal lokal bernama sama',
      rowAria: 'No.{0} {1} — aktifkan untuk cari lokal',
      intMetric: 'Int {0}',
      tipVendor: 'Penyedia: {0}',
      tipInt: 'Kecerdasan: {0}',
      tipCoding: 'Koding: {0}',
      tipAgentic: 'Agen: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Konteks: {0}',
      tipPrice: 'Harga: {0} / {1} per juta token',
      switchedTo: 'Beralih ke: {0}',
      switchedBest: 'Terbaik [{0}] diterapkan: {1}',
      switchedBestNode: 'Beralih ke node terbaik: {0}',
      noTestData: '"{0}" belum punya data uji — uji dulu!',
      searchedLocal: '"{0}" dicari lokal — pilih kanalnya sendiri',
      syncedOk: 'Papan peringkat disinkron dari OpenRouter',
      syncedFail: 'Sinkron gagal: OpenRouter tak terjangkau, menampilkan cache',
      switchFail: 'Gagal beralih: {0}',
      switchError: 'Kesalahan beralih: {0}',
      sessionLocked: 'Tidak bisa ganti model di sesi ini',
      channelNotReady: 'kanal belum siap',
      batchDone: 'Uji massal selesai: {0} sukses · {1} gagal',
      batchAborted: ' (dihentikan)',
      batchDedupeNote: '; nama sama hanya diuji di kanal pertama',
      probeUnreachable: 'Layanan uji tak terjangkau: pastikan DSH berjalan & akses lokal',
      probe403: 'Backend plugin hanya lokal (403)',
      catalog403: 'Katalog gagal: backend hanya lokal (403). Buka DSH dari 127.0.0.1',
      catalogHttp: 'Katalog gagal (HTTP {0})',
      catalogUnreachable: 'Katalog gagal: backend plugin tak terjangkau (DSH jalan?)',
      seatToastOk: 'Beralih ke \"{0}\" {1}',
      subtitle: '· {0} kanal · {1} model',
      catalogLoadingSub: '· memuat katalog…',
      effortSuffix: ' · {0}',
      boardSourceLive: 'Katalog model OpenRouter · indeks Artificial Analysis + Elo Design Arena (sinkron harian)',
      boardSourceOffline: 'Katalog model OpenRouter (offline — tidak ada data berskor)',
      boardSourcePending: 'Belum ada data · menunggu sinkronisasi pertama (katalog model OpenRouter)',
      boardSourceAATip: 'Buka papan peringkat resmi Artificial Analysis — sumber asli indeks kecerdasan/koding/agen',
      boardSourceDATip: 'Buka papan peringkat resmi Design Arena — sumber asli Elo uji buta'
    }

    I18N.tr = {
      title: 'Model Seç',
      searchPlaceholder: 'Model, sağlayıcı veya akıl yürütme modu ara...',
      sortSmart: 'En yüksek bileşik puan',
      sortTtft: 'En hızlı ilk belirteç (TTFT)',
      sortTps: 'En yüksek verim (TPS)',
      sortDefault: 'Varsayılan sıra',
      probeFast: 'Ölçüm ×1 hızlı',
      probeStable: 'Ölçüm ×3 kararlı',
      probeFastTip: 'Tek: en hızlı, ~%17-22 sapma',
      probeStableTip: 'Üçün ortancası: daha kararlı, ~3× süre/kota',
      batchStop: 'Durdur ({0} sürüyor)',
      batchConfirm: 'Onaylamak için tekrar tıkla ({0})',
      batchProbe: 'Ölçüm ({0})',
      batchStopTitle: 'Sürülmüş toplu ölçümü durdur',
      batchTip: '"{0}" hesabının {1} modelini sırayla akış-ölç (~3-6 sn, 20 sn zaman aşımı, 2 paralel)',
      batchTestingPill: 'Ölçüyor {0}',
      batchTestingTitle: 'Toplu ölçüm sürüyor',
      smartPick: 'En iyisi · {0}',
      smartTag: 'Akıllı seçim',
      apply: 'Uygula',
      scopeAll: 'Global',
      scopeSearch: 'arama sonuçları',
      clearAll: 'Sonuçları temizle',
      confirmClearAll: 'Tümünü silmeyi onayla',
      cancel: 'İptal',
      clearAllTitle: 'Kayıtlı tüm ölçüm sonuçlarını sil (başarısızlar dahil)',
      confirmClearTitle: 'TÜM sonuçları silmeyi onayla (geri alınamaz)',
      clearConfirmTip: 'Gerçek silme için tekrar tıkla; 6 sn sonra iptal',
      clearedToast: 'Tüm ölçüm sonuçları silindi',
      clearFailedToast: 'Silme başarısız, tekrar dene',
      clearRowTitle: 'Bu modelin ölçüm sonucunu sil',
      clearRowAria: '{0} ölçüm sonucunu sil',
      closeTitle: 'Kapat (Esc)',
      close: 'Kapat',
      themeToLight: 'Açık tema — koyu için tıkla',
      themeToDark: 'Koyu tema — açık için tıkla',
      langTitle: 'Arayüz dili',
      tabAll: 'Tümü',
      tabAllBadge: 'Tümü',
      groupAllModels: 'Tüm modeller',
      scopeGroup: '\"{0}\"',
      boardName: 'TOP100',
      boardBtnTitle: 'Dünya ilk 100 (yalnızca gösterim; yerel arama için satıra tıkla)',
      scrollLeft: 'Sola kaydır',
      scrollRight: 'Sağa kaydır',
      loadingCatalog: 'Sağlayıcılar ve modeller yükleniyor… (DSH başlangıcından sonra birkaç sn)',
      retryLoad: 'Yeniden dene',
      backendEmpty1: 'Backend erişilebilir ama sağlayıcı döndürmedi.',
      backendEmpty2: 'DSH yeni başlatıldıysa sağlayıcılar hâlâ hazırlanıyor olabilir; giriş bilgilerini de kontrol et.',
      groupEmpty: 'Bu grupta model yok',
      searchBanner: '\"{0}\" arandı — {1} model bulundu',
      noMatch: '\"{0}\" ile eşleşen model yok',
      clearSearch: 'Temizle',
      untested: 'Ölçülmedi',
      testing: 'Ölçülüyor',
      probeBtn: 'Ölç',
      reasonTimeout: 'Zaman aşımı',
      reasonUnreachable: 'Erişilemiyor',
      reasonForbidden: 'Kısıtlı',
      reasonQuota: 'Kota',
      reasonNoKey: 'Anahtar yok',
      reasonNotReady: 'Hazır değil',
      reasonEmpty: 'Boş yanıt',
      reasonFail: 'Ölçüm başarısız',
      estimate: ' (tahmini)',
      estimateLegacyTitle: 'Eski sürüm tahmini (gerçek ölçüm değil); DSH yeniden başlatınca otomatik silinir',
      medianTip: '{0} koşunun ortancası, TTFT sapması {1} ms',
      measuredAt: 'ölçüldü {0}',
      agoMinutes: '{0} dk önce',
      agoHours: '{0} sa önce',
      agoDays: '{0} gün önce',
      agoLong: '30 günden uzun önce',
      justNow: 'şimdi',
      showAll: 'Tümünü göster',
      loadMore: 'Daha fazla ({0} / {1})',
      collapse: 'Daralt (ilk {0}e dön)',
      reasoningTagTip: 'Akıl yürütmeyi destekler (düzeyi giriş kutusunun akıl yürütme menüsünden seçin)',
      unknownProvider: 'Bilinmeyen sağlayıcı',
      unnamedModel: 'Adsız model',
      selectModel: 'Model seç',
      selectModelAria: 'Lütfen bir model seçin',
      fallbackTitle: 'Model Master — yerel model düğmesini başka eklenti işgal ettiğinde yedek giriş',
      boundaryError: 'Model Master yüklenemedi: {0}\nTekrar denemek için tıkla',
      navHint: 'gezin',
      pickHint: 'model seç',
      closeHint: 'kapat',
      tabHint: 'odak döngüsü',
      boardHeader: 'Gerçek puanlı {0} model · satıra tıkla, yerelde aynı ismi ara',
      boardEmptyHeader: 'Sıralama verisi yok — sağdan eşitle',
      boardSync: 'En yenisini eşitle',
      boardSyncing: 'Eşitleniyor…',
      boardEmpty: 'Veri yok. OpenRouter`dan gerçek puanlar için "En yenisini eşitle"ye bas.',
      boardSource: 'Kaynak: ',
      boardStale: ' · 24 saatten eski — eşitleme önerilir',
      boardUpdated: ' · güncellendi {0}',
      boardAge: ' ({0})',
      searchLocal: 'Yerelde ara',
      searchLocalTip: 'Yerel model listesinde aynı adı ara',
      rowClickTip: 'Satıra tıkla: aynı adlı yerel kanalları ara',
      rowAria: '{0}. sıra {1} — etkinleştir, yerelde ara',
      intMetric: 'Zekâ {0}',
      tipVendor: 'Sağlayıcı: {0}',
      tipInt: 'Zekâ: {0}',
      tipCoding: 'Kodlama: {0}',
      tipAgentic: 'Ajan: {0}',
      tipArena: 'Arena Elo: {0}{1}',
      tipContext: 'Bağlam: {0}',
      tipPrice: 'Fiyat: {0} / {1} (milyon token başına)',
      switchedTo: 'Geçildi: {0}',
      switchedBest: '[{0}] en iyisi uygulandı: {1}',
      switchedBestNode: 'En iyi düğüme geçildi: {0}',
      noTestData: '"{0}" için ölçüm verisi yok — önce ölç!',
      searchedLocal: '"{0}" yerelde arandı — kanalı kendin seç',
      syncedOk: 'Sıralama OpenRouter`dan eşitlendi',
      syncedFail: 'Eşitleme başarısız: OpenRouter erişilemiyor, önbellek gösteriliyor',
      switchFail: 'Geçiş başarısız: {0}',
      switchError: 'Geçiş hatası: {0}',
      sessionLocked: 'Bu oturumda model değiştirilemez',
      channelNotReady: 'kanal hazır değil',
      batchDone: 'Toplu ölçüm bitti: {0} başarılı · {1} başarısız',
      batchAborted: ' (elle durduruldu)',
      batchDedupeNote: '; aynı isimli kanalların sadece ilki ölçülür',
      probeUnreachable: 'Ölçüm servisine erişilemiyor: DSH çalışıyor ve yerel erişim olduğundan emin ol',
      probe403: "Eklenti backend'i yalnızca yerel erişime izin veriyor (403)",
      catalog403: "Katalog başarısız: backend yalnızca yerel (403). DSH'yi 127.0.0.1'den aç",
      catalogHttp: 'Katalog başarısız (HTTP {0})',
      catalogUnreachable: "Katalog başarısız: eklenti backend'ine erişilemiyor (DSH çalışıyor mu?)",
      seatToastOk: '\"{0}\" hesabına geçildi {1}',
      subtitle: '· {0} kanal · {1} model',
      catalogLoadingSub: '· katalog yükleniyor…',
      effortSuffix: ' · {0}',
      boardSourceLive:
        'OpenRouter model kataloğu · Artificial Analysis endeksleri + Design Arena Elo (günlük eşitleme)',
      boardSourceOffline: 'OpenRouter model kataloğu (çevrimdışı — puanlanmış veri yok)',
      boardSourcePending: 'Henüz veri yok · ilk eşitleme bekleniyor (OpenRouter model kataloğu)',
      boardSourceAATip: 'Resmî Artificial Analysis sıralamasını aç — zekâ/kodlama/ajan endekslerinin asıl kaynağı',
      boardSourceDATip: 'Resmî Design Arena sıralamasını aç — kör test Elo’sunun asıl kaynağı'
    }

    // ── restore the persisted language ─────────────────────────────────────
    // Must run only now that every dictionary above is assigned: `I18N_HAS`
    // validates the saved code against the real table, so restoring earlier
    // would always fall back to zh.
    try {
      var savedLang = localStorage.getItem(UI_LANG_KEY)
      if (savedLang && I18N_HAS(savedLang)) uiLang = savedLang
    } catch {}

    // ── Styles (Scoped CSS injected into head once) ──────────────────────────
    const STYLES = `
      .dmm-seat-container {
        display: inline-flex;
        align-items: center;
        position: relative;
        min-width: 0;
        vertical-align: middle;
      }
      .dmm-trigger-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 9px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: #d4d4d8;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.14s ease;
        outline: none;
        user-select: none;
      }
      .dmm-trigger-btn:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.18);
        color: #ffffff;
      }
      .dmm-trigger-btn:active {
        transform: scale(0.98);
      }
      .dmm-trigger-icon {
        width: 13px;
        height: 13px;
        color: #38bdf8;
        flex-shrink: 0;
      }
      .dmm-trigger-name {
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: inline-block;
        font-family: inherit;
      }
      .dmm-trigger-pill {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-variant-numeric: tabular-nums;
        background: rgba(16, 185, 129, 0.12);
        border: 1px solid rgba(16, 185, 129, 0.25);
        color: #34d399;
      }
      .dmm-trigger-effort {
        display: inline-flex;
        align-items: center;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        /* Fixed accent — the trigger lives on the host UI, outside the
           modal's CSS variable scope */
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.25);
      }
      .dmm-trigger-chevron {
        width: 12px;
        height: 12px;
        color: #71717a;
        margin-left: 1px;
        flex-shrink: 0;
      }

      .dmm-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        animation: dmmFadeIn 0.15s ease-out;
      }
      @keyframes dmmFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes dmmScaleIn {
        from { opacity: 0; transform: scale(0.98) translateY(-4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      /* ── Themes: Precision Palettes ── */
      .dmm-modal,
      .dmm-modal[data-theme="dark"] {
        --dmm-bg-modal: rgba(17, 18, 21, 0.86);
        --dmm-bg-header: rgba(17, 18, 21, 0.62);
        --dmm-bg-toolbar: rgba(17, 18, 21, 0.62);
        --dmm-bg-surface: #181a20;
        --dmm-bg-surface-hover: #20232b;
        --dmm-bg-active: rgba(56, 189, 248, 0.08);
        --dmm-border: rgba(255, 255, 255, 0.07);
        --dmm-border-hover: rgba(255, 255, 255, 0.15);
        --dmm-border-active: rgba(56, 189, 248, 0.45);
        --dmm-text-title: #f4f4f5;
        --dmm-text-body: #a1a1aa;
        --dmm-text-muted: #71717a;
        --dmm-accent: #38bdf8;
        --dmm-accent-hover: #0ea5e9;
        --dmm-accent-text: #09090b;
        --dmm-accent-soft-bg: rgba(56, 189, 248, 0.08);
        --dmm-accent-soft-border: rgba(56, 189, 248, 0.28);
        --dmm-scrollbar-thumb: rgba(255, 255, 255, 0.3);
        --dmm-scrollbar-thumb-hover: rgba(255, 255, 255, 0.5);
      }
      .dmm-modal[data-theme="light"] {
        --dmm-bg-modal: rgba(255, 255, 255, 0.9);
        --dmm-bg-header: rgba(250, 250, 250, 0.72);
        --dmm-bg-toolbar: rgba(255, 255, 255, 0.72);
        --dmm-bg-surface: #f4f4f5;
        --dmm-bg-surface-hover: #e4e4e7;
        --dmm-bg-active: rgba(37, 99, 235, 0.08);
        --dmm-border: #e4e4e7;
        --dmm-border-hover: #d4d4d8;
        --dmm-border-active: #2563eb;
        --dmm-text-title: #18181b;
        --dmm-text-body: #52525b;
        --dmm-text-muted: #71717a;
        --dmm-accent: #2563eb;
        --dmm-accent-hover: #1d4ed8;
        --dmm-accent-text: #ffffff;
        --dmm-accent-soft-bg: rgba(37, 99, 235, 0.07);
        --dmm-accent-soft-border: rgba(37, 99, 235, 0.3);
        --dmm-scrollbar-thumb: #b9b9c2;
        --dmm-scrollbar-thumb-hover: #6e6e78;
      }
      /* Light-theme overrides: warm accents (gold/amber/purple) tuned for
         white backgrounds — the dark-theme hues fail WCAG contrast on light */
      .dmm-modal[data-theme="light"] .dmm-header-lb-btn {
        color: #a16207;
        border-color: rgba(161, 98, 7, 0.35);
        background: rgba(234, 179, 8, 0.1);
      }
      .dmm-modal[data-theme="light"] .dmm-header-lb-btn:hover {
        color: #854d0e;
        border-color: rgba(133, 77, 14, 0.55);
        background: rgba(234, 179, 8, 0.18);
      }
      .dmm-modal[data-theme="light"] .dmm-header-lb-btn.active {
        color: #854d0e;
        border-color: #a16207;
        background: rgba(234, 179, 8, 0.22);
      }
      .dmm-modal[data-theme="light"] .dmm-rank-1 { color: #a16207; }
      .dmm-modal[data-theme="light"] .dmm-lb-stale { color: #b45309; }
      .dmm-modal[data-theme="light"] .dmm-tag-reasoning {
        color: #7e22ce;
        background: rgba(126, 34, 206, 0.08);
      }

      .dmm-modal {
        width: 100%;
        max-width: 820px;
        height: 80vh;
        max-height: 780px;
        background: var(--dmm-bg-modal);
        /* Glassmorphism, as promised: translucent shell over a blurred page */
        backdrop-filter: blur(22px) saturate(1.5);
        -webkit-backdrop-filter: blur(22px) saturate(1.5);
        border: 1px solid var(--dmm-border);
        border-radius: 12px;
        box-shadow:
          0 28px 60px -15px rgba(0, 0, 0, 0.7),
          0 0 0 1px rgba(255, 255, 255, 0.03) inset;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: dmmScaleIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        color: var(--dmm-text-body);
        letter-spacing: -0.01em;
      }

      /* Type scale: 10 / 11 / 12 / 13.5 / 15 — five steps, no half-px mush */

      /* ── Modal Header ── */
      .dmm-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--dmm-border);
        background: var(--dmm-bg-header);
      }
      .dmm-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dmm-header-icon {
        width: 16px;
        height: 16px;
        margin-right: 2px;
        color: var(--dmm-accent);
        flex-shrink: 0;
      }
      .dmm-header-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--dmm-text-title);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dmm-header-sub {
        font-size: 11px;
        color: var(--dmm-text-muted);
        font-weight: 400;
      }
      .dmm-header-right {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      /* ── Icon button (theme toggle & friends) ── */
      .dmm-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 1px solid var(--dmm-border);
        background: transparent;
        color: var(--dmm-text-muted);
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .dmm-icon-btn:hover {
        color: var(--dmm-text-title);
        border-color: var(--dmm-border-hover);
        background: var(--dmm-bg-surface);
      }

      /* Neutral close affordance — red is reserved for destructive actions */
      .dmm-close-btn {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #ef4444;
        font-size: 11px;
        cursor: pointer;
        padding: 3px 7px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.12s ease;
      }
      .dmm-close-btn:hover {
        background: rgba(239, 68, 68, 0.14);
        color: #dc2626;
        border-color: rgba(239, 68, 68, 0.85);
      }
      /* Danger styling lives here now (irreversible confirm) */
      .dmm-danger-btn {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.45);
        color: #ef4444;
        font-size: 11px;
        cursor: pointer;
        padding: 3px 7px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.12s ease;
      }
      .dmm-danger-btn:hover {
        background: rgba(239, 68, 68, 0.14);
        color: #dc2626;
        border-color: rgba(239, 68, 68, 0.85);
      }
      .dmm-kbd {
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: inherit;
        opacity: .85;
      }

      /* ── Toolbar ── */
      .dmm-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--dmm-bg-toolbar);
        border-bottom: 1px solid var(--dmm-border);
      }
      .dmm-search-wrap {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
      }
      .dmm-search-input {
        width: 100%;
        height: 32px;
        padding: 0 28px 0 32px;
        border-radius: 6px;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface);
        color: var(--dmm-text-title);
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.14s ease;
      }
      .dmm-search-input:focus {
        border-color: var(--dmm-border-active);
      }
      .dmm-search-input::placeholder {
        color: var(--dmm-text-muted);
      }
      .dmm-search-icon {
        position: absolute;
        left: 9px;
        top: 8px;
        width: 15px;
        height: 15px;
        color: var(--dmm-text-muted);
        pointer-events: none;
      }
      .dmm-search-clear {
        position: absolute;
        right: 8px;
        top: 7px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--dmm-text-muted);
        cursor: pointer;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dmm-search-clear:hover {
        color: var(--dmm-text-title);
      }

      .dmm-select-sort {
        height: 32px;
        padding: 0 8px;
        border-radius: 6px;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface);
        color: var(--dmm-text-body);
        font-size: 11px;
        outline: none;
        cursor: pointer;
        transition: all 0.14s ease;
      }
      .dmm-select-sort:hover {
        border-color: var(--dmm-border-hover);
        color: var(--dmm-text-title);
      }
      .dmm-select-sort option {
        background: var(--dmm-bg-modal);
        color: var(--dmm-text-title);
      }

      /* Probe-mode select reads as a quiet secondary control — the primary
         accent belongs to the action button, not a mode dropdown */

      .dmm-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 32px;
        padding: 0 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface);
        color: var(--dmm-text-body);
        transition: all 0.14s ease;
        white-space: nowrap;
        user-select: none;
      }
      .dmm-action-btn:hover:not(:disabled) {
        background: var(--dmm-bg-surface-hover);
        border-color: var(--dmm-border-hover);
        color: var(--dmm-text-title);
      }
      .dmm-action-btn:active:not(:disabled) {
        transform: scale(0.98);
      }
      .dmm-action-btn:disabled {
        opacity: .45;
        cursor: not-allowed;
      }
      /* Primary action — the one accent-filled button in the toolbar */
      .dmm-btn-primary {
        background: var(--dmm-accent);
        border-color: var(--dmm-accent);
        color: var(--dmm-accent-text);
        font-weight: 600;
      }
      .dmm-btn-primary:hover:not(:disabled) {
        background: var(--dmm-accent-hover);
        border-color: var(--dmm-accent-hover);
        color: var(--dmm-accent-text);
      }
      .dmm-btn-smart {
        border-color: var(--dmm-accent-soft-border);
        color: var(--dmm-text-title);
      }
      .dmm-btn-smart:hover:not(:disabled) {
        border-color: var(--dmm-accent);
        color: var(--dmm-accent);
        background: var(--dmm-accent-soft-bg);
      }

      /* ── Tabs Bar with Ergonomic Chevrons & Low-Friction Scrollbar ── */
      .dmm-tabs-wrap {
        position: relative;
        overflow: hidden;
        border-bottom: 1px solid var(--dmm-border);
        background: var(--dmm-bg-header);
        display: flex;
        align-items: center;
      }
      .dmm-tabs-nav-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        border-radius: 4px;
        /* Inverted floating pill — bright on dark theme, dark on light theme,
           so the chevrons always stand out from the scrolling tab strip */
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(255, 255, 255, 0.92);
        color: #18181b;
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 5;
        transition: all 0.12s ease;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
      .dmm-tabs-nav-btn.prev { left: 4px; }
      .dmm-tabs-nav-btn.next { right: 4px; }
      .dmm-tabs-nav-btn:hover {
        background: #ffffff;
        border-color: rgba(255, 255, 255, 0.55);
      }
      .dmm-modal[data-theme="light"] .dmm-tabs-nav-btn {
        border-color: rgba(0, 0, 0, 0.35);
        background: rgba(24, 24, 27, 0.92);
        color: #fafafa;
      }
      .dmm-modal[data-theme="light"] .dmm-tabs-nav-btn:hover {
        background: #18181b;
        border-color: rgba(0, 0, 0, 0.6);
      }
      .dmm-tabs {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 32px;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: thin;
        scrollbar-color: var(--dmm-scrollbar-thumb) transparent;
      }
      /* Horizontal strip: 10px hit area with a ~6px visible pill — slim but
         grabbable. Brightens when the tab strip is hovered (Fluent-style
         discoverability), accent-colored while being dragged. */
      .dmm-tabs::-webkit-scrollbar {
        height: 10px;
      }
      .dmm-tabs::-webkit-scrollbar-track {
        background: transparent;
      }
      .dmm-tabs::-webkit-scrollbar-thumb {
        background: var(--dmm-scrollbar-thumb);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .dmm-tabs:hover::-webkit-scrollbar-thumb {
        background: var(--dmm-scrollbar-thumb-hover);
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .dmm-tabs::-webkit-scrollbar-thumb:hover,
      .dmm-tabs::-webkit-scrollbar-thumb:active {
        background: var(--dmm-accent);
        border: 2px solid transparent;
        background-clip: padding-box;
      }

      .dmm-tab {
        padding: 4px 9px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        color: var(--dmm-text-muted);
        transition: all 0.12s ease;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        user-select: none;
        flex-shrink: 0;
      }
      .dmm-tab:hover {
        color: var(--dmm-text-title);
        background: var(--dmm-bg-surface);
      }
      .dmm-tab.active {
        color: var(--dmm-text-title);
        background: var(--dmm-bg-surface-hover);
        border-color: var(--dmm-border);
        font-weight: 600;
      }
      .dmm-tab-badge {
        padding: 0 4px;
        border-radius: 4px;
        font-size: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-variant-numeric: tabular-nums;
        background: var(--dmm-border);
        color: var(--dmm-text-muted);
      }
      .dmm-tab.active .dmm-tab-badge {
        color: var(--dmm-text-title);
      }

      /* ── Leaderboard entry button (header, grouped with actions) ── */
      .dmm-header-lb-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 26px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(234, 179, 8, 0.35);
        background: rgba(234, 179, 8, 0.08);
        color: #eab308;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.12s ease;
      }
      .dmm-header-lb-btn:hover {
        border-color: rgba(234, 179, 8, 0.65);
        background: rgba(234, 179, 8, 0.14);
      }
      .dmm-header-lb-btn.active {
        background: rgba(234, 179, 8, 0.2);
        border-color: #eab308;
      }

      /* ── Content List & Wide Scrollbar ── */
      .dmm-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        /* Firefox: full-width themed scrollbar (auto), not the skinny thin one */
        scrollbar-width: auto;
        scrollbar-color: var(--dmm-scrollbar-thumb) transparent;
      }
      /* Long lists must SCROLL, not shrink: without this every card gets
         flex-compressed to its min-content height (~20px) whenever the
         rendered rows overflow the container — the "cards get tiny when
         there are many models" bug */
      .dmm-content > * {
        flex-shrink: 0;
      }
      /* Vertical list: 14px hit area carrying an ~8px visible pill — the
         transparent-border + background-clip trick documented by Chrome.
         Comfortable to grab, accent-highlighted while dragging. */
      .dmm-content::-webkit-scrollbar {
        width: 14px;
      }
      .dmm-content::-webkit-scrollbar-track {
        background: transparent;
      }
      .dmm-content::-webkit-scrollbar-thumb {
        background: var(--dmm-scrollbar-thumb);
        border-radius: 999px;
        border: 3px solid transparent;
        background-clip: padding-box;
      }
      .dmm-content::-webkit-scrollbar-thumb:hover {
        background: var(--dmm-scrollbar-thumb-hover);
        border: 3px solid transparent;
        background-clip: padding-box;
      }
      .dmm-content::-webkit-scrollbar-thumb:active {
        background: var(--dmm-accent);
        border: 3px solid transparent;
        background-clip: padding-box;
      }

      /* ── Search Banner ── */
      .dmm-search-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        border-radius: 6px;
        background: var(--dmm-bg-surface);
        border: 1px solid var(--dmm-border);
        font-size: 11px;
        color: var(--dmm-text-body);
        margin-bottom: 4px;
      }
      .dmm-search-banner-clear {
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid var(--dmm-border);
        background: transparent;
        color: var(--dmm-text-muted);
        font-size: 11px;
        cursor: pointer;
      }
      .dmm-search-banner-clear:hover {
        color: var(--dmm-text-title);
      }

      .dmm-perf-reason {
        font-size: 10px;
        opacity: .72;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dmm-smart-est {
        font-size: 10px;
        opacity: .7;
        font-weight: 500;
      }

      /* ── Progressive Load Footer ── */
      .dmm-loadmore-wrap {
        display: flex;
        gap: 10px;
        justify-content: center;
        padding: 14px 0 6px;
      }

      .dmm-loadmore-btn {
        padding: 8px 18px;
        border-radius: 6px;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface);
        color: var(--dmm-text-body);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all .15s ease;
      }

      .dmm-loadmore-btn:hover {
        color: var(--dmm-text-title);
        border-color: var(--dmm-border-hover);
      }

      /* ── Smart Recommendation Strip ── */
      .dmm-smart-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: 6px;
        background: var(--dmm-accent-soft-bg);
        border: 1px solid var(--dmm-accent-soft-border);
        margin-bottom: 4px;
      }
      .dmm-smart-info {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        min-width: 0;
      }
      .dmm-smart-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--dmm-accent);
        font-weight: 600;
        font-size: 11px;
        flex-shrink: 0;
      }
      .dmm-smart-text {
        color: var(--dmm-text-title);
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dmm-smart-metrics {
        color: var(--dmm-text-muted);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        flex-shrink: 0;
      }
      .dmm-smart-apply-btn {
        padding: 3px 9px;
        border-radius: 4px;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface-hover);
        color: var(--dmm-text-title);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.12s ease;
        flex-shrink: 0;
      }
      .dmm-smart-apply-btn:hover {
        border-color: var(--dmm-accent);
        color: var(--dmm-accent);
      }

      /* ── Model Cards: Click-to-Select Entire Row ── */
      .dmm-card {
        contain: content;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 12px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: var(--dmm-bg-surface);
        transition: all 0.1s ease;
        cursor: pointer;
        user-select: none;
      }
      .dmm-card:hover, .dmm-card.highlighted {
        background: var(--dmm-bg-surface-hover);
        border-color: var(--dmm-border);
      }
      .dmm-card.active {
        background: var(--dmm-bg-active);
        border-color: var(--dmm-border-active);
      }
      .dmm-card-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
      }
      .dmm-card-name {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--dmm-text-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dmm-card-provider {
        font-size: 11px;
        color: var(--dmm-text-muted);
        white-space: nowrap;
        flex-shrink: 0;
      }
      .dmm-tag-reasoning {
        padding: 1px 5px;
        border-radius: 4px;
        background: rgba(168, 85, 247, 0.1);
        color: #c084fc;
        font-size: 10px;
        font-weight: 500;
        flex-shrink: 0;
      }
      .dmm-card-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .dmm-perf-pill {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-variant-numeric: tabular-nums;
        color: var(--dmm-text-muted);
      }
      .dmm-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dmm-dot-green { background: #10b981; }
      .dmm-dot-yellow { background: #f59e0b; }
      .dmm-dot-orange { background: #f97316; }
      .dmm-dot-red { background: #ef4444; }
      .dmm-dot-gray { background: #52525b; }

      .dmm-btn-probe {
        padding: 2px 7px;
        border-radius: 4px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--dmm-text-muted);
        font-size: 11px;
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .dmm-btn-probe:hover:not(:disabled) {
        background: var(--dmm-border);
        color: var(--dmm-text-title);
      }

      .dmm-active-check {
        width: 16px;
        height: 16px;
        color: var(--dmm-accent);
        flex-shrink: 0;
      }
      .dmm-row-arrow {
        width: 14px;
        height: 14px;
        color: var(--dmm-text-muted);
        opacity: 0;
        transition: opacity 0.1s ease;
        flex-shrink: 0;
      }
      .dmm-card:hover .dmm-row-arrow {
        opacity: 0.6;
      }

      /* ── Leaderboard Table ── */
      .dmm-lb-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        border-radius: 6px;
        background: var(--dmm-bg-surface);
        border: 1px solid var(--dmm-border);
        font-size: 11px;
        color: var(--dmm-text-muted);
        margin-bottom: 4px;
      }
      .dmm-lb-card {
        contain: content;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 12px;
        border-radius: 6px;
        background: var(--dmm-bg-surface);
        border: 1px solid transparent;
        transition: all 0.1s ease;
        cursor: pointer;
      }
      .dmm-lb-card:hover {
        background: var(--dmm-bg-surface-hover);
        border-color: var(--dmm-border);
      }
      .dmm-lb-card:focus-visible {
        outline: 2px solid var(--dmm-accent);
        outline-offset: -2px;
        border-color: var(--dmm-accent);
      }
      .dmm-lb-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
      }
      .dmm-lb-rank {
        width: 22px;
        font-size: 12px;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-variant-numeric: tabular-nums;
        color: var(--dmm-text-muted);
        text-align: center;
        flex-shrink: 0;
      }
      .dmm-rank-1 { color: #eab308; }
      .dmm-rank-2 { color: #94a3b8; }
      .dmm-rank-3 { color: #f97316; }
      .dmm-lb-name {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--dmm-text-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 0 1 auto;
        min-width: 60px;
      }
      .dmm-lb-org {
        font-size: 11px;
        color: var(--dmm-text-muted);
        margin-left: 6px;
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dmm-lb-source {
        font-size: 10px;
        color: var(--dmm-text-body);
        padding: 0 16px 6px;
      }
      .dmm-lb-stale {
        color: #f59e0b;
        font-weight: 600;
        opacity: 1;
      }
      /* Inline verify links — the source names themselves link to the
         official leaderboards their numbers come from */
      .dmm-lb-verify-link {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--dmm-accent);
        font-weight: 500;
        text-decoration: none;
        border-bottom: 1px dotted var(--dmm-accent);
        opacity: 1;
        cursor: pointer;
      }
      .dmm-lb-verify-link:hover {
        color: var(--dmm-accent-hover);
        border-bottom-color: var(--dmm-accent-hover);
      }
      .dmm-lb-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: var(--dmm-text-muted);
        flex-shrink: 0;
      }
      .dmm-lb-right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .dmm-lb-search-hint {
        font-size: 11px;
        color: var(--dmm-accent);
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        white-space: nowrap;
      }

      .dmm-ghost-btn {
        background: transparent;
        border: 1px solid var(--dmm-border);
        color: var(--dmm-text-muted);
        font-size: 11px;
        cursor: pointer;
        padding: 3px 7px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.12s ease;
        white-space: nowrap;
      }
      .dmm-ghost-btn:hover {
        color: var(--dmm-text-title);
        border-color: var(--dmm-border-hover);
        background: var(--dmm-bg-surface);
      }

      /* Two-step confirmation states (never rely on window.confirm) */
      .dmm-header-confirm {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .dmm-btn-warn {
        border-color: rgba(249, 115, 22, 0.6);
        color: #fb923c;
      }
      .dmm-btn-warn:hover:not(:disabled) {
        border-color: #f97316;
        color: #f97316;
      }

      .dmm-empty-state {
        text-align: center;
        padding: 40px 0;
        color: var(--dmm-text-muted);
        font-size: 12px;
      }
      .dmm-empty-icon {
        display: flex;
        justify-content: center;
        margin-bottom: 12px;
        opacity: .32;
        color: var(--dmm-text-title);
      }

      /* ── Keyboard hints footer (Spotlight-style affordance) ── */
      .dmm-footer-hints {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 6px 16px;
        border-top: 1px solid var(--dmm-border);
        background: var(--dmm-bg-toolbar);
        font-size: 10px;
        color: var(--dmm-text-muted);
        user-select: none;
      }
      .dmm-footer-hints kbd {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 4px;
        border: 1px solid var(--dmm-border);
        background: var(--dmm-bg-surface);
        color: var(--dmm-text-body);
        margin-right: 3px;
      }
      .dmm-footer-hints .dmm-hint-sep {
        width: 1px;
        height: 10px;
        background: var(--dmm-border);
      }
      /* Language switcher */
      .dmm-lang-wrap { position: relative; }
      .dmm-lang-btn { width: auto; padding: 0 7px; gap: 3px; }
      .dmm-lang-code {
        font-size: 10px;
        font-weight: 600;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-transform: uppercase;
        color: var(--dmm-accent);
      }
      .dmm-lang-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        min-width: 150px;
        max-height: 240px;
        overflow-y: auto;
        background: var(--dmm-bg-surface);
        border: 1px solid var(--dmm-border-hover);
        border-radius: 8px;
        padding: 4px;
        z-index: 20;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .dmm-lang-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        padding: 5px 8px;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: var(--dmm-text-body);
        font-size: 12px;
        cursor: pointer;
        text-align: start;
        transition: all 0.1s ease;
      }
      .dmm-lang-option:hover { background: var(--dmm-bg-surface-hover); color: var(--dmm-text-title); }
      .dmm-lang-option.active { color: var(--dmm-accent); font-weight: 600; }
      .dmm-lang-check { font-size: 11px; }

      /* Fallback trigger (composer toolbar, outside the modal's variable
         scope): literal colors so it renders correctly on the host UI */
      .dmm-fallback-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 28px;
        padding: 0 11px;
        border-radius: 999px;
        border: 1px solid rgba(125, 125, 135, 0.45);
        background: rgba(127, 127, 135, 0.12);
        color: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        transition: all 0.14s ease;
      }
      .dmm-fallback-btn:hover {
        background: rgba(127, 127, 135, 0.24);
        border-color: rgba(125, 125, 135, 0.75);
      }
      .dmm-fallback-btn:active {
        transform: scale(0.98);
      }

      .dmm-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--dmm-bg-modal);
        color: var(--dmm-text-title);
        padding: 7px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        border: 1px solid var(--dmm-border);
        z-index: 100000;
        animation: dmmToastIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .dmm-seat-toast {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        line-height: 1.4;
        white-space: nowrap;
        pointer-events: none;
        background: var(--dmm-bg-modal, #141416);
        color: var(--dmm-text-title, #f1f5f9);
        border: 1px solid var(--dmm-border, rgba(255, 255, 255, 0.12));
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        z-index: 1000;
        animation: dmmToastIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .dmm-seat-toast.dmm-seat-toast-error {
        border-color: rgba(239, 68, 68, 0.45);
        background: #251214;
        color: #fca5a5;
      }
      .dmm-seat-toast.dmm-seat-toast-success {
        border-color: rgba(16, 185, 129, 0.45);
        background: #0d2218;
        color: #6ee7b7;
      }
      .dmm-seat-toast .dmm-toast-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
      }
      @keyframes dmmToastIn {
        from { opacity: 0; transform: translate(-50%, 6px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }

      /* Narrow screens: tighter chrome, header buttons wrap below the title */
      @media (max-width: 640px) {
        .dmm-backdrop { padding: 10px; }
        .dmm-modal { height: 88vh; max-height: none; }
        .dmm-header { flex-wrap: wrap; row-gap: 6px; padding: 10px 14px; }
        .dmm-toolbar { flex-wrap: wrap; padding: 8px 14px; }
      }
    `

    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (!document.getElementById('dsh-model-master-styles')) {
        const style = document.createElement('style')
        style.id = 'dsh-model-master-styles'
        style.textContent = STYLES
        document.head.appendChild(style)
      }
    }

    // ── Helper: relative time for benchmark freshness ──────────────────────
    function relativeTime(ts) {
      if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return ''
      const diff = Date.now() - ts
      if (diff < 60 * 1000) return t('justNow')
      if (diff < 3600 * 1000) return t('agoMinutes', [Math.floor(diff / 60000)])
      if (diff < 86400 * 1000) return t('agoHours', [Math.floor(diff / 3600000)])
      if (diff < 30 * 86400 * 1000) return t('agoDays', [Math.floor(diff / 86400000)])
      return t('agoLong')
    }

    // ── Inline stroke icon set (symbols instead of emoji) ─────────────────
    const mkIcon =
      children =>
      (size = 14) =>
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true'
          },
          children
        )

    const IcoSun = mkIcon([
      h('circle', { key: 'c', cx: 12, cy: 12, r: 5 }),
      h('line', { key: 'a', x1: 12, y1: 1, x2: 12, y2: 3 }),
      h('line', { key: 'b', x1: 12, y1: 21, x2: 12, y2: 23 }),
      h('line', { key: 'c2', x1: 4.22, y1: 4.22, x2: 5.64, y2: 5.64 }),
      h('line', { key: 'd', x1: 18.36, y1: 18.36, x2: 19.78, y2: 19.78 }),
      h('line', { key: 'e', x1: 1, y1: 12, x2: 3, y2: 12 }),
      h('line', { key: 'f', x1: 21, y1: 12, x2: 23, y2: 12 }),
      h('line', { key: 'g', x1: 4.22, y1: 19.78, x2: 5.64, y2: 18.36 }),
      h('line', { key: 'h', x1: 18.36, y1: 5.64, x2: 19.78, y2: 4.22 })
    ])
    const IcoMoon = mkIcon([h('path', { key: 'm', d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })])
    const IcoPodium = mkIcon([
      h('line', { key: 'a', x1: 18, y1: 20, x2: 18, y2: 10 }),
      h('line', { key: 'b', x1: 12, y1: 20, x2: 12, y2: 4 }),
      h('line', { key: 'c', x1: 6, y1: 20, x2: 6, y2: 14 })
    ])
    const IcoTrash = mkIcon([
      h('polyline', { key: 'a', points: '3 6 5 6 21 6' }),
      h('path', { key: 'b', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
      h('line', { key: 'c', x1: 10, y1: 11, x2: 10, y2: 17 }),
      h('line', { key: 'd', x1: 14, y1: 11, x2: 14, y2: 17 })
    ])
    const IcoZap = mkIcon([h('polygon', { key: 'z', points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })])
    const IcoWarn = mkIcon([
      h('path', {
        key: 'a',
        d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'
      }),
      h('line', { key: 'b', x1: 12, y1: 9, x2: 12, y2: 13 }),
      h('line', { key: 'c', x1: 12, y1: 17, x2: 12.01, y2: 17 })
    ])
    const IcoStop = mkIcon([h('rect', { key: 's', x: 6, y: 6, width: 12, height: 12, rx: 1 })])
    const IcoSpark = mkIcon([
      h('path', { key: 's', d: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z' })
    ])
    const IcoSearch = mkIcon([
      h('circle', { key: 'c', cx: 11, cy: 11, r: 8 }),
      h('line', { key: 'l', x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
    ])
    const IcoRefresh = mkIcon([
      h('polyline', { key: 'a', points: '23 4 23 10 17 10' }),
      h('polyline', { key: 'b', points: '1 20 1 14 7 14' }),
      h('path', { key: 'c', d: 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' })
    ])
    const IcoExternal = mkIcon([
      h('path', { key: 'a', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
      h('polyline', { key: 'b', points: '15 3 21 3 21 9' }),
      h('line', { key: 'c', x1: 10, y1: 14, x2: 21, y2: 3 })
    ])
    const IcoLayers = mkIcon([
      h('path', { key: 'a', d: 'M12 2L2 7l10 5 10-5-10-5z' }),
      h('polyline', { key: 'b', points: '2 17 12 22 22 17' }),
      h('polyline', { key: 'c', points: '2 12 12 17 22 12' })
    ])
    const IcoGlobe = mkIcon([
      h('circle', { key: 'c', cx: 12, cy: 12, r: 10 }),
      h('line', { key: 'e', x1: 2, y1: 12, x2: 22, y2: 12 }),
      h('path', {
        key: 'p',
        d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'
      })
    ])

    // ── Helper: Format Benchmarks ───────────────────────────────────────────
    function formatSpeedBadge(res) {
      if (!res) return { label: t('untested'), dot: 'dmm-dot-gray', ttftText: '', tpsText: '' }
      if (!res.success) {
        const errMsg = res.error || t('reasonFail')
        let shortErr = t('reasonFail')
        if (/timeout|timed out/i.test(errMsg)) shortErr = t('reasonTimeout')
        else if (/不可达|unreachable|network|fetch failed/i.test(errMsg)) shortErr = t('reasonUnreachable')
        else if (/仅允许本机|403/i.test(errMsg)) shortErr = t('reasonForbidden')
        else if (/quota|insufficient/i.test(errMsg)) shortErr = t('reasonQuota')
        else if (/key|auth|unauthorized/i.test(errMsg)) shortErr = t('reasonNoKey')
        else if (/adapter|no model/i.test(errMsg)) shortErr = t('reasonNotReady')
        else if (/empty response/i.test(errMsg)) shortErr = t('reasonEmpty')
        // Show a compact slice of the real reason so users aren't left guessing
        const compact = String(errMsg).replace(/\s+/g, ' ').trim()
        const shortReason = compact.length > 28 ? `${compact.slice(0, 28)}…` : compact
        return {
          label: shortErr,
          title: errMsg,
          reason: shortReason,
          dot: 'dmm-dot-red',
          ttftText: 'ERR',
          tpsText: '',
          error: errMsg
        }
      }

      const ttftSec = (res.ttft / 1000).toFixed(2)
      let dot = 'dmm-dot-green'
      if (res.ttft > 1800) dot = 'dmm-dot-orange'
      else if (res.ttft > 800) dot = 'dmm-dot-yellow'

      // Legacy gateway-ping estimates (fabricated by older versions) are still
      // flagged until the server purges them from the persistent store.
      const isEstimate = res.source === 'gateway-ping'
      const suffix = isEstimate ? t('estimate') : ''
      const estTitle = isEstimate ? t('estimateLegacyTitle') : undefined

      // Multi-sample runs carry a spread figure worth surfacing
      const runs = Number(res.successfulSamples) || 1
      const sampleSuffix = runs > 1 ? ` ×${runs}` : ''
      const spreadTitle =
        typeof res.ttftSpread === 'number' && runs > 1 ? t('medianTip', [runs, res.ttftSpread]) : undefined
      const rel = relativeTime(res.testedAt)
      const freshTitle = rel ? t('measuredAt', [rel]) : undefined
      const title = [freshTitle, estTitle, spreadTitle].filter(Boolean).join(' · ') || undefined

      // Surface staleness inline: measurements older than an hour say so
      const staleSuffix = rel && Date.now() - res.testedAt > 3600 * 1000 ? ` · ${rel}` : ''

      return {
        label: `${ttftSec}s · ${res.tps} t/s${suffix}${sampleSuffix}${staleSuffix}`,
        title,
        dot,
        ttftText: `${ttftSec}s`,
        tpsText: `${res.tps} t/s${suffix}`,
        score: res.score ?? 0,
        estimated: isEstimate,
        runs
      }
    }

    // Progressive rendering page size — keeps the first paint cheap even with 1000+ models
    const PAGE_SIZE = 60

    // ── Component: Spotlight Floating Modal ─────────────────────────────────
    function ModelMasterSpotlightModal({
      isOpen,
      onClose,
      groups,
      currentSelection,
      onSelectModel,
      benchmarkResults,
      onRunProbe,
      onBatchTest,
      onCancelBatchTest,
      isBatchTesting,
      testingKeys,
      leaderboardData,
      onRefreshLeaderboard,
      isRefreshingLeaderboard,
      probeSamples,
      onProbeSamplesChange,
      onClearResult,
      onClearAllResults,
      catalogStatus,
      catalogError,
      onRetryCatalog,
      lastBatchSummary
    }) {
      const [theme, setTheme] = useState(() => {
        try {
          const saved = localStorage.getItem('dsh_model_master_theme')
          return saved === 'light' ? 'light' : 'dark'
        } catch {
          return 'dark'
        }
      })
      const [activeTab, setActiveTab] = useState('all')
      const [searchQuery, setSearchQuery] = useState('')
      const [sortMode, setSortMode] = useState('smart')
      const [highlightedIndex, setHighlightedIndex] = useState(-1)
      // Progressive rendering: never mount the whole 1000+ model list at once
      const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
      const [toastMsg, setToastMsg] = useState(null)
      const searchInputRef = useRef(null)
      const tabsRef = useRef(null)
      const modalRef = useRef(null)

      // Two-step in-app confirmation for destructive actions. window.confirm is
      // unreliable in embedded webviews (some auto-accept without showing a
      // dialog), so it must never gate an irreversible operation.
      const [confirmClearAll, setConfirmClearAll] = useState(false)
      const [confirmBatch, setConfirmBatch] = useState(false)
      useEffect(() => {
        if (!confirmClearAll) return
        const timer = setTimeout(() => setConfirmClearAll(false), 6000)
        return () => clearTimeout(timer)
      }, [confirmClearAll])
      useEffect(() => {
        if (!confirmBatch) return
        const timer = setTimeout(() => setConfirmBatch(false), 6000)
        return () => clearTimeout(timer)
      }, [confirmBatch])

      // The leaderboard is display-only: clicking a row jumps to a local search
      // for that model so the user picks the channel themselves — no automatic
      // model matching, so no wrong "available locally" badges.
      const jumpToLocalSearch = item => {
        const terms = String(item.name || item.shortId || item.id || '')
          .replace(/[()]/g, ' ')
          .split(/[\s\-_/]+/)
          .filter(Boolean)
          .join(' ')
          .trim()
        setActiveTab('all')
        setSearchQuery(terms)
        setHighlightedIndex(-1)
        setVisibleCount(PAGE_SIZE)
        showToast(t('searchedLocal', [item.name]))
        setTimeout(() => searchInputRef.current?.focus(), 80)
      }

      const handleThemeChange = newTheme => {
        setTheme(newTheme)
        try {
          localStorage.setItem('dsh_model_master_theme', newTheme)
        } catch {}
      }

      const scrollTabs = direction => {
        if (tabsRef.current) {
          tabsRef.current.scrollBy({
            left: direction === 'left' ? -220 : 220,
            behavior: 'smooth'
          })
        }
      }

      useEffect(() => {
        if (isOpen) {
          setHighlightedIndex(-1)
          setTimeout(() => searchInputRef.current?.focus(), 80)
        } else {
          // Reset transient view state on close so reopening always starts fresh
          setSearchQuery('')
          setHighlightedIndex(-1)
          setVisibleCount(PAGE_SIZE)
        }
      }, [isOpen])

      // Restore focus to the trigger button when the modal closes/unmounts.
      // Falls back to the trigger when focus sat on <body> at mount time
      // (e.g. the modal opened through an unusual path).
      useEffect(() => {
        let prev = document.activeElement
        if (!prev || prev === document.body || typeof prev.focus !== 'function') {
          prev = document.querySelector('.dmm-trigger-btn')
        }
        const target = prev
        return () => {
          try {
            if (target && typeof target.focus === 'function') target.focus()
          } catch {}
        }
      }, [])

      // Surface a batch-test summary toast when the run finishes
      useEffect(() => {
        if (lastBatchSummary && Date.now() - lastBatchSummary.at < 8000) {
          showToast(lastBatchSummary.text)
        }
      }, [lastBatchSummary])

      // Keep the keyboard-highlighted row inside the scroll viewport
      useEffect(() => {
        if (!isOpen || highlightedIndex < 0) return
        const el = document.querySelector(`.dmm-card.highlighted`)
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' })
        }
      }, [isOpen, highlightedIndex])

      const showToast = useCallback(msg => {
        setToastMsg(msg)
        setTimeout(() => setToastMsg(null), 2500)
      }, [])

      // Flatten models with provider and benchmark metadata
      const allModelEntries = useMemo(() => {
        const entries = []
        for (const g of groups || []) {
          if (!g) continue
          for (const m of g.models || []) {
            if (!m) continue
            const gId = String(g.id || '')
            const mId = String(m.id || '')
            const key = `${gId}:${mId}`
            const bench = (benchmarkResults && benchmarkResults[key]) || null
            entries.push({
              key,
              providerId: gId,
              providerName: g.name || gId || '未知渠道',
              modelId: mId,
              modelName: m.name || mId || t('unnamedModel'),
              reasoning: m.reasoning,
              bench,
              group: g,
              model: m
            })
          }
        }
        return entries
      }, [groups, benchmarkResults])

      const currentGroupName = useMemo(() => {
        if (activeTab === 'all') return t('groupAllModels')
        if (activeTab === 'leaderboard') return t('boardName')
        const g = (groups || []).find(x => x && x.id === activeTab)
        return g ? g.name || g.id : activeTab
      }, [groups, activeTab])

      const currentGroupModels = useMemo(() => {
        if (activeTab === 'all' || activeTab === 'leaderboard') {
          return allModelEntries
        }
        return allModelEntries.filter(e => e.providerId === activeTab)
      }, [allModelEntries, activeTab])

      // Active Model & Reasoning Effort Resolution
      const currentChoice = useMemo(() => {
        if (!currentSelection) return null
        for (const g of groups || []) {
          if (!g || g.id !== currentSelection.provider) continue
          const m = (g.models || []).find(x => x && x.id === currentSelection.model)
          if (m) return { group: g, model: m }
        }
        return null
      }, [groups, currentSelection])

      // v1.4.1: 面板内不再渲染推理等级控件（effortChoices/currentEffectiveEffort
      // 随之移除）—— 档位调整交给原生菜单 / dsh-better-panel 滑条

      // Filter models by tab and search
      const filteredModels = useMemo(() => {
        const q = String(searchQuery || '')
          .trim()
          .toLowerCase()
        let list = allModelEntries

        if (q) {
          const terms = q.split(/\s+/).filter(Boolean)
          list = list.filter(e => {
            const corpus =
              `${e.modelName} ${e.modelId} ${e.providerName} ${e.providerId} ${e.reasoning ? 'reasoning' : ''}`.toLowerCase()
            return terms.every(term => corpus.includes(term))
          })
        } else if (activeTab !== 'all') {
          list = list.filter(e => e.providerId === activeTab)
        }

        const sorted = [...list]
        if (sortMode === 'smart') {
          // Measured results outrank gateway-ping estimates, then by score
          sorted.sort((a, b) => {
            const aEst = a.bench?.source === 'gateway-ping',
              bEst = b.bench?.source === 'gateway-ping'
            if (aEst !== bEst) return aEst ? 1 : -1
            return (b.bench?.score ?? -1) - (a.bench?.score ?? -1)
          })
        } else if (sortMode === 'ttft') {
          sorted.sort((a, b) => {
            const aTtft = a.bench && a.bench.success ? a.bench.ttft : 999999
            const bTtft = b.bench && b.bench.success ? b.bench.ttft : 999999
            return aTtft - bTtft
          })
        } else if (sortMode === 'tps') {
          sorted.sort((a, b) => (b.bench?.tps ?? -1) - (a.bench?.tps ?? -1))
        }
        return sorted
      }, [allModelEntries, activeTab, searchQuery, sortMode])

      // The batch-test and smart-pick controls operate on the VISIBLE scope:
      // the search results while a search is active, otherwise the tab's models.
      const visibleScopeModels = useMemo(
        () => (String(searchQuery || '').trim() ? filteredModels : currentGroupModels),
        [searchQuery, filteredModels, currentGroupModels]
      )
      const visibleScopeName = String(searchQuery || '').trim()
        ? t('scopeSearch')
        : activeTab === 'all'
          ? t('scopeAll')
          : currentGroupName

      // Best Smart Node strictly scoped to the visible scope.
      // Real streaming measurements always outrank gateway-ping estimates.
      const bestSmartNodeForGroup = useMemo(() => {
        const tested = visibleScopeModels.filter(e => e.bench && e.bench.success && (e.bench.score ?? 0) > 0)
        if (tested.length === 0) return null
        const isEstimate = e => e.bench?.source === 'gateway-ping'
        return [...tested].sort((a, b) => {
          const aEst = isEstimate(a),
            bEst = isEstimate(b)
          if (aEst !== bEst) return aEst ? 1 : -1
          return (b.bench?.score ?? 0) - (a.bench?.score ?? 0)
        })[0]
      }, [visibleScopeModels])

      // Only the first `visibleCount` entries are mounted; the rest load on demand
      const visibleModels = useMemo(() => filteredModels.slice(0, visibleCount), [filteredModels, visibleCount])
      const hasMoreModels = visibleCount < filteredModels.length

      // Reset paging whenever the result set changes identity
      useEffect(() => {
        setVisibleCount(PAGE_SIZE)
        setConfirmBatch(false)
      }, [activeTab, searchQuery, sortMode])

      // Keyboard navigation
      useEffect(() => {
        const handleKeyDown = e => {
          if (!isOpen) return

          // Focus trap: Tab cycles inside the dialog instead of escaping
          // to the page behind the backdrop
          if (e.key === 'Tab') {
            const root = modalRef.current
            if (!root) return
            const focusables = Array.from(root.querySelectorAll('button, input, select, [tabindex="0"]')).filter(
              el => !el.disabled && el.offsetParent !== null
            )
            if (focusables.length === 0) return
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            const active = document.activeElement
            if (!root.contains(active)) {
              e.preventDefault()
              first.focus()
              return
            }
            if (e.shiftKey && active === first) {
              e.preventDefault()
              last.focus()
            } else if (!e.shiftKey && active === last) {
              e.preventDefault()
              first.focus()
            }
            return
          }

          if (e.key === 'Escape') {
            e.preventDefault()
            if (searchQuery) {
              setSearchQuery('')
              setHighlightedIndex(-1)
            } else {
              onClose()
            }
            return
          }

          if (activeTab === 'leaderboard') return

          if (document.activeElement === searchInputRef.current) {
            if (e.key === 'Enter') {
              e.preventDefault()
              searchInputRef.current?.blur()
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              searchInputRef.current?.blur()
              setHighlightedIndex(0)
              return
            }
            return
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex(prev => {
              const next = Math.min(prev + 1, filteredModels.length - 1)
              // Keep the highlighted row mounted — extend the render window if needed
              if (next >= visibleCount) setVisibleCount(next + PAGE_SIZE)
              return next
            })
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex(prev => Math.max(prev - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (highlightedIndex >= 0 && highlightedIndex < filteredModels.length) {
              const target = filteredModels[highlightedIndex]
              if (target) {
                ;(async () => {
                  const res = await onSelectModel(target.providerId, target.modelId, target.reasoning?.defaultEffort)
                  if (res && res.ok === false) {
                    showToast(t('switchFail', [res.error?.message || t('channelNotReady')]))
                    return
                  }
                  showToast(`已切换至: ${target.modelName}`)
                  setTimeout(() => onClose(), 150)
                })()
              }
            }
          }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
      }, [isOpen, activeTab, filteredModels, highlightedIndex, searchQuery, visibleCount, onSelectModel, onClose])

      if (!isOpen) return null

      return createPortal(
        h(
          'div',
          { className: 'dmm-backdrop', onClick: onClose },
          h(
            'div',
            {
              className: 'dmm-modal',
              'data-theme': theme,
              ref: modalRef,
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': '模型选择大师',
              dir: isRTLLang() ? 'rtl' : 'ltr',
              onClick: e => e.stopPropagation()
            },
            // ── Header ──
            h(
              'div',
              { className: 'dmm-header' },
              h(
                'div',
                { className: 'dmm-header-left' },
                h(
                  'svg',
                  {
                    className: 'dmm-header-icon',
                    width: 18,
                    height: 18,
                    viewBox: '30 36 120 122',
                    fill: 'none'
                  },
                  // Same mark as icon.svg: four strokes reading as M, with the
                  // central V carried down past the baseline as a selection
                  // arrow. Kept inline so the header needs no extra request.
                  h(
                    'g',
                    {
                      stroke: 'currentColor',
                      strokeWidth: 21,
                      strokeLinecap: 'round',
                      fill: 'none'
                    },
                    h('path', { d: 'M48 130 V58' }),
                    h('path', { d: 'M48 58 L90 106' }),
                    h('path', { d: 'M90 106 L132 58' }),
                    h('path', { d: 'M132 58 V130' })
                  ),
                  h('path', { d: 'M79 100 L90 150 L101 100 Z', fill: 'currentColor' })
                ),
                h(
                  'div',
                  { className: 'dmm-header-title' },
                  t('title'),
                  h(
                    'span',
                    { className: 'dmm-header-sub' },
                    groups.length === 0 && catalogStatus === 'loading'
                      ? t('catalogLoadingSub')
                      : `· ${groups.length} 个渠道 · ${allModelEntries.length} 款模型`
                  )
                )
              ),
              h(
                'div',
                { className: 'dmm-header-right' },
                // Leaderboard entry grouped with the other header actions.
                // Highlight only when the board is actually on screen (a
                // search takes over the content area); clicking always
                // reveals the board by clearing any active search.
                h(
                  'button',
                  {
                    className:
                      "dmm-header-lb-btn ${activeTab === 'leaderboard' && !String(searchQuery || '').trim() ? 'active' : ''}",
                    title: t('boardBtnTitle'),
                    onClick: () => {
                      if (String(searchQuery || '').trim()) {
                        setSearchQuery('')
                        setActiveTab('leaderboard')
                      } else {
                        setActiveTab(activeTab === 'leaderboard' ? 'all' : 'leaderboard')
                      }
                      setHighlightedIndex(-1)
                    }
                  },
                  IcoPodium(12),
                  'TOP100'
                ),
                // Single sun/moon toggle — the icon mirrors the CURRENT theme
                h(
                  'button',
                  {
                    className: 'dmm-icon-btn',
                    title: theme === 'dark' ? t('themeToDark') : t('themeToLight'),
                    'aria-label': 'toggle theme',
                    onClick: () => handleThemeChange(theme === 'dark' ? 'light' : 'dark')
                  },
                  theme === 'dark' ? IcoMoon() : IcoSun()
                ),

                // Language switcher: globe button with a popup menu
                (() => {
                  const [langOpen, setLangOpen] = useState(false)
                  useEffect(() => {
                    if (!langOpen) return undefined
                    const close = e => {
                      if (!e.target.closest || !e.target.closest('.dmm-lang-menu, .dmm-icon-btn.dmm-lang-btn'))
                        setLangOpen(false)
                    }
                    document.addEventListener('click', close)
                    return () => document.removeEventListener('click', close)
                  }, [langOpen])
                  return h(
                    'div',
                    { className: 'dmm-lang-wrap' },
                    h(
                      'button',
                      {
                        className: 'dmm-icon-btn dmm-lang-btn',
                        title: t('langTitle'),
                        'aria-label': t('langTitle'),
                        'aria-haspopup': 'menu',
                        'aria-expanded': langOpen,
                        onClick: e => {
                          e.stopPropagation()
                          setLangOpen(o => !o)
                        }
                      },
                      IcoGlobe(),
                      h('span', { className: 'dmm-lang-code' }, uiLang)
                    ),
                    langOpen
                      ? h(
                          'div',
                          { className: 'dmm-lang-menu', role: 'menu' },
                          LANGUAGES.map(([code, name]) =>
                            h(
                              'button',
                              {
                                key: code,
                                className: 'dmm-lang-option' + (uiLang === code ? ' active' : ''),
                                role: 'menuitem',
                                onClick: e => {
                                  e.stopPropagation()
                                  setUiLang(code)
                                  setLangOpen(false)
                                }
                              },
                              name,
                              uiLang === code ? h('span', { className: 'dmm-lang-check' }, '✓') : null
                            )
                          )
                        )
                      : null
                  )
                })(),
                confirmClearAll
                  ? h(
                      'div',
                      { className: 'dmm-header-confirm', title: t('clearConfirmTip') },
                      h(
                        'button',
                        {
                          className: 'dmm-danger-btn',
                          title: t('confirmClearTitle'),
                          onClick: async () => {
                            setConfirmClearAll(false)
                            const ok = await onClearAllResults()
                            showToast(ok ? t('clearedToast') : t('clearFailedToast'))
                          }
                        },
                        t('confirmClearAll')
                      ),
                      h('button', { className: 'dmm-ghost-btn', onClick: () => setConfirmClearAll(false) }, t('cancel'))
                    )
                  : h(
                      'button',
                      {
                        className: 'dmm-ghost-btn',
                        title: t('clearAllTitle'),
                        onClick: () => setConfirmClearAll(true)
                      },
                      IcoTrash(11),
                      t('clearAll')
                    ),
                h(
                  'button',
                  { className: 'dmm-close-btn', onClick: onClose, title: t('closeTitle') },
                  h('span', { className: 'dmm-kbd' }, 'ESC'),
                  '✕'
                )
              )
            ),

            // ── Toolbar ──
            h(
              'div',
              { className: 'dmm-toolbar' },
              h(
                'div',
                { className: 'dmm-search-wrap' },
                h(
                  'svg',
                  {
                    className: 'dmm-search-icon',
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 2
                  },
                  h('circle', { cx: 11, cy: 11, r: 8 }),
                  h('line', { x1: 21, y1: 21, x2: 16.65, y2: 16.65 })
                ),
                h('input', {
                  ref: searchInputRef,
                  className: 'dmm-search-input',
                  placeholder: t('searchPlaceholder'),
                  value: searchQuery,
                  onChange: e => {
                    setSearchQuery(e.target.value)
                    setHighlightedIndex(-1)
                  }
                }),
                searchQuery &&
                  h(
                    'button',
                    {
                      className: 'dmm-search-clear',
                      onClick: () => {
                        setSearchQuery('')
                        setHighlightedIndex(-1)
                        searchInputRef.current?.focus()
                      },
                      title: '清空'
                    },
                    '✕'
                  )
              ),
              // Sorting / probing controls are meaningless on the display-only
              // leaderboard tab — hide them there.
              activeTab === 'leaderboard'
                ? null
                : h(
                    Fragment,
                    null,
                    h(
                      'select',
                      {
                        className: 'dmm-select-sort',
                        value: sortMode,
                        onChange: e => setSortMode(e.target.value)
                      },
                      h('option', { value: 'smart' }, t('sortSmart')),
                      h('option', { value: 'ttft' }, t('sortTtft')),
                      h('option', { value: 'tps' }, t('sortTps')),
                      h('option', { value: 'default' }, t('sortDefault'))
                    ),
                    // Probe mode: single quick run vs median of three
                    h(
                      'select',
                      {
                        className: 'dmm-select-sort dmm-select-samples',
                        value: String(probeSamples),
                        title: probeSamples === 3 ? t('probeStableTip') : t('probeFastTip'),
                        onChange: e => {
                          const next = Number(e.target.value) === 3 ? 3 : 1
                          if (typeof onProbeSamplesChange === 'function') onProbeSamplesChange(next)
                        }
                      },
                      h('option', { value: '1' }, t('probeFast')),
                      h('option', { value: '3' }, t('probeStable'))
                    ),
                    h(
                      'button',
                      {
                        className:
                          "dmm-action-btn ${visibleScopeModels.length > 40 && confirmBatch ? 'dmm-btn-warn' : 'dmm-btn-primary'}",
                        disabled: visibleScopeModels.length === 0,
                        title: isBatchTesting
                          ? t('batchStopTitle')
                          : t('batchTip', [visibleScopeName, visibleScopeModels.length]),
                        onClick: () => {
                          if (isBatchTesting) {
                            onCancelBatchTest()
                            return
                          }
                          // Large batches cost real API quota and many minutes — require a
                          // deliberate second click instead of window.confirm (unreliable
                          // in embedded webviews).
                          if (visibleScopeModels.length > 40 && !confirmBatch) {
                            setConfirmBatch(true)
                            return
                          }
                          setConfirmBatch(false)
                          onBatchTest(visibleScopeModels)
                        }
                      },
                      isBatchTesting
                        ? h(Fragment, null, IcoStop(12), t('batchStop', [testingKeys.size]))
                        : visibleScopeModels.length > 40 && confirmBatch
                          ? h(Fragment, null, IcoWarn(12), t('batchConfirm', [visibleScopeModels.length]))
                          : h(Fragment, null, IcoZap(12), t('batchProbe', [visibleScopeModels.length]))
                    ),
                    h(
                      'button',
                      {
                        className: 'dmm-action-btn dmm-btn-smart',
                        onClick: async () => {
                          if (bestSmartNodeForGroup) {
                            const res = await onSelectModel(
                              bestSmartNodeForGroup.providerId,
                              bestSmartNodeForGroup.modelId,
                              bestSmartNodeForGroup.reasoning?.defaultEffort
                            )
                            if (res && res.ok === false) {
                              showToast(t('switchFail', [res.error?.message || t('channelNotReady')]))
                              return
                            }
                            showToast(t('switchedBest', [visibleScopeName, bestSmartNodeForGroup.modelName]))
                            setTimeout(() => onClose(), 150)
                          } else {
                            showToast(t('noTestData', [visibleScopeName]))
                          }
                        }
                      },
                      h(Fragment, null, IcoSpark(12), t('smartPick', [visibleScopeName]))
                    )
                  )
            ),

            // v1.4.1: 面板内推理等级控件已移除 —— 思考档位由原生菜单 /
            // dsh-better-panel 滑条负责，面板专注模型选择，节省纵向空间

            // ── Tabs Bar ──
            h(
              'div',
              { className: 'dmm-tabs-wrap' },
              h(
                'button',
                {
                  className: 'dmm-tabs-nav-btn prev',
                  onClick: () => scrollTabs('left'),
                  title: t('scrollLeft')
                },
                '‹'
              ),
              h(
                'div',
                { ref: tabsRef, className: 'dmm-tabs' },
                h(
                  'button',
                  {
                    className: "dmm-tab ${activeTab === 'all' ? 'active' : ''}",
                    onClick: () => {
                      setActiveTab('all')
                      setHighlightedIndex(-1)
                    }
                  },
                  t('tabAll'),
                  h('span', { className: 'dmm-tab-badge' }, allModelEntries.length)
                ),
                groups.map(g =>
                  h(
                    'button',
                    {
                      key: g.id,
                      className: "dmm-tab ${activeTab === g.id ? 'active' : ''}",
                      onClick: () => {
                        setActiveTab(g.id)
                        setHighlightedIndex(-1)
                      }
                    },
                    g.name || g.id,
                    h('span', { className: 'dmm-tab-badge' }, (g.models || []).length)
                  )
                )
              ),
              h(
                'button',
                {
                  className: 'dmm-tabs-nav-btn next',
                  onClick: () => scrollTabs('right'),
                  title: t('scrollRight')
                },
                '›'
              )
            ),

            // ── Main Content Area ──
            h(
              'div',
              { className: 'dmm-content' },
              // Distinguish loading / reachable-but-empty / failed — never render
              // a bare "暂无模型" while the catalog is still on its way.
              (!groups || groups.length === 0) && catalogStatus === 'loading'
                ? h(
                    'div',
                    { className: 'dmm-empty-state' },
                    h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                    t('loadingCatalog')
                  )
                : (!groups || groups.length === 0) && catalogStatus === 'error'
                  ? h(
                      'div',
                      { className: 'dmm-empty-state' },
                      h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                      h('div', null, catalogError),
                      h(
                        'div',
                        { style: { marginTop: '10px' } },
                        h('button', { className: 'dmm-loadmore-btn', onClick: onRetryCatalog }, t('retryLoad'))
                      )
                    )
                  : (!groups || groups.length === 0) && catalogStatus === 'empty'
                    ? h(
                        'div',
                        { className: 'dmm-empty-state' },
                        h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                        h('div', null, t('backendEmpty1')),
                        h('div', { style: { marginTop: '6px', fontSize: '11px' } }, t('backendEmpty2')),
                        h(
                          'div',
                          { style: { marginTop: '10px' } },
                          h('button', { className: 'dmm-loadmore-btn', onClick: onRetryCatalog }, t('retryLoad'))
                        )
                      )
                    : searchQuery
                      ? // Search View
                        h(
                          Fragment,
                          null,
                          h(
                            'div',
                            { className: 'dmm-search-banner' },
                            h('span', null, t('searchBanner', [searchQuery, filteredModels.length])),
                            h(
                              'button',
                              {
                                className: 'dmm-search-banner-clear',
                                onClick: () => {
                                  setSearchQuery('')
                                  setHighlightedIndex(-1)
                                }
                              },
                              t('clearSearch')
                            )
                          ),
                          filteredModels.length === 0
                            ? h(
                                'div',
                                { className: 'dmm-empty-state' },
                                h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                                t('noMatch', [searchQuery])
                              )
                            : visibleModels.map((entry, idx) => {
                                const isCurrent =
                                  currentSelection &&
                                  currentSelection.provider === entry.providerId &&
                                  currentSelection.model === entry.modelId

                                const isHighlighted = idx === highlightedIndex
                                const isTestingThis = testingKeys && testingKeys.has(entry.key)
                                const badge = formatSpeedBadge(entry.bench)

                                return h(
                                  'div',
                                  {
                                    key: entry.key,
                                    className:
                                      "dmm-card ${isCurrent ? 'active' : ''} ${isHighlighted ? 'highlighted' : ''}",
                                    onMouseEnter: () => setHighlightedIndex(idx),
                                    onClick: async () => {
                                      const eff = entry.reasoning?.defaultEffort
                                      const res = await onSelectModel(entry.providerId, entry.modelId, eff)
                                      if (res && res.ok === false) {
                                        showToast(t('switchFail', [res.error?.message || t('channelNotReady')]))
                                        return
                                      }
                                      showToast(t('switchedTo', [entry.modelName]))
                                      setTimeout(() => onClose(), 150)
                                    }
                                  },
                                  h(
                                    'div',
                                    { className: 'dmm-card-left' },
                                    h('span', { className: 'dmm-card-name' }, entry.modelName),
                                    h('span', { className: 'dmm-card-provider' }, entry.providerName),
                                    entry.reasoning
                                      ? h(
                                          'span',
                                          { className: 'dmm-tag-reasoning', title: t('reasoningTagTip') },
                                          'Reasoning'
                                        )
                                      : null
                                  ),
                                  h(
                                    'div',
                                    { className: 'dmm-card-right', onClick: e => e.stopPropagation() },
                                    isTestingThis
                                      ? h(
                                          'div',
                                          { className: 'dmm-perf-pill', style: { color: 'var(--dmm-accent)' } },
                                          h('span', { className: 'dmm-dot dmm-dot-yellow' }),
                                          t('testing')
                                        )
                                      : h(
                                          'div',
                                          { className: 'dmm-perf-pill', title: badge.title || '' },
                                          h('span', { className: `dmm-dot ${badge.dot}` }),
                                          badge.label,
                                          badge.reason
                                            ? h('span', { className: 'dmm-perf-reason' }, ` · ${badge.reason}`)
                                            : null
                                        ),
                                    entry.bench
                                      ? h(
                                          'button',
                                          {
                                            className: 'dmm-btn-probe',
                                            title: t('clearRowTitle'),
                                            'aria-label': t('clearRowAria', [entry.modelName]),
                                            onClick: e => {
                                              e.stopPropagation()
                                              onClearResult(entry.key)
                                            }
                                          },
                                          '✕'
                                        )
                                      : null,
                                    h(
                                      'button',
                                      {
                                        className: 'dmm-btn-probe',
                                        disabled: isTestingThis,
                                        onClick: () => onRunProbe(entry.providerId, entry.modelId)
                                      },
                                      isTestingThis ? '...' : t('probeBtn')
                                    ),
                                    isCurrent
                                      ? h(
                                          'svg',
                                          {
                                            className: 'dmm-active-check',
                                            viewBox: '0 0 24 24',
                                            fill: 'none',
                                            stroke: 'currentColor',
                                            strokeWidth: 2.5
                                          },
                                          h('polyline', { points: '20 6 9 17 4 12' })
                                        )
                                      : h(
                                          'svg',
                                          {
                                            className: 'dmm-row-arrow',
                                            viewBox: '0 0 24 24',
                                            fill: 'none',
                                            stroke: 'currentColor',
                                            strokeWidth: 2
                                          },
                                          h('polyline', { points: '9 18 15 12 9 6' })
                                        )
                                  )
                                )
                              })
                        )
                      : activeTab === 'leaderboard'
                        ? // Leaderboard Tab — display only. Clicking a row jumps to a local
                          // search so the user picks the channel; no auto-matching by design.
                          h(
                            Fragment,
                            null,
                            h(
                              'div',
                              { className: 'dmm-lb-header-bar' },
                              h(
                                'span',
                                null,
                                leaderboardData &&
                                  Array.isArray(leaderboardData.models) &&
                                  leaderboardData.models.length > 0
                                  ? t('boardHeader', [leaderboardData.models.length])
                                  : t('boardEmptyHeader')
                              ),
                              h(
                                'button',
                                {
                                  className: 'dmm-btn-probe',
                                  disabled: isRefreshingLeaderboard,
                                  onClick: async () => {
                                    const ok = await onRefreshLeaderboard()
                                    showToast(ok ? t('syncedOk') : t('syncedFail'))
                                  }
                                },
                                isRefreshingLeaderboard
                                  ? t('boardSyncing')
                                  : h(Fragment, null, IcoRefresh(11), t('boardSync'))
                              )
                            ),
                            // Show the real upstream source plus exactly WHEN it was
                            // surveyed. The two scoring-org names inside the source text
                            // are themselves links to the official leaderboards, so the
                            // line doubles as verification without extra chips.
                            // `sourceKind` selects a translated sentence — the Host has no
                            // locale, so its own `source` string (Chinese) is only the
                            // fallback for caches written by an older plugin version.
                            leaderboardData && (leaderboardData.sourceKind || leaderboardData.source)
                              ? h(
                                  'div',
                                  { className: 'dmm-lb-source' },
                                  t('boardSource'),
                                  ...(leaderboardData.sourceKind === 'live'
                                    ? [t('boardSourceLive')]
                                    : leaderboardData.sourceKind === 'offline'
                                      ? [t('boardSourceOffline')]
                                      : leaderboardData.sourceKind === 'pending'
                                        ? [t('boardSourcePending')]
                                        : [String(leaderboardData.source)]
                                  )
                                    .flatMap(text => String(text).split(/(Artificial Analysis|Design Arena)/))
                                    .map((seg, segIndex) => {
                                      if (seg === 'Artificial Analysis') {
                                        return h(
                                          'a',
                                          {
                                            key: 'aa-link',
                                            className: 'dmm-lb-verify-link',
                                            href: 'https://artificialanalysis.ai/leaderboards/models',
                                            target: '_blank',
                                            rel: 'noopener noreferrer',
                                            title: t('boardSourceAATip')
                                          },
                                          seg,
                                          IcoExternal(10)
                                        )
                                      }
                                      if (seg === 'Design Arena') {
                                        return h(
                                          'a',
                                          {
                                            key: 'da-link',
                                            className: 'dmm-lb-verify-link',
                                            href: 'https://designarena.ai/leaderboard',
                                            target: '_blank',
                                            rel: 'noopener noreferrer',
                                            title: t('boardSourceDATip')
                                          },
                                          seg,
                                          IcoExternal(10)
                                        )
                                      }
                                      return h('span', { key: 'seg-' + segIndex }, seg)
                                    }),
                                  leaderboardData.surveyTimeText
                                    ? t('boardUpdated', [leaderboardData.surveyTimeText])
                                    : '',
                                  (() => {
                                    const rel = relativeTime(leaderboardData.updatedAt)
                                    return rel ? t('boardAge', [rel]) : ''
                                  })(),
                                  leaderboardData.updatedAt && Date.now() - leaderboardData.updatedAt > 24 * 3600 * 1000
                                    ? h('span', { className: 'dmm-lb-stale' }, t('boardStale'))
                                    : null
                                )
                              : null,
                            !leaderboardData ||
                              !Array.isArray(leaderboardData.models) ||
                              leaderboardData.models.length === 0
                              ? h(
                                  'div',
                                  { className: 'dmm-empty-state' },
                                  h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                                  t('boardEmpty')
                                )
                              : null,
                            (leaderboardData && Array.isArray(leaderboardData.models)
                              ? leaderboardData.models
                              : []
                            ).map(item => {
                              if (!item) return null
                              let rankClass = ''
                              if (item.rank === 1) rankClass = 'dmm-rank-1'
                              else if (item.rank === 2) rankClass = 'dmm-rank-2'
                              else if (item.rank === 3) rankClass = 'dmm-rank-3'

                              // Everything trimmed out of the row goes into one hover tooltip
                              const fullTitle = [
                                item.id,
                                item.org ? t('tipVendor', [item.org]) : null,
                                item.intelligence != null ? t('tipInt', [item.intelligence]) : null,
                                item.coding != null ? t('tipCoding', [item.coding]) : null,
                                item.agentic != null ? t('tipAgentic', [item.agentic]) : null,
                                item.arenaElo != null
                                  ? t('tipArena', [item.arenaElo, item.arenaCategory ? ` (${item.arenaCategory})` : ''])
                                  : null,
                                item.context ? t('tipContext', [item.context]) : null,
                                item.pricing?.prompt
                                  ? t('tipPrice', ['$' + item.pricing.prompt, '$' + (item.pricing.completion ?? '?')])
                                  : null,
                                t('rowClickTip')
                              ]
                                .filter(Boolean)
                                .join('\n')

                              return h(
                                'div',
                                {
                                  key: item.rank,
                                  className: 'dmm-lb-card',
                                  title: fullTitle,
                                  role: 'button',
                                  tabIndex: 0,
                                  'aria-label': t('rowAria', [item.rank, item.name]),
                                  onClick: () => jumpToLocalSearch(item),
                                  onKeyDown: e => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      jumpToLocalSearch(item)
                                    }
                                  }
                                },
                                h(
                                  'div',
                                  { className: 'dmm-lb-left' },
                                  h(
                                    'span',
                                    { className: `dmm-lb-rank ${rankClass}` },
                                    item.rank < 10 ? `0${item.rank}` : item.rank
                                  ),
                                  h('span', { className: 'dmm-lb-name' }, item.name),
                                  item.org ? h('span', { className: 'dmm-lb-org' }, item.org) : null
                                ),
                                // Compact middle column: only the two figures that matter at a glance.
                                // Everything else lives in the row's hover tooltip.
                                h(
                                  'div',
                                  { className: 'dmm-lb-stats', title: fullTitle },
                                  item.intelligence !== null && item.intelligence !== undefined
                                    ? h('span', null, t('intMetric', [item.intelligence]))
                                    : null,
                                  item.context ? h('span', null, item.context) : null
                                ),
                                h(
                                  'div',
                                  { className: 'dmm-lb-right' },
                                  h(
                                    'span',
                                    { className: 'dmm-lb-search-hint', title: t('searchLocalTip') },
                                    IcoSearch(11),
                                    t('searchLocal')
                                  )
                                )
                              )
                            })
                          )
                        : // Regular Category Tab
                          h(
                            Fragment,
                            null,
                            // Smart Node Strip
                            bestSmartNodeForGroup &&
                              h(
                                'div',
                                { className: 'dmm-smart-strip' },
                                h(
                                  'div',
                                  { className: 'dmm-smart-info' },
                                  h('span', { className: 'dmm-smart-tag' }, IcoSpark(12), t('smartTag')),
                                  h(
                                    'span',
                                    { className: 'dmm-smart-text' },
                                    `[${bestSmartNodeForGroup.providerName}] ${bestSmartNodeForGroup.modelName}`
                                  ),
                                  h(
                                    'span',
                                    { className: 'dmm-smart-metrics' },
                                    `${(bestSmartNodeForGroup.bench.ttft / 1000).toFixed(2)}s · ${bestSmartNodeForGroup.bench.tps} t/s`,
                                    bestSmartNodeForGroup.bench.source === 'gateway-ping'
                                      ? h('span', { className: 'dmm-smart-est' }, t('estimate'))
                                      : null
                                  )
                                ),
                                h(
                                  'button',
                                  {
                                    className: 'dmm-smart-apply-btn',
                                    onClick: async () => {
                                      const res = await onSelectModel(
                                        bestSmartNodeForGroup.providerId,
                                        bestSmartNodeForGroup.modelId,
                                        bestSmartNodeForGroup.reasoning?.defaultEffort
                                      )
                                      if (res && res.ok === false) {
                                        showToast(t('switchFail', [res.error?.message || t('channelNotReady')]))
                                        return
                                      }
                                      showToast(t('switchedBestNode', [bestSmartNodeForGroup.modelName]))
                                      setTimeout(() => onClose(), 150)
                                    }
                                  },
                                  t('apply')
                                )
                              ),

                            // Model Rows
                            filteredModels.length === 0
                              ? h(
                                  'div',
                                  { className: 'dmm-empty-state' },
                                  h('div', { className: 'dmm-empty-icon' }, IcoLayers(30)),
                                  t('groupEmpty')
                                )
                              : visibleModels.map((entry, idx) => {
                                  const isCurrent =
                                    currentSelection &&
                                    currentSelection.provider === entry.providerId &&
                                    currentSelection.model === entry.modelId

                                  const isHighlighted = idx === highlightedIndex
                                  const isTestingThis = testingKeys && testingKeys.has(entry.key)
                                  const badge = formatSpeedBadge(entry.bench)

                                  return h(
                                    'div',
                                    {
                                      key: entry.key,
                                      className:
                                        "dmm-card ${isCurrent ? 'active' : ''} ${isHighlighted ? 'highlighted' : ''}",
                                      onMouseEnter: () => setHighlightedIndex(idx),
                                      onClick: async () => {
                                        const eff = entry.reasoning?.defaultEffort
                                        const res = await onSelectModel(entry.providerId, entry.modelId, eff)
                                        if (res && res.ok === false) {
                                          showToast(t('switchFail', [res.error?.message || t('channelNotReady')]))
                                          return
                                        }
                                        showToast(t('switchedTo', [entry.modelName]))
                                        setTimeout(() => onClose(), 150)
                                      }
                                    },
                                    h(
                                      'div',
                                      { className: 'dmm-card-left' },
                                      h('span', { className: 'dmm-card-name' }, entry.modelName),
                                      h('span', { className: 'dmm-card-provider' }, entry.providerName),
                                      entry.reasoning
                                        ? h(
                                            'span',
                                            { className: 'dmm-tag-reasoning', title: t('reasoningTagTip') },
                                            'Reasoning'
                                          )
                                        : null
                                    ),
                                    h(
                                      'div',
                                      { className: 'dmm-card-right', onClick: e => e.stopPropagation() },
                                      isTestingThis
                                        ? h(
                                            'div',
                                            { className: 'dmm-perf-pill', style: { color: 'var(--dmm-accent)' } },
                                            h('span', { className: 'dmm-dot dmm-dot-yellow' }),
                                            t('testing')
                                          )
                                        : h(
                                            'div',
                                            { className: 'dmm-perf-pill', title: badge.title || '' },
                                            h('span', { className: `dmm-dot ${badge.dot}` }),
                                            badge.label,
                                            badge.reason
                                              ? h('span', { className: 'dmm-perf-reason' }, ` · ${badge.reason}`)
                                              : null
                                          ),
                                      entry.bench
                                        ? h(
                                            'button',
                                            {
                                              className: 'dmm-btn-probe',
                                              title: t('clearRowTitle'),
                                              'aria-label': t('clearRowAria', [entry.modelName]),
                                              onClick: e => {
                                                e.stopPropagation()
                                                onClearResult(entry.key)
                                              }
                                            },
                                            '✕'
                                          )
                                        : null,
                                      h(
                                        'button',
                                        {
                                          className: 'dmm-btn-probe',
                                          disabled: isTestingThis,
                                          onClick: () => onRunProbe(entry.providerId, entry.modelId)
                                        },
                                        isTestingThis ? '...' : t('probeBtn')
                                      ),
                                      isCurrent
                                        ? h(
                                            'svg',
                                            {
                                              className: 'dmm-active-check',
                                              viewBox: '0 0 24 24',
                                              fill: 'none',
                                              stroke: 'currentColor',
                                              strokeWidth: 2.5
                                            },
                                            h('polyline', { points: '20 6 9 17 4 12' })
                                          )
                                        : h(
                                            'svg',
                                            {
                                              className: 'dmm-row-arrow',
                                              viewBox: '0 0 24 24',
                                              fill: 'none',
                                              stroke: 'currentColor',
                                              strokeWidth: 2
                                            },
                                            h('polyline', { points: '9 18 15 12 9 6' })
                                          )
                                    )
                                  )
                                })
                          ),

              // Progressive load footer — "load more / show all" while paging;
              // once fully expanded, a single "collapse" resets to the first
              // page and scrolls back to the top of the list.
              hasMoreModels || visibleCount > PAGE_SIZE
                ? h(
                    'div',
                    { className: 'dmm-loadmore-wrap' },
                    hasMoreModels
                      ? h(
                          Fragment,
                          null,
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'dmm-loadmore-btn',
                              onClick: () => setVisibleCount(c => c + PAGE_SIZE)
                            },
                            t('loadMore', [visibleModels.length, filteredModels.length])
                          ),
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'dmm-loadmore-btn',
                              onClick: () => setVisibleCount(filteredModels.length)
                            },
                            t('showAll')
                          )
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'dmm-loadmore-btn',
                            onClick: () => {
                              setVisibleCount(PAGE_SIZE)
                              setHighlightedIndex(-1)
                              // Wait a frame so the shrunken list is laid out before scrolling
                              requestAnimationFrame(() => {
                                try {
                                  const content = modalRef.current?.querySelector('.dmm-content')
                                  if (content && typeof content.scrollTo === 'function') {
                                    content.scrollTo({ top: 0 })
                                  }
                                } catch {
                                  /* 滚动失败不影响收起 */
                                }
                              })
                            }
                          },
                          t('collapse', [PAGE_SIZE])
                        )
                  )
                : null
            ),

            // ── Keyboard hints footer (Spotlight-style affordance) ──
            h(
              'div',
              { className: 'dmm-footer-hints', 'aria-hidden': 'true' },
              h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), t('navHint')),
              h('span', { className: 'dmm-hint-sep' }),
              h('span', null, h('kbd', null, '⏎'), t('pickHint')),
              h('span', { className: 'dmm-hint-sep' }),
              h('span', null, h('kbd', null, 'Esc'), t('closeHint')),
              h('span', { className: 'dmm-hint-sep' }),
              h('span', null, h('kbd', null, 'Tab'), t('tabHint'))
            ),

            // Toast Notification
            toastMsg && h('div', { className: 'dmm-toast' }, toastMsg)
          )
        ),
        document.body
      )
    }

    // ── Static empty store snapshot ─────────────────────────────────────────
    const EMPTY_STORE_SNAPSHOT = { groups: [], current: null }

    // ── Error Boundary for Composer Seat ───────────────────────────────────
    class ModelMasterErrorBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error }
      }
      componentDidCatch(error, info) {
        console.error('[dsh-model-master] Composer seat error caught:', error, info)
      }
      render() {
        if (this.state.hasError) {
          // Degraded fallback: still usable, and it tells the user what happened.
          return h(
            'button',
            {
              type: 'button',
              className: 'dmm-trigger-btn',
              style: { border: '1px solid #ef4444', color: '#f87171' },
              title: `模型选择器加载失败：${String(this.state.error?.message || this.state.error)}\n${t('boundaryError')}`,
              onClick: () => this.setState({ hasError: false })
            },
            t('boundaryError', [''])
          )
        }
        return this.props.children
      }
    }

    // ── Global Context Handle ───────────────────────────────────────────────
    let clientCtx = null

    // ── Component: Composer Seat Inner (`conversation.input.model`) ──────────
    function ModelMasterComposerSeatInner({
      locked,
      available,
      directory: propDirectory,
      load,
      select,
      sessionId,
      renderSlot,
      headless,
      onDismiss
    }) {
      ensureStyles()

      const [backendGroups, setBackendGroups] = useState([])
      const [dynamicStore, setDynamicDirectoryStore] = useState(() => propDirectory || null)
      const [optimisticCurrent, setOptimisticCurrent] = useState(null)

      const activeStore = dynamicStore || propDirectory || null

      const subscribe = useCallback(
        fn => (activeStore && typeof activeStore.subscribe === 'function' ? activeStore.subscribe(fn) : () => {}),
        [activeStore]
      )
      const getSnapshot = useCallback(
        () =>
          activeStore && typeof activeStore.getSnapshot === 'function'
            ? activeStore.getSnapshot()
            : EMPTY_STORE_SNAPSHOT,
        [activeStore]
      )
      const state = useSyncExternalStore(subscribe, getSnapshot)

      const [isModalOpen, setIsModalOpen] = useState(() => !!headless)
      const [benchmarkResults, setBenchmarkResults] = useState({})
      const [testingKeys, setTestingKeys] = useState(new Set())
      const [isBatchTesting, setIsBatchTesting] = useState(false)
      const [leaderboardData, setLeaderboardData] = useState(null)
      const [hostDefault, setHostDefault] = useState(null)
      // Probe mode: 1 = quick single run, 3 = median of three (noise-resistant)
      const [probeSamples, setProbeSamples] = useState(() => {
        try {
          const saved = localStorage.getItem('dsh_model_master_probe_samples')
          const n = Number(saved)
          return n === 3 ? 3 : 1
        } catch {
          return 1
        }
      })
      const handleProbeSamplesChange = useCallback(next => {
        const n = Number(next) === 3 ? 3 : 1
        setProbeSamples(n)
        try {
          localStorage.setItem('dsh_model_master_probe_samples', String(n))
        } catch {}
      }, [])
      const abortBatchRef = useRef(false)

      // Fetch native models and providers from backend API as fallback.
      // A status machine tells "still loading" / "reachable but empty" /
      // "failed" apart — right after a DSH restart providers take a moment to
      // initialize, and showing "0 个渠道" during that window misleads users.
      const [catalogError, setCatalogError] = useState(null)
      const [catalogStatus, setCatalogStatus] = useState('loading')
      const catalogGenRef = useRef(0)
      const fetchBackendCatalog = useCallback(() => {
        const gen = ++catalogGenRef.current
        setCatalogStatus('loading')
        const attempt = async retriesLeft => {
          if (gen !== catalogGenRef.current) return // superseded by a newer call
          try {
            const res = await fetch('/api/model-master/catalog')
            if (gen !== catalogGenRef.current) return
            if (res.status === 403) {
              setCatalogError(t('catalog403'))
              setCatalogStatus('error')
              return
            }
            if (!res.ok) {
              setCatalogError(t('catalogHttp', [res.status]))
              setCatalogStatus('error')
              return
            }
            const data = await res.json()
            if (gen !== catalogGenRef.current) return
            if (data && Array.isArray(data.groups) && data.groups.length > 0) {
              setCatalogError(null)
              setCatalogStatus('ok')
              setBackendGroups(data.groups)
              // DSH's own persisted default selection (agentDefaultModel)
              if (data.default && data.default.provider && data.default.model) {
                setHostDefault(data.default)
              }
              return
            }
            // Reachable but zero groups: providers may still be initializing
            // right after a DSH restart — retry quietly before concluding empty.
            if (retriesLeft > 0) {
              setTimeout(() => attempt(retriesLeft - 1), 1500)
              return
            }
            setCatalogError(null)
            setCatalogStatus('empty')
          } catch {
            if (gen !== catalogGenRef.current) return
            setCatalogError(t('catalogUnreachable'))
            setCatalogStatus('error')
          }
        }
        attempt(3)
      }, [])

      // Initial data hydration & dynamic store binding
      useEffect(() => {
        try {
          load?.()
        } catch {}
        fetchBackendCatalog()

        let timer = null
        const tryResolve = () => {
          try {
            const models =
              (typeof clientCtx?.get === 'function' ? clientCtx.get('modelDirectories') : null) ||
              clientCtx?.modelDirectories
            if (models) {
              if (sessionId) {
                const d = models.directoryFor(sessionId)
                if (d && d.store) {
                  setDynamicDirectoryStore(d.store)
                  d.load?.().catch?.(() => {})
                  return true
                }
              }
              if (models.catalog && typeof models.catalog.load === 'function') {
                models.catalog.load().catch(() => {})
              }
            }
          } catch {}
          return false
        }

        if (!tryResolve()) {
          let attempts = 0
          timer = setInterval(() => {
            attempts++
            if (tryResolve() || attempts > 15) {
              clearInterval(timer)
            }
          }, 350)
        }

        fetch('/api/model-master/results')
          .then(res => res.json())
          .then(data => {
            if (data && data.results) setBenchmarkResults(data.results)
          })
          .catch(() => {})

        fetch('/api/model-master/leaderboard')
          .then(res => res.json())
          .then(data => {
            if (data) setLeaderboardData(data)
          })
          .catch(() => {})

        return () => {
          if (timer) clearInterval(timer)
        }
      }, [load, sessionId, fetchBackendCatalog])

      // Clear optimistic selection when store reflects it
      useEffect(() => {
        if (state?.current && optimisticCurrent) {
          if (
            state.current.provider === optimisticCurrent.provider &&
            state.current.model === optimisticCurrent.model
          ) {
            setOptimisticCurrent(null)
          }
        }
      }, [state?.current, optimisticCurrent])

      // Resolved groups across all layers
      const resolvedGroups = useMemo(() => {
        if (state?.groups && Array.isArray(state.groups) && state.groups.length > 0) {
          return state.groups
        }
        try {
          const models =
            (typeof clientCtx?.get === 'function' ? clientCtx.get('modelDirectories') : null) ||
            clientCtx?.modelDirectories
          const catGroups = models?.catalog?.store?.getSnapshot?.()?.value?.groups
          if (Array.isArray(catGroups) && catGroups.length > 0) {
            return catGroups
          }
        } catch {}
        if (Array.isArray(backendGroups) && backendGroups.length > 0) {
          return backendGroups
        }
        return []
      }, [state?.groups, backendGroups])

      // Current active model selection
      const current = useMemo(() => {
        if (optimisticCurrent) return optimisticCurrent
        if (state?.current) return state.current
        try {
          const models =
            (typeof clientCtx?.get === 'function' ? clientCtx.get('modelDirectories') : null) ||
            clientCtx?.modelDirectories
          if (models && sessionId) {
            const d = models.directoryFor(sessionId)
            const snap = d?.store?.getSnapshot?.()
            if (snap?.current) return snap.current
          }
          const def = models?.catalog?.store?.getSnapshot?.()?.value?.default
          if (def) return def
        } catch {}
        // DSH's persisted default (agentDefaultModel) — this is what the native
        // selector shows after a restart, so mirror it instead of guessing.
        if (hostDefault) return hostDefault
        if (resolvedGroups.length > 0 && resolvedGroups[0].models && resolvedGroups[0].models.length > 0) {
          return { provider: resolvedGroups[0].id, model: resolvedGroups[0].models[0].id }
        }
        return null
      }, [optimisticCurrent, state?.current, sessionId, resolvedGroups, hostDefault])

      const currentKey = current ? `${current.provider}:${current.model}` : null
      const currentBench = currentKey ? benchmarkResults[currentKey] : null
      const speedBadge = formatSpeedBadge(currentBench)

      // Core model probe runner. Failures are reported as failures — this used
      // to fabricate name-based "gateway-ping estimates" when the backend was
      // unreachable, which misled users; that fallback is gone for good.
      const probeModel = useCallback(async (provider, model, samples) => {
        const key = `${provider}:${model}`
        const runSamples = Math.min(Math.max(Number(samples) || 1, 1), 5)
        let data = null
        try {
          const res = await fetch('/api/model-master/probe', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider, model, samples: runSamples })
          }).catch(() => null)

          if (res && res.ok) {
            try {
              data = await res.json()
            } catch {}
          } else if (res && res.status === 403) {
            data = {
              success: false,
              provider,
              model,
              score: 0,
              error: t('probe403'),
              testedAt: Date.now()
            }
          }
        } catch {}

        if (!data) {
          data = {
            success: false,
            provider,
            model,
            score: 0,
            error: t('probeUnreachable'),
            testedAt: Date.now()
          }
        }

        setBenchmarkResults(prev => ({ ...prev, [key]: data }))
        return data
      }, [])

      // Probe a single model
      const handleRunProbe = useCallback(
        async (provider, model) => {
          const key = `${provider}:${model}`
          setTestingKeys(prev => new Set(prev).add(key))
          try {
            await probeModel(provider, model, probeSamples)
          } finally {
            setTestingKeys(prev => {
              const next = new Set(prev)
              next.delete(key)
              return next
            })
          }
        },
        [probeModel, probeSamples]
      )

      // Batch test a list of models
      const [lastBatchSummary, setLastBatchSummary] = useState(null)
      const handleBatchTest = useCallback(
        async targetEntries => {
          if (!targetEntries || targetEntries.length === 0) return
          abortBatchRef.current = false
          setIsBatchTesting(true)

          // Deduplicate by modelId — the same model behind several providers is measured
          // once to save quota. Results are NOT copied to sibling providers: different
          // channels can differ a lot, and a copied number would be indistinguishable
          // from a real measurement of that channel.
          const seen = new Map()
          for (const entry of targetEntries) {
            const dedupeKey = String(entry.modelId || '')
            if (!dedupeKey) continue
            if (!seen.has(dedupeKey)) seen.set(dedupeKey, entry)
          }
          const queue = [...seen.values()]

          const concurrency = 2
          let okCount = 0
          let failCount = 0

          const worker = async () => {
            while (queue.length > 0 && !abortBatchRef.current) {
              const entry = queue.shift()
              if (!entry) break
              const key = entry.key
              setTestingKeys(prev => new Set(prev).add(key))
              try {
                const result = await probeModel(entry.providerId, entry.modelId, probeSamples)
                if (result && result.success) okCount++
                else failCount++
              } finally {
                setTestingKeys(prev => {
                  const next = new Set(prev)
                  next.delete(key)
                  return next
                })
              }
            }
          }

          const workers = Array.from({ length: concurrency }, () => worker())
          await Promise.all(workers)

          const wasAborted = abortBatchRef.current
          setIsBatchTesting(false)
          abortBatchRef.current = false
          setLastBatchSummary({
            text: t('batchDone', [okCount, failCount]) + (wasAborted ? t('batchAborted') : '') + t('batchDedupeNote'),
            at: Date.now()
          })
        },
        [probeModel, probeSamples]
      )

      // Cancel ongoing batch test
      const handleCancelBatchTest = useCallback(() => {
        abortBatchRef.current = true
        setIsBatchTesting(false)
        setTestingKeys(new Set())
      }, [])

      // Refresh Leaderboard — resolves true only when fresh online data arrived
      const [isRefreshingLeaderboard, setIsRefreshingLeaderboard] = useState(false)
      const handleRefreshLeaderboard = useCallback(async () => {
        if (isRefreshingLeaderboard) return false
        setIsRefreshingLeaderboard(true)
        try {
          const res = await fetch('/api/model-master/leaderboard/refresh', { method: 'POST' })
          if (!res.ok) return false
          const data = await res.json()
          if (!data || !Array.isArray(data.models)) return false
          setLeaderboardData(data)
          return data.isOnline === true && data.models.length > 0
        } catch (err) {
          console.error('[model-master] Failed to refresh leaderboard:', err)
          return false
        } finally {
          setIsRefreshingLeaderboard(false)
        }
      }, [isRefreshingLeaderboard])

      // Clear one saved benchmark entry (optimistic local removal; server sync best-effort)
      const handleClearResult = useCallback(key => {
        setBenchmarkResults(prev => {
          if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
        fetch('/api/model-master/results/clear', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ key })
        }).catch(() => {})
      }, [])

      // Clear every saved benchmark entry. The modal's two-step inline confirm
      // gates this call — window.confirm is auto-accepted by some webviews.
      const handleClearAllResults = useCallback(async () => {
        setBenchmarkResults({})
        try {
          await fetch('/api/model-master/results/clear', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}'
          })
        } catch {}
        return true
      }, [])

      const [seatToast, setSeatToast] = useState(null)
      const showSeatToast = useCallback((msg, type = 'info') => {
        setSeatToast({ msg, type })
        setTimeout(() => setSeatToast(null), 3200)
      }, [])

      // Select model with immediate optimistic update and robust directory dispatch
      const handleSelectModel = useCallback(
        async (provider, model, reasoningEffort) => {
          if (available === false) {
            showSeatToast(t('sessionLocked'), 'error')
            return { ok: false, error: new Error('Session unavailable') }
          }
          const selection = {
            provider,
            model,
            ...(reasoningEffort !== undefined ? { reasoningEffort } : {})
          }

          // Find target model display name for clear feedback
          let targetModelName = model
          for (const g of resolvedGroups) {
            if (g && g.id === provider) {
              const m = (g.models || []).find(x => x && x.id === model)
              if (m && m.name) targetModelName = m.name
              break
            }
          }

          // 1. Immediate optimistic update for zero UI lag
          setOptimisticCurrent({ provider, model, reasoningEffort })

          try {
            let res = null

            // 2. Primary path: injected props.select
            if (typeof select === 'function') {
              res = await select(selection)
            }

            // 3. Fallback path: dynamic directory resolution
            if (!res && sessionId) {
              try {
                const models =
                  (typeof clientCtx?.get === 'function' ? clientCtx.get('modelDirectories') : null) ||
                  clientCtx?.modelDirectories
                if (models) {
                  const d = models.directoryFor(sessionId)
                  if (d && typeof d.select === 'function') {
                    res = await d.select(selection)
                  }
                }
              } catch (dirErr) {
                console.warn('[dsh-model-master] directory fallback attempt failed:', dirErr)
              }
            }

            // 4. Remote session fallback
            if (!res && sessionId) {
              try {
                const remoteSession =
                  clientCtx?.remote?.session ||
                  (typeof clientCtx?.get === 'function' ? clientCtx.get('remote.session') : null)
                if (remoteSession && typeof remoteSession.selectModel === 'function') {
                  res = await remoteSession.selectModel({
                    sessionId,
                    provider,
                    model,
                    ...(reasoningEffort !== undefined ? { reasoningEffort } : {})
                  })
                }
              } catch (rpcErr) {
                console.warn('[dsh-model-master] remote.session fallback attempt failed:', rpcErr)
              }
            }

            if (res && res.ok === false) {
              console.error('[dsh-model-master] select rejected by backend:', res.error)
              setOptimisticCurrent(null)
              const errMsg = res.error?.message || res.error?.code || t('channelNotReady')
              showSeatToast(t('switchFail', [errMsg]), 'error')
              return res
            }

            showSeatToast(t('seatToastOk', [targetModelName, reasoningEffort || '']), 'success')
            return { ok: true }
          } catch (err) {
            console.error('[dsh-model-master] select call threw:', err)
            setOptimisticCurrent(null)
            showSeatToast(t('switchError', [err.message || String(err)]), 'error')
            return { ok: false, error: err }
          }
        },
        [available, select, sessionId, resolvedGroups, showSeatToast]
      )

      // Compute display name of active model
      const currentDisplayName = useMemo(() => {
        if (!current) return t('selectModel')
        for (const g of resolvedGroups) {
          if (g && g.id === current.provider) {
            const m = (g.models || []).find(x => x && x.id === current.model)
            if (m) return m.name || m.id || '选择模型'
          }
        }
        return (current && current.model) || t('selectModel')
      }, [current, resolvedGroups])

      // Compute active model reasoning effort label
      const currentEffortLabel = useMemo(() => {
        if (!current) return null
        let reasoning = null
        for (const g of resolvedGroups) {
          if (g && g.id === current.provider) {
            const m = (g.models || []).find(x => x && x.id === current.model)
            if (m) {
              reasoning = m.reasoning
              break
            }
          }
        }
        if (!reasoning) return null
        const eff = current.reasoningEffort ?? reasoning.defaultEffort
        if (eff === undefined) return null
        const found = reasoning.efforts?.find(x => x.id === eff)
        return found ? found.name || found.id : eff
      }, [current, resolvedGroups])

      const closeModal = () => {
        setIsModalOpen(false)
        if (headless && typeof onDismiss === 'function') onDismiss()
      }

      return h(
        'div',
        {
          className: 'dmm-seat-container'
        },
        // Toast indicator right above composer seat trigger
        seatToast
          ? h(
              'div',
              {
                className:
                  "dmm-seat-toast ${seatToast.type === 'error' ? 'dmm-seat-toast-error' : 'dmm-seat-toast-success'}"
              },
              h('span', { className: 'dmm-toast-dot' }),
              seatToast.msg
            )
          : null,

        // Native chip mode (headless): no trigger of our own — the modal is
        // opened by the launcher intercepting the native composer chip.
        headless
          ? null
          : h(
              'button',
              {
                type: 'button',
                className: 'dmm-trigger-btn',
                disabled: locked || available === false,
                onClick: () => {
                  try {
                    load?.()
                  } catch {}
                  fetchBackendCatalog()
                  setIsModalOpen(true)
                },
                title: `${currentDisplayName}${currentEffortLabel ? ' · ' + currentEffortLabel : ''}`
              },
              // Minimalist model layer icon
              h(
                'svg',
                {
                  className: 'dmm-trigger-icon',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2
                },
                h('path', { d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' })
              ),
              h('span', { className: 'dmm-trigger-name' }, currentDisplayName || t('selectModel')),
              currentEffortLabel && h('span', { className: 'dmm-trigger-effort' }, currentEffortLabel),
              // Only real measurements earn a speed pill in the compact trigger —
              // gateway-ping estimates would be misleading at a glance.
              isBatchTesting
                ? h(
                    'span',
                    { className: 'dmm-trigger-pill', title: t('batchTestingTitle') },
                    t('batchTestingPill', [testingKeys.size])
                  )
                : currentBench && currentBench.success && currentBench.source !== 'gateway-ping'
                  ? h(
                      'span',
                      { className: 'dmm-trigger-pill', title: `${speedBadge.ttftText} · ${speedBadge.tpsText}` },
                      speedBadge.tpsText
                    )
                  : null,
              h(
                'svg',
                {
                  className: 'dmm-trigger-chevron',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2
                },
                h('polyline', { points: '6 9 12 15 18 9' })
              )
            ),

        // Spotlight Floating Modal
        isModalOpen
          ? h(ModelMasterSpotlightModal, {
              isOpen: isModalOpen,
              onClose: closeModal,
              groups: resolvedGroups,
              currentSelection: current,
              onSelectModel: handleSelectModel,
              benchmarkResults,
              onRunProbe: handleRunProbe,
              onBatchTest: handleBatchTest,
              onCancelBatchTest: handleCancelBatchTest,
              isBatchTesting,
              testingKeys,
              leaderboardData,
              onRefreshLeaderboard: handleRefreshLeaderboard,
              isRefreshingLeaderboard,
              probeSamples,
              onProbeSamplesChange: handleProbeSamplesChange,
              onClearResult: handleClearResult,
              onClearAllResults: handleClearAllResults,
              catalogStatus,
              catalogError,
              onRetryCatalog: fetchBackendCatalog,
              lastBatchSummary
            })
          : null
      )
    }

    // ── Plugin Definition ───────────────────────────────────────────────────
    // The plugin-level inject surface, declared at the factory scope so the
    // exports below can read it. EffortFX (further down) consumes the same
    // service list; Cordis resolves each service against the *calling* ctx, so
    // `remote` / `remote.session` must appear here as well.
    const inject = ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories']

    /**
     * Global launcher: the NATIVE composer model chip stays native — we no
     * longer shadow the `conversation.input.model` slot. A capture-phase
     * document listener intercepts clicks on the native chip and opens the
     * Model Master spotlight instead of the native dropdown.
     */
    // Native UI stays fully native: the first-level chip, its menu and the
    // reasoning-effort item are untouched. We only intercept the moments that
    // would open the native's cramped model-list popup and show the Model
    // Master spotlight instead:
    //   1. model-selected state — the native menu item "模型 <name>"
    //   2. no-model state      — the chip itself ("请选择模型") opens the list
    function findNativeModelEntry(target) {
      if (!target || typeof target.closest !== 'function') return null
      try {
        const item = target.closest('[role="menuitem"]')
        if (item) {
          const text = (item.textContent || '').trim()
          if (/^模型/.test(text) || text.includes('切换模型')) return item
          return null // e.g. 推理等级 — stays native
        }
        const chip = target.closest('[data-slot="conversation.input.model"] button')
        if (chip && (chip.getAttribute('aria-label') || chip.title || '').includes('请选择模型')) return chip
        return null
      } catch {
        return null
      }
    }

    // Read-only session discovery: walk up the React fiber tree from the
    // clicked native element and take the first `sessionId` prop we meet.
    function resolveSessionIdFromDom(el) {
      try {
        const holder = el.closest('[data-session-id]')
        if (holder) return holder.getAttribute('data-session-id')
        const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'))
        let fiber = fiberKey ? el[fiberKey] : null
        let hops = 0
        while (fiber && hops++ < 60) {
          const props = fiber.memoizedProps
          if (props && typeof props === 'object') {
            if (typeof props.sessionId === 'string' && props.sessionId) return props.sessionId
            if (props.session && typeof props.session === 'object' && typeof props.session.id === 'string')
              return props.session.id
          }
          fiber = fiber.return
        }
      } catch {}
      return null
    }

    // ── Anti-hijack: if another plugin takes over the native model slot,
    // our panel loses its only entry. A tiny presence store watches the
    // native chip; when it disappears (or stops looking native), a fallback
    // trigger appears in the composer toolbar so the panel is always reachable.
    function nativeModelChipPresent() {
      const btn = document.querySelector('[data-slot="conversation.input.model"] button')
      if (!btn) return false
      const label = btn.getAttribute('aria-label') || btn.title || ''
      // 模型/model: 中文与英文 locale 的原生标签都认
      return btn.getAttribute('aria-haspopup') === 'menu' && /模型|model/i.test(label)
    }

    const chipPresence = {
      listeners: new Set(),
      // Optimistic initial value: assume native until proven otherwise, so the
      // fallback never flashes during boot (before the composer mounts).
      present: true,
      started: false,
      subscribe(fn) {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
      },
      getSnapshot() {
        return this.present
      },
      notify() {
        for (const fn of this.listeners) {
          try {
            fn()
          } catch {}
        }
      },
      check() {
        const next = nativeModelChipPresent()
        if (next !== this.present) {
          this.present = next
          this.notify()
        }
      },
      start() {
        if (this.started || typeof document === 'undefined' || typeof MutationObserver !== 'function') return
        this.started = true
        // No immediate correction at boot — the composer may not be mounted
        // yet; first verdict comes from the delayed check below (childList:
        // slot takeover swaps nodes; attributes: native signature drift).
        const mo = new MutationObserver(() => setTimeout(() => this.check(), 300))
        mo.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-haspopup', 'aria-label', 'title', 'class']
        })
        // Post-boot verdict: by 1.5s the composer has settled
        setTimeout(() => this.check(), 1500)
      }
    }

    function FallbackModelTrigger(props) {
      const present = useSyncExternalStore(
        useCallback(fn => chipPresence.subscribe(fn), []),
        () => chipPresence.getSnapshot()
      )
      const sessionId =
        typeof props.sessionId === 'string' && props.sessionId
          ? props.sessionId
          : typeof props.__sessionKey === 'string'
            ? props.__sessionKey
            : null
      if (present) return null
      return h(
        'button',
        {
          type: 'button',
          className: 'dmm-fallback-btn',
          title: t('fallbackTitle'),
          onClick: () => {
            window.dispatchEvent(new CustomEvent('dmm-open-model-master', { detail: { sessionId } }))
          }
        },
        IcoLayers(12),
        t('selectModel')
      )
    }

    function ModelMasterLauncher() {
      const [sessionId, setSessionId] = useState(null)
      useEffect(() => {
        // Fallback trigger (rendered in the host tree) opens the panel through
        // a window event — the launcher lives in its own React root.
        const onOpen = e => {
          const detail = e.detail || {}
          let sid = detail.sessionId || null
          if (!sid) {
            const chip = document.querySelector('[data-slot="conversation.input.model"] button')
            if (chip) sid = resolveSessionIdFromDom(chip)
          }
          setSessionId(sid ?? '')
        }
        window.addEventListener('dmm-open-model-master', onOpen)
        return () => window.removeEventListener('dmm-open-model-master', onOpen)
      }, [])
      useEffect(() => {
        const onClick = e => {
          const entry = findNativeModelEntry(e.target)
          if (!entry) return
          e.preventDefault()
          e.stopPropagation()
          // Dismiss the native menu that hosted the entry before opening ours:
          // send both an outside-mousedown and Escape — different menu
          // implementations listen to either signal.
          try {
            document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
            const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
            ;(document.activeElement || document.body).dispatchEvent(esc)
          } catch {}
          setSessionId(resolveSessionIdFromDom(entry) ?? '')
        }
        document.addEventListener('click', onClick, true)
        return () => document.removeEventListener('click', onClick, true)
      }, [])
      if (sessionId === null) return null
      return h(
        ModelMasterErrorBoundary,
        null,
        h(ModelMasterComposerSeatInner, {
          key: sessionId,
          sessionId: sessionId || undefined,
          headless: true,
          onDismiss: () => setSessionId(null)
        })
      )
    }

    function apply(ctx) {
      clientCtx = ctx

      if (typeof document === 'undefined') return
      const host = document.createElement('div')
      host.id = 'dsh-model-master-launcher'
      document.body.appendChild(host)
      if (typeof ReactDOM.createRoot !== 'function') {
        console.error('[dsh-model-master] ReactDOM.createRoot unavailable — cannot mount launcher')
        return
      }
      ReactDOM.createRoot(host).render(h(ModelMasterLauncher))

      // 推理档位 FX（官方菜单滑条 + 芯片闪动），失败不拖累面板
      if (typeof EffortFX !== 'undefined') EffortFX.start(ctx)

      // Anti-hijack fallback entry: renders only while the native chip is gone
      try {
        chipPresence.start()
        const slots = (typeof ctx.get === 'function' ? ctx.get('slots', false) : null) || ctx.slots
        if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
          slots.inject('conversation.input.right', () => {
            return slots.register(
              {
                name: 'conversation.input.right',
                id: 'model-master-fallback',
                order: 45,
                label: () => 'Model Master fallback',
                inject: sessionId => ({ __sessionKey: sessionId })
              },
              FallbackModelTrigger
            )
          })
        }
      } catch (fallbackErr) {
        console.warn('[dsh-model-master] fallback entry unavailable:', fallbackErr)
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       推理档位 FX 模块（v1.5.0 并入）

       移植自：
         dsh-better-panel          https://github.com/Bai-2008/dsh-better-panel          (MIT)
         其上游 dsh-codex-effort-slider
                                   https://github.com/Microqian2th/dsh-codex-effort-slider (MIT)

       版权声明见 LICENSE，涵盖范围与修改记录见 THIRD-PARTY-NOTICES.md。

         · 官方菜单「推理等级」行滑条：拖动渐变填充 / 星尘粒子 / Max 紫边辉光
         · 档位切换瞬间：原生芯片上的一次性能量闪动
       独立 IIFE 作用域；样式类名前缀 ces-/dbp- 自带独立 marker，
       与面板本体（dmm-*）互不干扰。零模型槽占用，仅注册工具行隐藏锚点。
       ═══════════════════════════════════════════════════════════════════════ */
    const EffortFX = (function (React, ReactDOM) {
      /**
       * 包名 —— **必须排在最前**：下面好几个常量都由它拼出来。
       *
       * 踩过的坑：`PACKAGE_ID` 原本声明在 `PICKER_STYLE_MARKER` **之后**，同为 `var`（hoisting 后
       * 是 `undefined`），于是那个标记实际是 `"undefined/picker"`（真机复现，`<style>` 上就是它）。
       * 当时不炸（仍是稳定且唯一的字符串，去重照常），但把包命名空间弄丢了：
       * 万一有第二张 `data-plugin-css="undefined/picker"` 的样式表（同类插件抄这个写法就会），
       * `installStyles` 会**复用它**，`.cxp-*` 整套规则就再也注入不进去。
       */
      var PACKAGE_ID = 'dsh-model-master/effort-fx'

      var SLOT_NAME = 'conversation.input.right'
      var ENTRY_ID = 'codex-effort-slider'
      var ENTRY_ORDER = 40
      /**
       * 历史开关，现恒为 `true`：官方菜单「推理等级」行的滑条是**唯一**接线路径。
       *
       * 它曾经是"二选一"的扳手 —— `false` 时走自建浮层（`codex-picker-trigger` /
       * `codex-picker-panel`），`true` 时改造官方菜单那一行。自建浮层已随
       * dsh-better-panel 一并移除（v1.5.2），`false` 分支再无可执行的代码，于是
       * 这个分支被删除，常量保留下来只作说明。**不要再把它改成 `false`**：
       * 现在的 `apply()` 只有这一个接线点。
       */
      var ENABLE_OFFICIAL_MENU_SLIDER = true
      var ROW_PADDING_BLOCK = '10px'
      /** 官方那一行的中文/英文文案（形状锚点之一；认不出就按官方固定顺序取第 2 个 menuitem）。 */
      var EFFORT_ROW_LABELS = ['推理等级', 'Effort']
      /**
       * 拖动期间写回宿主的"停顿判定"（毫秒）—— 注意是**去抖**，不是节流。
       * 连续拖动时一次都不写回；指针停住这么久才落地；松手一律立即落地。
       *
       * 为什么必须去抖：每次写回都会让 DSH 改这个会话的推理档位（落盘 + 重渲染），
       * 原先按 120ms 节流，连续拖动相当于每秒打宿主 8 次，实测就是"拖动有点卡"。
       * 去抖之后连续拖动是 0 次，只在停手与松手各一次。
       */
      var COMMIT_SETTLE_MS = 260
      /** 提交后等宿主真实回报的上限；超时回滚并提示，不继续假装已生效。 */
      var COMMIT_DEADLINE_MS = 10000
      /** 目录解析失败时的退避重试序列（毫秒，累计约 9 秒）。 */
      var RETRY_DELAYS = [60, 240, 540, 960, 1500, 3000, 3000]
      /**
       * 目录实例的**主动复查**周期（毫秒）。
       *
       * 为什么必须要有一个主动信号：宿主重建该会话的 `ModelDirectory` 时（父子会话换 binding、
       * 会话作用域重建等），**旧实例已经被 dispose、再也不会推送** —— 只靠 store 订阅，客户端
       * 永远不知道要换，界面就静默冻在旧档位表上，而写路径却进了新实例。
       * 复查在实例没变时是**空操作**（`resolve()` 里 `fresh === directory` 直接返回、也不 notify），
       * 所以它不会引起无谓重渲染。
       */
      var DIRECTORY_HEARTBEAT_MS = 1500
      /**
       * 「目录就绪但**空**」时主动刷全局目录的冷却与次数上限。
       *
       * 场景：宿主 `buildModelCatalog()` 只列**当前已注册的 LLM provider**，DSH 刚起来时 provider
       * 可能还没注册完 → 返回一个合法的空目录，而它**会被缓存**（`status === "ready"` 之后
       * `load()` 直接短路）。官方那边靠远端事件 `llm/adapters-updated` 调 `refresh()` 治，
       * 那些事件不一定在启动后再来；1.3.2 接管官方席之后我们又是唯一的读取方。
       * 所以自己刷一下 —— 但**必须限量**：8 秒一次、最多 3 次，绝不会变成 RPC 风暴。
       */
      var CATALOG_REFRESH_COOLDOWN_MS = 8000
      var CATALOG_REFRESH_MAX = 3
      var STYLE_MARKER = PACKAGE_ID

      /* ── 尺寸与速率常量：**必须声明在 CSS 数组之前**，因为样式表要插值它们 ──
       （踩过一次：CSS 数组先于常量求值，样式里写进去的是 `height:undefinedpx`，
       真机上轨道会塌成 0 高。测试里对轨道高/旋钮直径的断言就是为这个加的。） */
      /**
       * 尺寸：**球比轨道大**（对齐 GPT 客户端的观感）—— 球浮在轨道之上，并压过轨道两端。
       * 比例取自 GPT 客户端实测：球直径 110px 对轨道高 80px ≈ 1.375，这里 28 / 20 = 1.4。
       */
      var KNOB_SIZE = 28
      var TRACK_HEIGHT = 20
      /** 球半径（同时是球的 margin 偏移量，用来把球心对准计算出的 left/top）。 */
      var KNOB_RADIUS = KNOB_SIZE / 2
      /**
       * 轨道端头的圆角半径 = 轨道高度的一半。
       * 圆心在两端各留出**这个**半径（不是球半径）：最左/最右档时球心正好落在端头圆心上，
       * 球于是压过轨道端头（GPT 客户端就是这个样子），同时又能把填充层那个半径为
       * TRACK_RADIUS 的左端半圆**完整盖住** —— off 档不会从球旁边漏出一丝颜色。
       */
      var TRACK_RADIUS = TRACK_HEIGHT / 2
      /**
       * 换档判定：指针从**当前档位**朝相邻档位越过两端间距的这个比例，才切到那一档。
       * 1/3 是用户指定的手感（不是取中点）——旋钮因此停在档位点上一格一格走，而不是跟手。
       */
      var DETENT_THIRD = 1 / 3
      /**
       * 换档时"滑过去"的过渡，**快慢两档**（用户要求）：
       *   · 快档：拖得快时用，快起步短尾巴，脆、跟手；
       *   · 慢档：拖得慢时用，球不至于"啪"一下窜过去、把手感扯断。
       * 四层（球 left、填充/能量/星空 width）共用 CSS 变量 `--ces-slide`，保证一起动、不撕开；
       * 跨多档时也是一段滑到位，不逐档连滑。
       */
      var SLIDE_EASE = '.16s cubic-bezier(.2,.9,.3,1)'
      /**
       * 慢档缓动换成与参考实现同一根曲线（`.34s cubic-bezier(.45,.05,.35,1)`）：
       * 两头慢、中段快，球"起步—滑到位—收住"的节奏比 `ease-in-out` 更像客户端。
       * 只改这一条曲线：快慢两档的**判据**与四层共用的 `--ces-slide` 机制都没动。
       */
      var SLIDE_EASE_SLOW = '.34s cubic-bezier(.45,.05,.35,1)'
      /**
       * 快慢判据 = **离上一次换档过了多久**（毫秒）：隔得久说明手在慢慢挪，就用慢档。
       * 两个阈值构成 120ms 迟滞，免得速度刚好卡在阈值上时快慢来回跳。
       */
      var SLOW_DRAG_ENTER_MS = 320
      var SLOW_DRAG_EXIT_MS = 200
      /** 全局速率倍数（用户要求：所有速度 ×4）。粒子时长 = 基准时长 ÷ (本值 × speedFor)。 */
      var BASE_SPEEDUP = 4
      /**
       * 星空的**基准横穿时长**（秒，越大越慢）与各星时长浮动（± 这个比例）。
       * 基准对应"位置速率最快的那一档"（speedFor 的上限 `MAX_SPEED_FACTOR = 2`）：MAX 档 1.5s，
       * high 档（1×）3s，左端（0.35×）约 8.6s —— 速度随位置变化这条一直保留。
       * 浮动压到 ±8%（速度差 1.16×）：原来用 0.95~2.05s（速度差 2.16×）时快星会追上慢星成团。
       */
      var STARFIELD_DURATION_MEAN = 1.5
      var STARFIELD_DURATION_SPREAD = 0.08
      /** MAX 档星空的亮度/大小下限（1 = 现在的大小与亮度，即上限）。 */
      var STARFIELD_MIN = 0.5
      /** 黄金比：把 22 颗星的高度与相位按低差异序列铺开（见 buildParticles / starDelayFor）。 */
      var GOLDEN_RATIO = 0.6180339887498949
      /** 位置速率的上限（= speedFor 的封顶值），用来把"最快那一档"和基准时长对齐。 */
      var MAX_SPEED_FACTOR = 2
      /** 系统开启「减少动态效果」时，星星时长乘这个倍数（放缓而不是冻住）。 */
      var REDUCED_MOTION_SLOWDOWN = 2.6
      /** 相位相邻的两颗星，高度至少差这么多"槽"（1 槽 = 4% 轨道高）——防止并成一坨。 */
      var MIN_HEIGHT_SLOTS = 3
      /** 能量段起点：第二档的刻度位置（4 档模型 → 1/3）。这一段以前是纯蓝，之后才渐入紫色。 */
      var ENERGY_START = 1 / 3

      /* ── 档位字典与徽标（移植自参考实现的数据层形状）────────────────────────── */

      /**
       * **档位字典**：官方档位 id → 官方默认显示名的本地副本。
       *
       * 与参考实现同一形状（9 个键：off/none/minimal/low/medium/high/xhigh/max/ultra），
       * 但**只当兜底**：真宿主的档位名来自官方目录（`model.reasoning.efforts[].name`），
       * 目录给了名字就用目录的。这份表有两个用处：
       *   1. `tiers()` 用它**校验**目录来的 id —— 对不上就是脏数据，按"不支持"处理；
       *   2. 目录条目**只给了 id、没给 name** 时用它补一个可读的名字。
       * 参考实现那份静态能力清单（`OPENAI_DEFS`）在真宿主里是**目录的活数据**，不在这里重建。
       */
      var LV = {
        off: { id: 'off', name: '关闭' },
        none: { id: 'none', name: 'None' },
        minimal: { id: 'minimal', name: 'Minimal' },
        low: { id: 'low', name: 'Low' },
        medium: { id: 'medium', name: 'Medium' },
        high: { id: 'high', name: 'High' },
        xhigh: { id: 'xhigh', name: 'X-High' },
        max: { id: 'max', name: 'Max' },
        ultra: { id: 'ultra', name: 'Ultra' }
      }

      /**
       * 档位 id → 字典条目。**两条兼容规则**：先把 id 折叠成小写、去掉空格与下划线
       * （`x-high`/`X_High`/`XHigh` 都认），再容忍 `reasoning_effort` 这类前缀。
       * 认不出返回 null（= 脏数据）。
       */
      function normalizeTierId(id) {
        if (typeof id !== 'string') return null
        var flat = id.replace(/[\s_-]+/g, '').toLowerCase()
        if (flat.length === 0) return null
        if (Object.prototype.hasOwnProperty.call(LV, flat)) return LV[flat]
        for (var key in LV) {
          if (!Object.prototype.hasOwnProperty.call(LV, key)) continue
          if (flat.length > key.length && flat.slice(-key.length) === key) return LV[key]
        }
        return null
      }

      /**
       * 档位列表 → `{ count, names }`；**任何一项认不出就返回 null**（调用方按不支持处理）。
       *
       * 参考实现里 `tiers()` 对未知档位名**直接抛错**，而那份数据是它自己写的常量，
       * 抛错只会暴露自己的笔误；真宿主的档位表是**运行时下发**的，这条纪律就变成
       * 工程约束里写的那句"一条脏数据最多禁用滑条，不能瘫痪整个 UI"：
       * 所以这里不抛，用 null 表达"这份数据我读不懂"。
       */
      function tiers(list) {
        if (!Array.isArray(list) || list.length === 0) return null
        var names = []
        for (var i = 0; i < list.length; i += 1) {
          var entry = list[i]
          if (!entry || typeof entry.id !== 'string' || entry.id.length === 0) return null
          var known = normalizeTierId(entry.id)
          if (known === null) return null
          var name = typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : known.name
          names.push(name)
        }
        return { count: names.length, names: names }
      }

      /* ── 模型徽标（官方模型列表每一行的"几档 / 不支持"）─────────────────── */

      /**
       * 契约里那张**真正的能力清单**（真实产物的 `dsh-client-ui-model-selection/lib/client.js`，
       * 逐字对照过）—— 只用来生成悬浮说明，并给「目录里查不到、也没有档位字段」的模型一个明示的
       * 「不支持」而不是一声不吭。目录一旦给出 `reasoning`，**目录优先**，这张表不参与判定。
       */
      var OPENAI_DEFS = [
        { id: 'gpt-6-astra', count: 8 },
        { id: 'gpt-6-sol', count: 8 },
        { id: 'gpt-6-luna', count: 7 },
        { id: 'gpt-6-spark', count: 5 },
        { id: 'gpt-5.6-sol', count: 8 },
        { id: 'gpt-5.6-terra', count: 8 },
        { id: 'gpt-5.6-luna', count: 7 },
        { id: 'gpt-5.6-spark', count: 5 },
        { id: 'gpt-6-astra-2026-01-13' },
        { id: 'gpt-4o', levels: null }
      ]
      /** 徽标上"不支持"用的替代名（目录条目是别的 provider / 快照 id 时，名字不一定等于 id）。 */
      var DEF_ALIASES = { 'gpt-6-astra-2026-01-13': 'gpt-6-astra' }

      /**
       * 三级检测（移植自参考实现的 `resolveModel`，只保留"目录查不到时"用的那一半）：
       *   1. 精确命中，且**显式声明了档位**（`count>0` 是有档位、`levels:null` 是已知不支持）
       *      → 就是它；
       *   2. 精确命中但没声明档位（快照 id，如 `gpt-6-astra-2026-01-13`）→ 顺着 `DEF_ALIASES`
       *      落到家族条目（最多跳一次，**不递归** —— 参考实现那句
       *      `resolveModel(DEF_ALIASES[id] || id)` 在别名表没命中时会拿同一个 id 再进来一次，
       *      自环到爆栈；这里显式挡掉）；
       *   3. 最长前缀（分隔符 `-` 或 `@`）→ 快照/变体 id 继承家族档位；
       *   4. 都没有 → null（未知 → 不判定，交给目录）。
       */
      function resolveModel(id) {
        if (typeof id !== 'string' || id.length === 0) return null
        var byId = {}
        var i
        for (i = 0; i < OPENAI_DEFS.length; i += 1) byId[OPENAI_DEFS[i].id] = OPENAI_DEFS[i]

        var exact = byId[id]
        if (exact !== undefined && (exact.levels !== undefined || exact.count > 0)) return exact
        if (exact !== undefined) {
          var alias = DEF_ALIASES[id]
          var target = typeof alias === 'string' ? byId[alias] : undefined
          return target === undefined ? exact : target
        }

        var best = null
        for (i = 0; i < OPENAI_DEFS.length; i += 1) {
          var def = OPENAI_DEFS[i]
          if (!def.count) continue
          var isFamily = id.indexOf(def.id + '-') === 0 || id.indexOf(def.id + '@') === 0
          if (isFamily && (best === null || def.id.length > best.id.length)) best = def
        }
        return best
      }

      /**
       * 从**目录快照**建一张"provider → 模型 id → 档位"的能力索引。
       *
       * 这一张就是参考实现里 `OPENAI_DEFS` 的位置 —— 只不过在真宿主里它是**活数据**
       * （`state.groups[].models[].reasoning.efforts`），而不是客户端写死的能力清单。
       *
       * 读不懂的条目**不抛错、不中断**：整条 `models` 扫描包在 try/catch 里，
       * 某一行坏了只影响那一行的徽标（`tiers()` 返回 null → 按"不支持"灰显）。
       */
      function buildCatalogIndex(state) {
        var groups = state && Array.isArray(state.groups) ? state.groups : []
        var index = { byProvider: {}, models: [] }
        for (var i = 0; i < groups.length; i += 1) {
          var group = groups[i]
          if (!group || typeof group.id !== 'string') continue
          var models = Array.isArray(group.models) ? group.models : []
          if (!index.byProvider[group.id]) index.byProvider[group.id] = {}
          var bucket = index.byProvider[group.id]
          for (var j = 0; j < models.length; j += 1) {
            try {
              var model = models[j]
              if (!model || typeof model.id !== 'string' || model.id.length === 0) continue
              var reasoning = model.reasoning
              var entry = {
                id: model.id,
                name: typeof model.name === 'string' && model.name.length > 0 ? model.name : model.id,
                provider: group.id,
                // reasoning 缺席 = 该模型没有推理档位；档位本身认不出也是 null
                tiers: reasoning === null || reasoning === undefined ? null : tiers(reasoning.efforts),
                defaultTier: reasoning && typeof reasoning.defaultEffort === 'string' ? reasoning.defaultEffort : null
              }
              bucket[model.id] = entry
              index.models.push(entry)
            } catch (error) {
              /* 一条脏数据最多让这一行的徽标消失，绝不瘫痪整个界面 */
            }
          }
        }
        return index
      }

      /** 目录优先、静态清单兜底：某个模型的档位信息。 */
      function tiersForModel(index, modelId) {
        if (index && index.models) {
          for (var i = 0; i < index.models.length; i += 1) if (index.models[i].id === modelId) return index.models[i]
        }
        var def = resolveModel(modelId)
        if (def === null) return null
        return {
          id: modelId,
          name: def.name || (DEF_ALIASES[modelId] ? DEF_ALIASES[modelId] : modelId),
          provider: null,
          tiers: def.levels === null ? null : def.count > 0 ? { count: def.count, names: [] } : null,
          defaultTier: def.def || null
        }
      }

      /** 徽标文案：`8 档` / `不支持`。 */
      function tierCountLabel(tier) {
        return tier === null || !tier.tiers ? '不支持' : tier.tiers.count + ' 档'
      }

      /**
       * 菜单内的 focus 统一入口（移植参考实现的 `focusNoScroll`）。
       *
       * 官方换内容时会 `.focus()` 一行，而**不带 preventScroll** 的 focus 会让浏览器把
       * 最近的可滚动祖先滚到那一行 —— 结果就是"翻页那一下动画被 scroll-into-view 吃掉"。
       * 官方自己的那句我们改不了（在它自己的 bundle 里），所以这里做两件事：
       *   1. 我们自己的 focus 一律走这个包装（将来要聚焦什么都不必再想这件事）；
       *   2. 官方那次聚焦的后果由桥在 mutation 回调里**同步**清掉（早于绘制，见 stabilizeScroll）。
       * `if (el)` 的保护是必须的：调用点常常来自可能为 null 的查询结果。
       */
      function focusNoScroll(el) {
        try {
          if (el && typeof el.focus === 'function') el.focus({ preventScroll: true })
        } catch (error) {
          /* 聚焦失败只影响键盘可达性，绝不影响注入与拖动 */
        }
      }
      /** 颜色锚点：紫出现在这里（4 档模型 → high 档）。 */
      var ENERGY_END = 2 / 3

      /** 蓝 → 紫 → 深紫（"第一档到第二档为蓝色，再往右逐渐变紫变深"）。 */
      var COLOR_BLUE = [77, 147, 248]
      var COLOR_VIOLET = [147, 51, 234]
      var COLOR_DEEP = [76, 29, 149]
      /**
       * 数值文字（"Max"）用的亮紫终点。
       * 文字不能像填充那样收到深紫（`COLOR_DEEP` 在深色底上几乎看不见），所以另给一个亮端；
       * 但也不能太亮 —— 实测 `#c084fc` 在**浅色主题**下对比度只有 2.6:1（发虚），
       * 所以取中档紫罗兰 `#8b5cf6`：对白底 ≈4.2:1、对深色底（#1b1c20）≈4.0:1，两种主题都读得清。
       */
      var COLOR_TEXT_VIOLET = [139, 92, 246]

      /* ════════════════════════════ 样式 ════════════════════════════ */

      /*
       * 颜色一律走 DSH 自己的设计令牌（`--dsw-*`），浅色/深色自动跟随。
       * 蓝色强调色用 `--dsw-alias-state-business-primary`（深色下 = deepseek-400 #7aaaff），
       * 回退到 blue-450 #4d93f8 —— 也就是参考图里那条轨道的蓝。
       */
      var CSS = [
        /* ⚠️ 本插件所有圆角都必须显式写 `corner-shape:round`。
         DSH 主题（@deepseek-ai/dsh-client-ui-theme）全局做了：
             @supports (corner-shape:superellipse(1.5)){
               :root{--dsw-corner-shape:superellipse(1.5)}
               *,:before,:after{corner-shape:var(--dsw-corner-shape)}
             }
         于是**每个元素**的 border-radius 都按超椭圆渲染：`border-radius:50%` 画出来是
         "圆角矩形"（squircle），不是正圆 —— 球看着像方块就是这个原因。
         DSH 自己的 Switch 同样处理（"capsule track and circular thumb opt out of the
         global superellipse"），所以这里照做：要圆就写 round。
         `*` 的特异度是 (0,0,0)，我们每条规则是 (0,1,0)，直接声明即可覆盖，无需 !important。 */
        /* 注入进官方那一行的容器：折行到第二行并铺满整行。
         `--ces-slide` 是**换档滑动**的过渡（快慢两档）：默认快档，拖慢了就换成慢档（见下面的
         data-slide 规则）。四层都读这个变量，所以切换档位时它们必然同步。 */
        '.ces-inline{--ces-accent:var(--dsw-alias-state-business-primary,var(--dsw-static-blue-450,#4d93f8));--ces-slide:' +
          SLIDE_EASE +
          ';box-sizing:border-box;flex-basis:100%;width:100%;min-width:0}',
        /* 拖得慢 →（用户要求）动画也慢。只换变量值，不碰各层自己的 transition 声明，
         这样「减少动态效果」那条 transition:none 仍然压得住（同类选择器、源序在后）。 */
        ".ces-inline[data-slide='slow']{--ces-slide:" + SLIDE_EASE_SLOW + '}',
        '.ces-track{position:relative;box-sizing:border-box;height:' +
          TRACK_HEIGHT +
          'px;margin-top:2px;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l1,rgba(15,17,21,.08));cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}',
        /* 填充层：**左端圆角 = 轨道端头半径**（轨道高度的一半），右端留直角。
         左端必须与轨道自身的端头圆角同心等径：写成 999px 的话，在窄填充上（off 档宽度
         只有一个半径）CSS 会把四角一起收缩，填充轮廓就从球里鼓出去，在球左侧漏出一弯
         蓝色月牙。右端永远是直角，且永远躲在球内 —— 填充终点 = 球心，而球在其圆心那一
         列占满 2×KNOB_RADIUS（≥ 轨道高度）。 */
        '.ces-fill{position:absolute;top:0;bottom:0;left:0;border-radius:' +
          TRACK_RADIUS +
          'px 0 0 ' +
          TRACK_RADIUS +
          'px;corner-shape:round;transition:width var(--ces-slide);pointer-events:none}',
        '.ces-tick{position:absolute;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;corner-shape:round;background:color-mix(in srgb,var(--dsw-alias-label-primary,#0f1115) 26%,transparent);pointer-events:none;transition:opacity .18s ease}',
        ".ces-tick[data-on='1']{background:rgba(255,255,255,.5)}",
        /* Max 档：只保留**当前位置**那一个定位点（它本来就被旋钮完整盖住），其余档位的点淡出。
         这一档轨道已经变成紫色星云，灰/白小点压在上面只剩噪点。
         只改透明度、不移除节点：拖动时不会增删 DOM，也就不会打断拖拽与动画。 */
        ".ces-inline[data-max='1'] .ces-tick[data-current='0']{opacity:0}",
        /* 旋钮 = 球：比轨道高，上下各浮出 TRACK_RADIUS-(TRACK_HEIGHT/2) 的一半。
         描边刻意很淡（GPT 客户端实测只有 ~6% 的压暗、约 5px 的软光晕），
         球压在轨道上时靠它把轮廓分出来，压在卡片上时也不脏。 */
        '.ces-knob{position:absolute;top:50%;width:' +
          KNOB_SIZE +
          'px;height:' +
          KNOB_SIZE +
          'px;margin:' +
          -KNOB_RADIUS +
          'px 0 0 ' +
          -KNOB_RADIUS +
          'px;border-radius:50%;corner-shape:round;transition:left var(--ces-slide);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.16),0 0 0 1px rgba(0,0,0,.05);pointer-events:none}',
        '.ces-error{margin-top:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#e5484d)}',
        /* ── 最高档能量层（纯视觉：紫色星云 + 星尘粒子 + 扫光）─────────────────
         强度由 `--ces-energy`(0..1) 一个变量驱动：外层只做 opacity/box-shadow，
         所以"渐入"是浏览器合成的颜色插值，不需要 JS 逐帧改样式。
         关掉时把粒子动画 `animation-play-state: paused`，不让 22 个隐形元素白烧 GPU。 */
        ".ces-inline[data-energy='1'] .ces-track{box-shadow:0 0 calc(var(--ces-energy,0) * 16px) rgba(168,85,247,.5)}",
        ".ces-inline[data-energy='0'] .ces-star,.ces-inline[data-energy='0'] .ces-energy__sweep{animation-play-state:paused}",
        /* 能量层只覆盖**已填充那一段**（宽度与填充相同）：档位右边没到的部分不显示能量条。
         左端从 0 起、宽度由内联样式给（= 到旋钮圆心），所以它跟着旋钮一起长。 */
        '.ces-energy{position:absolute;top:0;bottom:0;left:0;border-radius:' +
          TRACK_RADIUS +
          'px 0 0 ' +
          TRACK_RADIUS +
          'px;corner-shape:round;overflow:hidden;pointer-events:none;opacity:var(--ces-energy,0);transition:opacity .2s ease,width var(--ces-slide);background:linear-gradient(90deg,#3b1178 0%,#6d28d9 30%,#9333ea 62%,#c084fc 100%)}',
        /* 星星单独一层：**不跟着星云淡入**（否则 high 档会被星云的 0.5 透明度压得看不见）。
         几何与星云层相同（贴着已填充段、圆角裁切），透明度由内联样式给。 */
        '.ces-stars{position:absolute;top:0;bottom:0;left:0;border-radius:' +
          TRACK_RADIUS +
          'px 0 0 ' +
          TRACK_RADIUS +
          'px;corner-shape:round;overflow:hidden;pointer-events:none;transition:opacity .2s ease,width var(--ces-slide)}',
        /* 星空（**所有出现粒子的档位都用这一套**）：外层是**整轨宽度**的轨道
         （它自己在做 -100% 的连续横穿），内层圆点的亮度/大小由 --ces-b 决定（越亮越大）。
         残影只在两端淡出，而那两端在可视区外，所以看起来粒子"从不消失"。

         ⚠️ 时长与相位**直接内联**写在元素上（见组件的 animationDuration / animationDelay），
         不走 CSS 变量：实测把 `animation-delay:var(--ces-delay)` 写在样式表里时，
         真宿主里负相位不生效 —— 结果是"一打开所有星星挤在起点，十几秒后才靠速度差散开"。
         `--ces-b`（亮度/大小）只是不参与动画计时的普通变量，留着没问题。 */
        '.ces-star{position:absolute;left:0;right:0;height:3px;margin-top:-1.5px;pointer-events:none;animation-name:ces-star-sweep;animation-timing-function:linear;animation-iteration-count:infinite}',
        '.ces-star__dot{position:absolute;left:100%;top:0;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;background:#fff;box-shadow:0 0 4px rgba(255,255,255,.85);opacity:var(--ces-b,1);transform:scale(var(--ces-b,1))}',
        '@keyframes ces-star-sweep{0%{transform:translate3d(0,0,0);opacity:0}6%{opacity:1}94%{opacity:1}100%{transform:translate3d(-100%,0,0);opacity:0}}',
        '.ces-energy__sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 18%,rgba(255,255,255,.30) 50%,transparent 82%);transform:translateX(100%);animation:ces-sweep 2.4s linear infinite}',
        '@keyframes ces-sweep{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}',
        'body[data-ds-dark-theme] .ces-star__dot{background:#f5f3ff;box-shadow:0 0 5px rgba(216,180,254,.95)}',
        /* 系统要求「减少动态效果」时**放缓**而不是冻住：收起扫光。
         星星的放缓在 JS 里算（时长 × REDUCED_MOTION_SLOWDOWN）—— 不走 CSS 媒体查询，
         因为时长现在是内联的，也免得再引入"变量参与动画计时"这类坑。 */
        '@media (prefers-reduced-motion: reduce){.ces-energy{transition:none}.ces-tick{transition:none}.ces-knob{transition:none}.ces-fill{transition:none}.ces-stars{transition:none}.ces-energy__sweep{display:none}}',
        /* ── 禁用态：**渲染函数的完整投影**（移植自参考实现）──────────────────
         参考实现用 `classList.toggle("disabled", unsupported)` —— 第二参数每帧同时负责
         "加"与"移除"，所以禁用态永远等于"此刻算出来的状态"，不可能残留。
         这里照做，只是把类换成属性选择器（`data-disabled`），因为滑条根的类名与
         官方菜单的类名空间容易混：`[data-disabled="1"]` 是 (0,1,0)，与其它规则同权重。 */
        ".ces-inline[data-disabled='1']{opacity:.45;pointer-events:none}",
        ".ces-inline[data-disabled='1'] .ces-track{cursor:default}" /* ── 官方菜单里注入的三处小注记（徽标 / 归属 / API 值）───────────────
         全部用 DSH 设计令牌，浅深主题自动跟随；字体比官方的 13px 小一档，
         并且都 `flex:none` + 单行省略 —— 加进去只改观感，不改官方任何布局机制。 */,
        '.ces-menu-badge{flex:none;font-size:10.5px;line-height:16px;padding:0 6px;border-radius:6px;corner-shape:round;color:var(--dsw-alias-label-tertiary,#8a8f98);background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.06));white-space:nowrap}',
        ".ces-menu-badge[data-off='1']{color:var(--dsw-alias-label-caption,#9aa0ab);opacity:.75}",
        '.ces-menu-provider{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption,#9aa0ab);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px}',
        '.ces-menu-api{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-caption,#9aa0ab)}',
        /* ── 翻页（carousel）稳定化：**只压掉布局/滚动的二次位移，不碰官方动画** ──
         官方菜单是同一个面板里换内容（没有双页位移），翻页时的"接缝/闪一下"来自两件事：
           1. 官方 effect 里 `.focus()` 没带 preventScroll → 浏览器会把滚动容器滚到刚聚焦的那一行，
              换内容那一帧就多一次位移（那个容器就是下面这条 `.scrollable`）；
           2. 我们的滑条把"推理等级"那一行加高了 ~48px，浏览器为了不跳内容会**追加滚动**
              （scroll anchoring）。
         下面两条都是纯 CSS 的抑制：`overflow-anchor:none` 关掉 2，滚动位置的重置在
         JS 里（见桥的 `stabilizeScroll`，在换内容那一帧的 mutation 回调里同步做，早于绘制）。
         官方自己的可视结构、间距、圆角、阴影一个都没动，官方 class 一个都没被改写。 */
        '.ces-menu-stable{overflow-anchor:none}',
        '.ces-menu-stable .scrollable{overflow-anchor:none}'
      ].join('\n')

      /**
       * 把样式挂进文档。加载器会把它认领为「本插件产出的 style」（HMR 卸载时一并清理）。
       *
       * @param text   要注入的 CSS；省略 = 本文件那份 `CSS`（官方菜单那条控件）
       * @param marker `data-plugin-css` 的值，用来去重；省略 = 本文件的 STYLE_MARKER
       *
       * ⚠️ 这里踩过一个**真机才暴露**的坑：1.3.0 第一版把自建浮层的样式表当参数传进来
       * （向本函数传入浮层样式参数），可当时这个函数**不收参数** ——
       * 参数被静静丢掉，`.cxp-*` 整套规则从未注入。表现是：入口按钮在（chunk 加载好了），
       * 但面板**没有任何样式**、`position:fixed` 也没生效，于是内容摊进了页面流。
       * 教训：注入类函数的"参数被忽略"是静默失败，必须有断言盯着**文档里真的有那段 CSS**。
       */
      function installStyles(text, marker) {
        try {
          if (typeof document === 'undefined' || !document.head) return null
          var css = typeof text === 'string' && text.length > 0 ? text : CSS
          var tag = typeof marker === 'string' && marker.length > 0 ? marker : STYLE_MARKER
          var existing = document.querySelector('style[data-plugin-css="' + tag + '"]')
          if (existing) return existing
          var style = document.createElement('style')
          style.setAttribute('data-plugin-css', tag)
          style.textContent = css
          document.head.appendChild(style)
          return style
        } catch (error) {
          /* 样式失败只影响观感，绝不影响功能 */
          return null
        }
      }

      /* ════════════════════════ 纯函数（可离线单测）════════════════════════ */

      var EMPTY_SNAPSHOT = Object.freeze({
        current: null,
        groups: [],
        failures: [],
        status: 'idle',
        pending: null,
        error: null,
        retainedEffort: undefined
      })

      /** 在目录快照里找到当前模型条目（groups[].models[]）。 */
      function modelOf(state) {
        var current = state && state.current
        if (!current || typeof current.provider !== 'string' || typeof current.model !== 'string') return null
        var groups = state && Array.isArray(state.groups) ? state.groups : []
        for (var i = 0; i < groups.length; i += 1) {
          var group = groups[i]
          if (!group || group.id !== current.provider) continue
          var models = Array.isArray(group.models) ? group.models : []
          for (var j = 0; j < models.length; j += 1) {
            if (models[j] && models[j].id === current.model) return models[j]
          }
        }
        return null
      }

      /**
       * 当前模型真实可用的档位列表（官方 id + 官方显示名，按目录顺序）。
       *
       * 名字只有两种情况会用到 LV 字典：目录条目**没给 name**，或 name 是空白串。
       * 目录给什么就用什么 —— 官方菜单里那一行显示的就是 `efforts[].name`，
       * 插件盖掉它只会让"菜单说 High、滑条说 X-High"。
       */
      function levelsOf(state) {
        var model = modelOf(state)
        var efforts = model && model.reasoning && Array.isArray(model.reasoning.efforts) ? model.reasoning.efforts : []
        var out = []
        for (var i = 0; i < efforts.length; i += 1) {
          var effort = efforts[i]
          if (!effort || typeof effort.id !== 'string' || effort.id.length === 0) continue
          var fallback = normalizeTierId(effort.id)
          out.push({
            id: effort.id,
            name:
              typeof effort.name === 'string' && effort.name.length > 0
                ? effort.name
                : fallback !== null
                  ? fallback.name
                  : effort.id
          })
        }
        return out
      }

      /**
       * 当前**生效**的档位 id：显式设置优先；没设置过就是模型的默认档
       * （与官方 `syncInputs()` 的 `effort = intended.reasoningEffort ?? reasoning.defaultEffort` 同款）。
       */
      function effectiveEffortId(state) {
        var current = state && state.current
        if (current && typeof current.reasoningEffort === 'string' && current.reasoningEffort.length > 0) {
          return current.reasoningEffort
        }
        var model = modelOf(state)
        var fallback = model && model.reasoning && model.reasoning.defaultEffort
        return typeof fallback === 'string' && fallback.length > 0 ? fallback : null
      }

      function indexOfLevel(levels, id) {
        if (typeof id !== 'string') return -1
        for (var i = 0; i < levels.length; i += 1) if (levels[i].id === id) return i
        return -1
      }

      function clamp01(value) {
        if (!(value > 0)) return 0 // 同时挡住 NaN
        return value > 1 ? 1 : value
      }

      /** 档位下标 → 该档位在轨道上的百分比（刻度点与旋钮永远对齐）。 */
      function pctFromIndex(index, count) {
        if (count <= 1) return 0
        var safe = Math.max(0, Math.min(count - 1, index))
        return safe / (count - 1)
      }

      function errorText(error) {
        if (error === null || error === undefined) return '档位切换失败'
        if (typeof error === 'string') return error
        if (typeof error.message === 'string' && error.message.length > 0) return error.message
        if (typeof error.code === 'string' && error.code.length > 0) return error.code
        return String(error)
      }

      /* ─────────────────── 最高档能量层：参数与强度曲线 ─────────────────── */

      /**
       * 星尘粒子（星星）：**全部由下标算出，不用随机数** —— 每次渲染完全一致、可离线断言。
       *
       * 形态 = 3px 圆点；运动 = 横穿整条轨道（右 → 左），**不消失**、没有上下飘动。
       *
       * 高度与相位**必须用两条互不相关的分配**：
       *   · 相位 = 黄金比低差异序列（任意前缀都铺得开，拖动时逐渐加星也不会挤）；
       *   · 高度 = **随机排列**的等距槽位（哈希排序，确定性），并与相位排名解耦。
       * 早期版本这两者取自同一个数 `frac((i+1)×φ)`，结果"越靠右的星越高"，22 颗排成
       * 一条斜线（用户实测反馈"太规整，再随机一点"；相关系数实测 0.999）。
       * 再挑一个满足最小间隔的盐值：**相位相邻**（会在轨道上一直并排走）的两颗
       * 高度至少差 `MIN_HEIGHT_SLOTS` 槽，避免并成一坨。
       */
      var PARTICLES = (function buildParticles() {
        var count = 22
        var out = []
        var i
        for (i = 0; i < count; i += 1) {
          out.push({ y: 0, phase: ((i + 1) * GOLDEN_RATIO) % 1 })
        }
        // 相位排名：黄金比序列里排名相邻 = 在轨道上位置相邻
        var byPhase = []
        for (i = 0; i < count; i += 1) byPhase.push(i)
        byPhase.sort(function (a, b) {
          return out[a].phase - out[b].phase
        })
        // 高度槽：找一个满足"相位相邻至少差 MIN_HEIGHT_SLOTS 槽"的确定性随机排列
        var slots = null
        for (var salt = 71; salt < 4000 && slots === null; salt += 1) {
          var candidate = []
          for (i = 0; i < count; i += 1) candidate.push(i)
          candidate.sort(function (a, b) {
            var ha = starHash01(a, salt)
            var hb = starHash01(b, salt)
            return ha === hb ? a - b : ha - hb
          })
          var ok = true
          for (var k = 1; k < count && ok; k += 1) {
            if (Math.abs(candidate[k] - candidate[k - 1]) < MIN_HEIGHT_SLOTS) ok = false
          }
          if (ok) slots = candidate
        }
        if (slots === null) {
          // 兜底：步长 5 与 22 互质 → 一定是排列，且相邻槽恒差 5（≥ MIN_HEIGHT_SLOTS）
          slots = []
          for (i = 0; i < count; i += 1) slots.push((i * 5) % count)
        }
        for (var rank = 0; rank < count; rank += 1) {
          out[byPhase[rank]].y = 8 + (slots[rank] / (count - 1)) * 84
        }
        return out
      })()

      /* 颜色常量与 ENERGY_* 都声明在文件上部的「尺寸与速率常量」块里（供 CSS 插值用），
       这里只放纯函数 —— 不要再重复声明，否则会出现"改一处漏一处"的双份真相。 */

      function mixColor(from, to, t) {
        var k = clamp01(t)
        return [
          Math.round(from[0] + (to[0] - from[0]) * k),
          Math.round(from[1] + (to[1] - from[1]) * k),
          Math.round(from[2] + (to[2] - from[2]) * k)
        ]
      }

      function rgbOf(color) {
        return 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')'
      }

      /** 位置 → 填充色（当前点的颜色，也就是渐变右端的颜色）。 */
      function fillColorFor(pct) {
        var t = clamp01(pct)
        if (t <= ENERGY_START) return rgbOf(COLOR_BLUE)
        if (t <= ENERGY_END)
          return rgbOf(mixColor(COLOR_BLUE, COLOR_VIOLET, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)))
        return rgbOf(mixColor(COLOR_VIOLET, COLOR_DEEP, (t - ENERGY_END) / (1 - ENERGY_END)))
      }

      /**
       * 位置 → 填充层的背景：**左端恒为蓝，右端（旋钮处）是当前位置的颜色**。
       * 于是 high 档自然呈现"左蓝右紫"的渐变，越往右右端越深。
       */
      function fillBackgroundFor(pct) {
        return 'linear-gradient(90deg, ' + rgbOf(COLOR_BLUE) + ', ' + fillColorFor(pct) + ')'
      }

      /**
       * 位置 → **官方那一行数值文字**（"Max"）的颜色。
       *
       * 与能量同源：蓝 → 紫罗兰，越往右越紫（用户要求"Max 的字体颜色能不能改变"）。
       * 刻意**不跟填充末尾的深紫走** —— `COLOR_DEEP` 当文字在深色底上几乎看不见；
       * 文字需要一个亮端，所以终点用 `COLOR_TEXT_VIOLET`。
       *
       * **Off 档返回空串**：不写内联色 = 官方原本的灰（用户要求"off 档两个界面都是灰的"）。
       * 调用方直接 `style.color = valueColorFor(...)`，空串在浏览器里就是"清掉内联色"。
       */
      function valueColorFor(pct, level) {
        if (isOffLevel(level)) return ''
        return rgbOf(mixColor(COLOR_BLUE, COLOR_TEXT_VIOLET, energyFor(pct)))
      }

      /**
       * 是不是"关闭推理"那一档。
       *
       * DeepSeek 的档位表是 id `off` / name `Off`（见 `dsh-llm-deepseek/lib/index.js` 的
       * `REASONING_EFFORTS`），但 id 是 provider 自己的字符串，所以 id 和 name 都认一遍，
       * 并额外接受几个同义写法。认不出就是普通档位（照常着色）。
       */
      function isOffLevel(level) {
        if (!level) return false
        var candidates = [level.id, level.name]
        for (var i = 0; i < candidates.length; i += 1) {
          if (typeof candidates[i] !== 'string') continue
          var flat = candidates[i].replace(/\s+/g, '').toLowerCase()
          if (flat === 'off' || flat === 'none' || flat === '关闭' || flat === '无') return true
        }
        return false
      }

      /**
       * 位置 → 能量强度 0..1（紫色星云 + 粒子的总强度）。
       * **纯位置驱动，与档位数无关**：第二档以前为 0（保持干净的蓝），之后线性渐入到最高档的 1。
       * 锚点：pct=1/3 → 0；pct=2/3（4 档模型的 high）→ 0.5；pct=1（max）→ 1。
       */
      function energyFor(pct) {
        return clamp01((clamp01(pct) - ENERGY_START) / (1 - ENERGY_START))
      }

      /**
       * 位置 → 粒子速率倍数。
       * 锚点来自实测反馈：**high 档（4 档模型的 2/3 处）= 1×（也就是现在这个速度刚刚好）**，
       * 最高档 = 2×。再往左按同一斜率降速，但设 0.35× 下限，免得左端变成静止。
       */
      function speedFor(pct) {
        return Math.min(2, Math.max(0.35, 3 * clamp01(pct) - 1))
      }

      /** 位置 → 可见粒子数（"粒子效果逐渐出现、变密集"）。 */
      function particleCountFor(pct) {
        return Math.round(energyFor(pct) * PARTICLES.length)
      }

      /* ── 星空：所有出现粒子的档位都用这一套（统一的动画）────────────────────

       运动模型：外层是一条**整轨宽度**的轨道，自己在做 `translate3d(-100%)` 的连续横穿；
       圆点在最右端出生、向左穿出，残影只在两端淡出（而那两端在可视区外）→ **从不消失**。
       每颗的亮度/大小由确定性伪随机给出（越亮越大，0.5~1），速率随**位置**变化（速度变化保留）。 */

      /** 确定性伪随机 [0,1)：不用 Math.random（可离线断言、重渲染不跳变），但看起来是随机的。 */
      function starHash01(index, salt) {
        var value = ((index + 1) * salt * 2654435761) % 4294967296
        return ((value >>> 8) % 1000) / 1000
      }

      /** 第 index 颗粒子的亮度/大小系数，落在 [STARFIELD_MIN, 1]（越亮越大）。 */
      function starBrightnessFor(index) {
        return STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(index, 61)
      }

      /**
       * 第 index 颗粒子横穿整条轨道的时长（s）。
       * **保留速度随位置变化**：以 speedFor 上限（MAX 档）对齐基准时长 ——
       * MAX 档 1.5s、high 档（1×）3s、左端（0.35×）约 8.6s；各星之间只差 ±8%（防追尾成团）。
       */
      function starDurationFor(index, speedFactor) {
        var speed = Math.min(
          MAX_SPEED_FACTOR,
          Math.max(0.35, typeof speedFactor === 'number' ? speedFactor : MAX_SPEED_FACTOR)
        )
        var spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(index, 29)
        return ((STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR) / speed) * spread
      }

      /**
       * 第 index 颗粒子的相位（负延迟，单位 s）。
       *
       * 相位用**黄金比低差异序列**铺开，而且**只跟 index 有关、跟当前显示几颗无关** ——
       * 这一点很关键：如果按 `i / 当前数量` 算，拖动过程中粒子数变化会让每颗已挂载动画的
       * `animation-delay` 被改写，按规范当前进度会按新起始时间重算，整片星空就会抖一下/重排一次。
       * 低差异序列还有个好处：**任意前缀**（前 N 颗）本身就是均匀铺开的。
       */
      function starDelayFor(index, duration) {
        var particle = PARTICLES[index]
        var phase = particle && typeof particle.phase === 'number' ? particle.phase : 0
        var jitter = starHash01(index, 53) * 0.03 // 一点点抖动，避免看起来像整齐的队列
        return -((phase + jitter) % 1) * duration
      }

      /** 位置 → 可见星星数（"逐渐出现、变密集"）。 */
      function starCountFor(pct) {
        return particleCountFor(pct)
      }

      /**
       * 位置 → **星星层**的不透明度。
       *
       * 星星不能跟着星云一起淡入：星云层的透明度 = 能量强度，high 档只有 0.5，
       * 那么每颗星的实际不透明度会被压到 0.25~0.5，在紫色底上几乎看不见
       * （用户实测反馈："high 档一打开几乎没粒子"）。所以星星层单独给一个下限，
       * 只随能量轻微变化：high 档 0.8、MAX 档 1.0 —— "逐渐出现"交给**粒子数**去表达。
       */
      function starLayerOpacityFor(pct) {
        return 0.6 + 0.4 * energyFor(pct)
      }

      /**
       * 球心 / 填充终点 / 刻度的水平位置：`轨道端头半径 + pct × (100% − 端头直径)`。
       * 用**轨道**端头半径而不是球半径：pct=0/1 时球心正好落在轨道端头的圆心上，
       * 球于是压过轨道两端（GPT 客户端的观感），同时把填充层的左端半圆完整盖住。
       */
      function knobOffsetOf(pct) {
        var t = Math.round(clamp01(pct) * 10000) / 10000
        return 'calc(' + TRACK_RADIUS + 'px + ' + t + ' * (100% - ' + TRACK_RADIUS * 2 + 'px))'
      }

      /* ═════════════════ 官方目录访问（每会话一个，永不抛错）═════════════════ */

      /**
       * 每个会话一个访问器。它解决两件真实存在的事：
       *  1. `directoryFor(sessionId)` 在会话作用域/绑定尚未就绪时**按设计抛错**；
       *  2. 目录实例可能被重建（换模型代、连接重置），"抓一次揣着用"会变成永久坏的控件。
       * 所以每次读写都重新解析，解析失败就退避重试；订阅在一次成功解析后建立。
       */
      function createDirectoryAccess(ctx, sessionIds, timers) {
        var listeners = new Set()
        /**
         * **候选会话 id（按可信度排序）**。
         *
         * 为什么是一串而不是一个（真机事故，1.3.6）：渲染器给条目拼 props 的顺序是
         * `{...标准 kit, ...inject 的返回, ...槽注入, ...owner}` —— 而 `inject` 拿到的是
         * **`binding.key`**，它**不一定**等于 kit 里那个 `sessionId`。我们以前 `inject` 返回
         * `{sessionId}`，等于把 kit 里那个正确的值**盖掉**；一旦 `binding.key` 不是本会话的 id，
         * `directoryFor()` 就抛 "resolved no scope / no binding"，界面上只会显示"会话目录未就绪"，
         * 而官方的 `/model` 却一切正常（它用的是命令自己的会话 id）—— 那次排查就是这么绕进去的。
         *
         * 现在：kit 的值优先、inject 的值兜底，谁成功就钉住谁（失败时自动轮换）。
         */
        var candidates = []
        ;(Array.isArray(sessionIds) ? sessionIds : [sessionIds]).forEach(function (id) {
          if (typeof id === 'string' && id.length > 0 && candidates.indexOf(id) < 0) candidates.push(id)
        })
        /** 上一次成功的候选下标（下次从它开始试）。 */
        var activeIndex = 0
        /** 最近一次解析失败的原因（给界面用：把"为什么没就绪"说清楚）。 */
        var lastReason = ''
        var lastWarned = ''
        var directory = null
        var unsubscribe = null
        var last = EMPTY_SNAPSHOT
        var retryIndex = 0
        var retryTimer = null
        var closed = false
        var lastLoadAt = 0
        var heartbeatTimer = null
        /** load 失败后的退避重试（与"解析目录实例"的退避分开：这两件事失败的原因不同）。 */
        var loadRetryIndex = 0
        var loadRetryTimer = null
        /** 主动刷新**全局目录**的次数与时间戳（见 refreshCatalogIfEmpty）。 */
        var catalogRefreshes = 0
        var lastCatalogRefreshAt = 0

        function notify() {
          var current = []
          listeners.forEach(function (listener) {
            current.push(listener)
          })
          for (var i = 0; i < current.length; i += 1) {
            try {
              current[i]()
            } catch (error) {
              /* 单个订阅者抛错不影响其它订阅者 */
            }
          }
        }

        /**
         * 目录快照是不是"能拿来看"的：有 provider 组，或者宿主明确说已就绪。
         *
         * ⚠️ 为什么不能用 `status === "ready"` 一条判据：宿主那边 `buildModelCatalog()` 是把
         * **当前已注册的 LLM provider** 列出来（`ctx.llm.listProviders()`），启动期 provider 还没
         * 注册完时它会返回一个**合法的空目录**（`groups: []`、`failures: []`、status 照样是 ready）。
         * 那种"就绪但空"最坑：界面是"模型 + 没有 provider"，而且**再 load 也不会重新拉**
         * （`ModelCatalogDirectory.load()` 见到 status=ready 就短路返回缓存值）。
         */
        function snapshotUsable(snapshot) {
          if (!snapshot || typeof snapshot !== 'object') return false
          if (Array.isArray(snapshot.groups) && snapshot.groups.length > 0) return true
          return snapshot.status === 'ready' && Array.isArray(snapshot.failures) && snapshot.failures.length > 0
        }

        /** 当前目录的 store 快照（拿不到就 null）。 */
        function currentSnapshot() {
          if (directory === null) return null
          try {
            return directory.store.getSnapshot()
          } catch (error) {
            return null
          }
        }

        /** 当前目录的 store 快照是不是"能用"（拿不到实例 = 不能用）。 */
        function storeUsable() {
          return snapshotUsable(currentSnapshot())
        }

        /**
         * 还要不要继续退避重拉？
         *
         * **只治"目录根本没到"**（idle / loading / error）—— 这三种 `load()` 有希望改变现状。
         * "就绪但空"必须**排除**：那种情况下 `load()` 会成功返回、store 却依然空，
         * 退避计数器被重置 → 就变成 60ms 一轮的**活锁**（离线测试直接跑不完，真机上则是白打宿主）。
         * 它交给 `refreshCatalogIfEmpty`（有 8 秒冷却 + 3 次上限）去治。
         */
        function needsLoadRetry(snapshot) {
          if (!snapshot || typeof snapshot !== 'object') return true
          return snapshot.status !== 'ready' && snapshot.status !== 'selecting'
        }

        /**
         * 顺手**主动刷一次全局目录**：只在"就绪但空"时做（启动期 provider 还没注册的典型形态），
         * 而且有冷却与次数上限（不许变成 RPC 风暴）。
         *
         * 为什么需要它：那个空结果是**被缓存的** —— `ModelCatalogDirectory.load()` 见到
         * `status === "ready"` 就短路，所以光 `load()` 不会重新问宿主；官方那边靠
         * `llm/adapters-updated` 这类远端事件调 `refresh()` 来治，而**那些事件不一定在启动后再来**。
         * 1.3.2 之前有官方那颗席按钮跟我们一起渲染，它至少是另一个"再拉一次"的入口；
         * 接管之后我们是**唯一**的读取方，就得自己会治这一下。
         *
         * `catalog` 是官方 resolver 上的实例字段（不是 Service 方法）—— 属于**借用内部**：
         * 所以全程 typeof/try 兜住，官方哪天改了就静默退回"只显示空目录"，绝不抛给渲染层。
         */
        function refreshCatalogIfEmpty(snapshot) {
          if (closed || catalogRefreshes >= CATALOG_REFRESH_MAX) return
          if (!snapshot || typeof snapshot !== 'object') return
          if (!Array.isArray(snapshot.groups) || snapshot.groups.length > 0) return
          if (snapshot.status !== 'ready') return
          var now = Date.now()
          if (now - lastCatalogRefreshAt < CATALOG_REFRESH_COOLDOWN_MS) return
          var models = ctx && ctx.modelDirectories ? ctx.modelDirectories : null
          var catalog = models && models.catalog ? models.catalog : null
          if (catalog === null || typeof catalog.refresh !== 'function') return
          lastCatalogRefreshAt = now
          catalogRefreshes += 1
          try {
            catalog.refresh()
          } catch (error) {
            /* 借用的内部：失败就当没这回事（界面照旧显示"没有可用的 provider"） */
          }
        }

        /** load 失败（或 load 完 store 还不可用）→ 按退避再来，直到心跳接手。 */
        function scheduleLoadRetry() {
          if (closed || loadRetryTimer !== null || directory === null) return
          if (loadRetryIndex >= RETRY_DELAYS.length) return
          var delay = RETRY_DELAYS[loadRetryIndex]
          loadRetryIndex += 1
          loadRetryTimer = timers.set(function () {
            loadRetryTimer = null
            if (closed) return
            var snapshot = currentSnapshot()
            if (snapshotUsable(snapshot) || !needsLoadRetry(snapshot)) return
            kickLoad(true)
            if (!storeUsable()) scheduleLoadRetry()
          }, delay)
        }

        function scheduleRetry() {
          if (closed || retryTimer !== null || retryIndex >= RETRY_DELAYS.length) return
          var delay = RETRY_DELAYS[retryIndex]
          retryIndex += 1
          retryTimer = timers.set(function () {
            retryTimer = null
            // 解析成功后要主动通知一次：调用方（uSES）正等着 store 出现。
            if (resolve() !== null) {
              notify()
              return
            }
            // 还没就绪就继续退避 —— 少了这一句，第一次重试失败后自愈链就永久断掉，
            // 控件会静默失效（这正是要防的那种"一次启动期抖动变成永久坏控件"）。
            scheduleRetry()
          }, delay)
        }

        /** 重新解析一次目录；实例变化时重挂订阅。返回当前目录（可能为 null）。 */
        function resolve() {
          if (closed) return null
          var fresh = null
          if (candidates.length === 0) {
            noteReason('拿不到会话 id（标准 props 与 binding.key 都是空的）')
            return directory
          }
          /*
           * 逐个候选试：`directoryFor(id)` 按设计会对"解析不出 scope/binding 的会话 id"**抛错**，
           * 所以"错的 id"在这里表现为异常，而不是 null —— 抛了就换下一个候选（见上面的长注释）。
           */
          for (var i = 0; i < candidates.length && fresh === null; i += 1) {
            var index = (activeIndex + i) % candidates.length
            var id = candidates[index]
            try {
              var hit = ctx.modelDirectories.directoryFor(id)
              if (hit && hit.store && typeof hit.store.getSnapshot === 'function') {
                fresh = hit
                activeIndex = index
                lastReason = ''
              } else {
                noteReason('directoryFor("' + id + '") 没有返回可用的目录')
              }
            } catch (error) {
              noteReason(error && error.message ? String(error.message) : String(error))
            }
          }
          if (fresh === directory) return directory
          if (unsubscribe !== null) {
            try {
              unsubscribe()
            } catch (error) {
              /* 退订失败不影响新订阅 */
            }
            unsubscribe = null
          }
          directory = fresh
          if (directory !== null) {
            retryIndex = 0
            try {
              unsubscribe = typeof directory.store.subscribe === 'function' ? directory.store.subscribe(notify) : null
            } catch (error) {
              unsubscribe = null
            }
            kickLoad()
          }
          return directory
        }

        /**
         * 记下失败原因：**每换一条新原因往控制台报一次**（同一条不重复刷屏）。
         *
         * 以前这里是静默 catch —— 结果真机上"拿不到目录"只表现为面板上一句"未就绪"，
         * 具体是 no scope 还是 no binding、是哪个 id，全都看不见，只能靠猜。
         */
        function noteReason(message) {
          lastReason = message
          if (message === lastWarned) return
          lastWarned = message
          try {
            if (typeof console !== 'undefined' && console.warn) {
              console.warn('[' + PACKAGE_ID + '] 会话目录还没就绪：' + message)
            }
          } catch (error) {
            /* 控制台不可用就算了 */
          }
        }

        /**
         * 主动复查 + 兜底重拉：心跳与"面板打开"都会走到这里。
         *
         * 返回是否换了目录实例。
         */
        function recheck() {
          if (closed) return false
          var before = directory
          var after = resolve()
          notifyLoadFallbacks()
          if (after !== null && after !== before) {
            notify()
            return true
          }
          return false
        }

        /**
         * 目录"没到能用"时统一在这里补两件事：
         *   1. **就绪但空** → 主动刷一次全局目录（有冷却/上限）；
         *   2. **还没就绪 / 上一轮 load 失败或卡住** → 再拉一次（`kickLoad` 自带 400ms 节流）。
         * 心跳会周期性地走到这里，所以启动期的一次抖动不会再变成"永久空目录"。
         */
        function notifyLoadFallbacks() {
          if (closed || directory === null) return
          var snapshot = currentSnapshot()
          if (snapshotUsable(snapshot)) return
          refreshCatalogIfEmpty(snapshot)
          if (needsLoadRetry(snapshot)) kickLoad()
        }

        /**
         * 心跳定时器**不该阻止进程退出**。
         *
         * 它是永久重复的（只要还有订阅者就一直排下一轮），在 Node 下会让事件循环永远不空 ——
         * 离线测试跑完 726 项断言后进程却退不出去，就是这条踩出来的。
         * 浏览器里 `setTimeout` 返回数字、没有 `unref`，这里自动跳过（对宿主零影响）。
         */
        function unrefTimer(handle) {
          if (handle && typeof handle.unref === 'function') {
            try {
              handle.unref()
            } catch (error) {
              /* 忽略 */
            }
          }
        }

        /** 低频心跳：只有存在订阅者时才跑，dispose 时清掉。 */
        function scheduleHeartbeat() {
          if (closed || heartbeatTimer !== null) return
          heartbeatTimer = timers.set(function () {
            heartbeatTimer = null
            if (closed) return
            recheck()
            /*
             * recheck() 里已经带了"不可用就重拉"的兜底，但它只在**目录实例存在**时才动手；
             * 这里再走一次是给"解析失败/刚被换掉"兜底 —— 两处都幂等，重复调用无副作用。
             */
            notifyLoadFallbacks()
            scheduleHeartbeat()
          }, DIRECTORY_HEARTBEAT_MS)
          unrefTimer(heartbeatTimer)
        }

        function stopHeartbeat() {
          if (heartbeatTimer === null) return
          try {
            timers.clear(heartbeatTimer)
          } catch (error) {
            /* 忽略 */
          }
          heartbeatTimer = null
        }

        /**
         * 主动拉一次目录（不 load 的话 store 停在 idle，档位列表是空的）。
         *
         * @param force `true` = 绕过 400ms 节流（退避定时器与心跳自己在控制节奏）。
         */
        function kickLoad(force) {
          if (closed || directory === null || typeof directory.load !== 'function') return
          var now = Date.now()
          if (force !== true && now - lastLoadAt < 400) return
          lastLoadAt = now
          var target = directory
          var attempt = null
          try {
            attempt = Promise.resolve(target.load())
          } catch (error) {
            attempt = Promise.reject(error)
          }
          attempt.then(
            function () {
              if (closed) return
              var snapshot = currentSnapshot()
              if (snapshotUsable(snapshot)) {
                loadRetryIndex = 0
                return
              }
              // load 成功但目录还是空 → 主动刷全局目录（有冷却/上限）；只有"根本没到"才继续退避
              refreshCatalogIfEmpty(snapshot)
              if (needsLoadRetry(snapshot)) scheduleLoadRetry()
            },
            function () {
              if (closed) return
              // 失败原因由 store 的 error 字段呈现（面板会显示），这里只负责继续自愈
              scheduleLoadRetry()
            }
          )
        }

        return {
          getSnapshot: function () {
            if (closed) return EMPTY_SNAPSHOT
            /**
             * **每次都复查目录实例**（不只是 `directory === null` 时）。
             *
             * 宿主会重建该会话的 `ModelDirectory`（父子会话换 binding、会话作用域重建等），
             * 而 `resolve()` 自带短路（`fresh === directory` 就直接返回），复查的代价只是一次
             * 同步查表。少了这一步，读路径会永久停在**已 dispose 的旧实例**上：界面静默冻在旧
             * 档位表（旧 store 再不更新、`select()` 走 disposed 分支），而写路径（`directory()`）
             * 却进了新实例 —— 正是下面 `directory()` 那句注释想避免的事。
             */
            resolve()
            // 顺手把"还没就绪/就绪但空"的兜底也走一遍（两处都有节流，渲染期调用是安全的）。
            notifyLoadFallbacks()
            if (directory === null) scheduleRetry()
            if (directory !== null) {
              try {
                var value = directory.store.getSnapshot()
                if (value && typeof value === 'object') last = value
              } catch (error) {
                /* 保留上一次快照，绝不把渲染打崩 */
              }
            }
            return last
          },
          subscribe: function (listener) {
            if (closed) return function () {}
            listeners.add(listener)
            // 同上：订阅时也复查一次 —— 实例换了就在这里顺手把订阅重挂到新 store 上
            resolve()
            if (directory === null) scheduleRetry()
            scheduleHeartbeat() // 有订阅者了，开始主动复查（宿主换实例时旧实例不会再通知我们）
            // StrictMode 会订阅/退订各跑一次；退订只清订阅，不永久关闭访问器。
            return function () {
              listeners.delete(listener)
            }
          },
          /** 显式复查（面板打开时调一次：那是用户真正要看数据的时刻）。 */
          refresh: function () {
            recheck()
            kickLoad()
          },
          /** 取当前真正可写的目录（load/select 在调用时重新解析，避免用失效实例）。 */
          directory: function () {
            var fresh = resolve()
            return fresh !== null ? fresh : directory
          },
          /**
           * 目录走到哪一步了（界面照着说人话，见 `phaseOf`）。
           *
           * - `unresolved`：`directoryFor(sessionId)` 一直抛（会话作用域/绑定还没就绪）或还没拿到 store —— **我们这边**的事；
           * - `loading`：拿到了 store，但宿主目录还没就绪（idle/loading）；
           * - `empty`：宿主**就绪了但一个 provider 都没列出来** —— 宿主那边的事（例如账号 provider 拿不到令牌时
           *   它会**静默返回空模型列表**，`llm-deepseek-account` 的 `discoverModels` 就是这个行为）；
           * - `ready`：有 provider；
           * - `error`：目录报了错（原因由快照的 error 字段给出）。
           */
          phase: function () {
            if (closed) return 'closed'
            /*
             * **一个会话 id 都没有**：这说明这个位置还没有会话（DSH 的输入区在"新会话"空白壳里
             * 也会渲染，那时 `conversation.composer.bar` 所在的作用域是 session-maybe，
             * `binding.key` 是 undefined）。这时说"正在重试"是误导 —— 没有会话可重试，
             * 发一条消息、或打开一个已有会话，会话一出现组件就重挂并拿到真正的 id。
             */
            if (candidates.length === 0) return 'no-session'
            if (directory === null) return 'unresolved'
            var snapshot = currentSnapshot()
            if (!snapshot || typeof snapshot !== 'object') return 'unresolved'
            if (Array.isArray(snapshot.groups) && snapshot.groups.length > 0) return 'ready'
            if (snapshot.status === 'error') return 'error'
            if (snapshot.status === 'ready' || snapshot.status === 'selecting') return 'empty'
            return 'loading'
          },
          /**
           * "为什么还没就绪"的原话（宿主抛的异常信息 / 我们自己的判定），给界面与排查用。
           * 空串 = 当前没有失败原因（就绪了，或者还没试过）。
           */
          reason: function () {
            return lastReason
          },
          /** 试过的候选会话 id（离线断言与排查用）。 */
          sessionIds: function () {
            return candidates.slice()
          },
          load: kickLoad,
          dispose: function () {
            closed = true
            listeners.clear()
            if (retryTimer !== null) {
              try {
                timers.clear(retryTimer)
              } catch (error) {
                /* 忽略 */
              }
              retryTimer = null
            }
            if (loadRetryTimer !== null) {
              try {
                timers.clear(loadRetryTimer)
              } catch (error) {
                /* 忽略 */
              }
              loadRetryTimer = null
            }
            stopHeartbeat()
            if (unsubscribe !== null) {
              try {
                unsubscribe()
              } catch (error) {
                /* 忽略 */
              }
              unsubscribe = null
            }
            directory = null
          }
        }
      }

      /* ══════════ 官方菜单那一行的 DOM 桥（只动那一行，fail-open）══════════ */

      function firstSpanText(row) {
        try {
          var spans = row.querySelectorAll('span')
          for (var i = 0; i < spans.length; i += 1) {
            var text = spans[i].textContent
            if (typeof text === 'string' && text.length > 0) return text
          }
        } catch (error) {
          /* 认不出就算了，调用方会退到结构判定 */
        }
        return ''
      }

      /**
       * 官方那一行右侧的**数值文字**（"Max" / "High"）—— 就是 `.cellValue` 那个 span。
       * 找不到 class 时退到结构：行内最后一个非空文字的 span（数值在标签之后、箭头之前）。
       * 只改它的颜色，文字内容一律不碰。
       */
      function findValueElement(row) {
        if (!row || typeof row.querySelectorAll !== 'function') return null
        try {
          var byClass = row.querySelectorAll("span[class*='cellValue']")
          if (byClass.length > 0) return byClass[byClass.length - 1]
          var spans = row.querySelectorAll('span')
          var found = null
          for (var i = 0; i < spans.length; i += 1) {
            var text = spans[i].textContent
            if (typeof text === 'string' && text.replace(/\s+/g, '').length > 0) found = spans[i]
          }
          return found
        } catch (error) {
          return null
        }
      }

      /**
       * **收起的模型席按钮**（"DeepSeek-V41-Flash  High  ⌄"）里只显示档位名的那一小段文字。
       *
       * 官方渲染它用的是哈希 class（`wq12jW_triggerEffort`，前缀随构建变），靠 class 认迟早会失效，
       * 所以按**文字**认：官方 trigger 里的档位文字就是档位的 `name`，和我们从目录读到的是同一份数据。
       *
       * 传**全部档位名**（而不是只要当前那个）：档位刚切换、官方还没重渲染席按钮时，
       * 文字还是旧档位名 —— 只认当前名字会在那一瞬间"放手"，颜色闪一下。
       * 认不出任何已知档位名就返回 null（fail-open，绝不动别的文字）。
       */
      function findSeatEffort(doc, composer, expectedLabels) {
        if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
        var list = typeof expectedLabels === 'string' ? [expectedLabels] : expectedLabels
        if (Object.prototype.toString.call(list) !== '[object Array]') return null
        var wanted = []
        for (var n = 0; n < list.length; n += 1) {
          var name = typeof list[n] === 'string' ? list[n].replace(/\s+/g, '') : ''
          if (name.length > 0 && wanted.indexOf(name) < 0) wanted.push(name)
        }
        if (wanted.length === 0) return null
        try {
          var seats = doc.querySelectorAll('button[aria-haspopup="menu"]')
          for (var i = 0; i < seats.length; i += 1) {
            if (!composer.contains(seats[i])) continue
            var spans = seats[i].querySelectorAll('span')
            for (var j = 0; j < spans.length; j += 1) {
              var text = spans[j].textContent
              if (typeof text === 'string' && wanted.indexOf(text.replace(/\s+/g, '')) >= 0) return spans[j]
            }
          }
        } catch (error) {
          return null
        }
        return null
      }

      /**
       * 在自己所属的 composer 里，找到"打开的那颗官方模型席"对应的菜单，再找到推理等级那一行。
       * 全部用官方**语义属性**（aria-haspopup / aria-expanded / aria-controls / role）定位，
       * 不依赖哈希 class —— 官方改样式不会影响这里，改语义才会（那种改动会先在我的测试里炸掉）。
       *
       * 返回 `{ row, menu }`：行是注入目标，菜单是"这一屏内容是不是我的"的判据
       * （徽标 / 归属标签 / API 值三处注记都只往这颗菜单里写）。认不出就返回 null。
       */
      function findEffortRow(doc, composer) {
        var menu = findOpenMenu(doc, composer)
        if (menu === null) return null
        // 判据已经由 findOpenMenu 保证，这里可以直接取（items 恰好两个）
        var items = menu.querySelectorAll('button[role="menuitem"]')
        for (var j = 0; j < items.length; j += 1) {
          var label = firstSpanText(items[j])
          for (var k = 0; k < EFFORT_ROW_LABELS.length; k += 1) {
            if (label === EFFORT_ROW_LABELS[k]) return { row: items[j], menu: menu }
          }
        }
        // 文案认不出（官方改了措辞/别的语言）就按官方固定顺序：第 2 个 menuitem 是推理等级。
        return { row: items[1], menu: menu }
      }

      /* ── 官方菜单里的三处小注记（徽标 / 归属 / API 值）──────────────────────
       官方二级页的 DOM 形状（逐字对照真产物 `dsh-client-ui-model-selection/lib/client.js`）：
         · 模型行      `button[role="menuitemradio"][id="${id}-model-${index}"]`，内部
                       `.optionCopy > .modelName` + `.check`
         · 档位行      `button[role="menuitemradio"]`（没有 id 的那种），内部同上，
                       但名字是档位的**显示名**、`aria-checked` 按当前档位
         · 根面板两行  `button[role="menuitem"]` → `.cellLabel` / `.cellValue` / `.cellChevron`
       三处注记**只 append**，不改官方任何文字、不碰 hover/focus 机制。 */

      /** 官方菜单里那个滚动容器（`wq12jW_groups` 上带 `scrollable` 这个**稳定的字面量 class**）。 */
      function findScrollContainer(menu) {
        try {
          var found = menu.querySelectorAll('.scrollable')
          return found.length > 0 ? found[0] : null
        } catch (error) {
          return null
        }
      }

      /**
       * 一个模型行显示的**模型名**（官方是 `.optionCopy > .modelName` 里的文字）。
       * 认不出就退到整行文字（徽标文案要的只是名字，认不准就交给静态清单的 id 判定）。
       */
      function modelNameOf(row) {
        try {
          var name = row.querySelectorAll('[class*="modelName"]')
          if (name.length > 0) return String(name[0].textContent)
          var copy = row.querySelectorAll('[class*="optionCopy"]')
          if (copy.length > 0) return String(copy[0].textContent)
        } catch (error) {
          /* 认不出就算了 */
        }
        return ''
      }

      /** 把菜单里所有"当前档位的候选行"按文档顺序翻出来（官方的 pane 结构里只有档位页有它们）。 */
      function findEffortOptionRows(menu) {
        try {
          var all = menu.querySelectorAll('button')
          var out = []
          for (var i = 0; i < all.length; i += 1) {
            var node = all[i]
            if (typeof node.getAttribute !== 'function') continue
            if (node.getAttribute('role') !== 'menuitemradio') continue
            var id = node.getAttribute('id')
            if (id !== null && /(^|-)model-\d+$/.test(id)) continue // 模型行（官方给它们编了号）
            out.push(node)
          }
          return out
        } catch (error) {
          return []
        }
      }

      /**
       * 只找"打开的那颗席对应的菜单"，**不要求它是根面板**。
       *
       * 与 `findEffortRow` 分开是必要的：模型列表/档位列表里没有 `role="menuitem"`，
       * 而三处注记恰恰要在那两屏里生效；反过来，滑条只在根面板那一行存在时才注入。
       * 判据仍然是官方的语义锚点：`aria-haspopup="menu"` + `aria-expanded="true"` +
       * `aria-controls` → `getElementById`，再加上"最后两段必须是 `menuitem`"这条结构约束
       * （与 `findEffortRow` 完全一致 —— 结构变了就一起停手，不会出现"徽标在、滑条不在"的半截状态）。
       */
      function findOpenMenu(doc, composer) {
        if (!doc || !composer || typeof doc.querySelectorAll !== 'function') return null
        try {
          var seats = doc.querySelectorAll('button[aria-haspopup="menu"][aria-expanded="true"]')
          var seat = null
          for (var i = 0; i < seats.length; i += 1) {
            if (!composer.contains(seats[i])) continue
            /*
             * 1.3.2 起**自建浮层的触发器也长这样**（`aria-haspopup="menu"` + 展开时 `aria-expanded="true"`），
             * 而且它和官方席同在 `conversation.input.model` 那一格（接管成功时官方那颗不渲染，
             * 退回工具行时两颗并存）。所以这里不能"抓到第一颗就收手"：
             * 没有 `aria-controls` 的按钮**不是官方的席**（官方那颗一定带 `${id}-menu`），
             * 跳过它继续找 —— 否则自建面板一打开，官方菜单那条路（默认关闭）会整帧停手。
             */
            if (typeof seats[i].getAttribute === 'function' && !seats[i].getAttribute('aria-controls')) continue
            seat = seats[i]
            break
          }
          if (seat === null) return null
          var menuId = typeof seat.getAttribute === 'function' ? seat.getAttribute('aria-controls') : null
          var menu = menuId && typeof doc.getElementById === 'function' ? doc.getElementById(menuId) : null
          if (!menu) return null
          if (menu.querySelectorAll('button[role="menuitem"]').length !== 2) return null
          return menu
        } catch (error) {
          return null
        }
      }

      /**
       * 按**模型名**查目录条目（官方列表上显示的就是 `model.name`，不一定等于 `model.id`，
       * 例如 id `deepseek-v41-flash` / 显示名 `DeepSeek-V41-Flash`）。先精确、再归一化，
       * 都命中不了就返回 null —— 这样跨 provider 的模型行也能拿到自己那一份档位信息。
       */
      function entryByName(index, name) {
        if (!index || !index.models || typeof name !== 'string' || name.length === 0) return null
        var flat = normalizeModelKey(name)
        var i
        for (i = 0; i < index.models.length; i += 1) if (index.models[i].name === name) return index.models[i]
        for (i = 0; i < index.models.length; i += 1)
          if (normalizeModelKey(index.models[i].name) === flat) return index.models[i]
        for (i = 0; i < index.models.length; i += 1)
          if (normalizeModelKey(index.models[i].id) === flat) return index.models[i]
        return null
      }

      /** 模型名/ id 的比较键：小写、去掉一切非字母数字（`DeepSeek-V41-Flash` ↔ `deepseek-v41-flash`）。 */
      function normalizeModelKey(value) {
        return typeof value === 'string' ? value.replace(/[^a-z0-9]+/gi, '').toLowerCase() : ''
      }

      /**
       * 一个模型行的**档位信息**：目录命中就用目录的；目录里没有这一行（可见模型集变了、
       * 或者目录这一代还没列到它）才退到静态清单；两条都没有就是 null（不写徽标）。
       */
      function describeModelTier(index, modelName, modelId) {
        var entry = entryByName(index, modelName)
        if (entry !== null) return { tiers: entry.tiers, name: entry.name, model: entry }
        var def = resolveModel(modelId)
        if (def === null) return null
        return {
          id: modelId,
          name: def.name || (DEF_ALIASES[modelId] ? DEF_ALIASES[modelId] : modelId),
          provider: null,
          tiers: def.levels === null ? null : def.count > 0 ? { count: def.count, names: [] } : null,
          defaultTier: def.def || null
        }
      }

      /** 徽标节点：`8 档` / `不支持`。文字与 title 都从这份 tier 描述里算，一处真相。 */
      function buildModelBadge(doc, tier) {
        var badge = doc.createElement('span')
        badge.className = 'ces-menu-badge'
        badge.setAttribute('data-ces-part', 'model-badge')
        var supported = tier !== null && tier.tiers !== null
        badge.setAttribute('data-off', supported ? '0' : '1')
        badge.textContent = tierCountLabel(tier)
        var names = supported && tier.tiers.names && tier.tiers.names.length > 0 ? tier.tiers.names.join(' / ') : ''
        var title = supported
          ? tier.tiers.count + ' 档' + (names.length > 0 ? '：' + names : '')
          : '该模型不支持推理等级'
        badge.setAttribute('title', title)
        return badge
      }

      /** 档位行右侧那枚灰色原始取值（`xhigh` 之类）—— 发送请求时用的就是它。 */
      function buildApiValue(doc, effortId) {
        var api = doc.createElement('span')
        api.className = 'ces-menu-api'
        api.setAttribute('data-ces-part', 'api-value')
        api.textContent = effortId
        api.setAttribute('title', 'API: ' + effortId)
        return api
      }

      /** 根面板那一行的归属标签：当前模型属于哪个 provider（一级页就能看出切换生效）。 */
      function buildProviderTag(doc, provider) {
        var tag = doc.createElement('span')
        tag.className = 'ces-menu-provider'
        tag.setAttribute('data-ces-part', 'provider-tag')
        tag.textContent = provider
        tag.setAttribute('title', provider)
        return tag
      }

      /**
       * 把三处注记写进当前这一屏的官方菜单。**每次扫描重算**（不做缓存、不增量 patch）——
       * 这正是参考实现那条"禁用态 = 渲染函数的完整投影"的同一条纪律：官方重渲染换掉节点、
       * 翻页换了内容、目录换了代，这里都会在下一次 mutation 里重新算成正确的样子，
       * 绝不会残留上一次的附件。代价是每个 mutation 帧十几次选择器查询（可忽略）。
       */
      function decorateMenu(options) {
        var doc = options.doc
        var menu = options.menu
        var index = options.index || { byProvider: {}, models: [] }
        var provider = typeof options.provider === 'string' ? options.provider : ''
        var efforts = Array.isArray(options.efforts) ? options.efforts : []
        try {
          // 1）每颗模型行一个档位徽标
          var rows = menu.querySelectorAll('button[role="menuitemradio"]')
          for (var i = 0; i < rows.length; i += 1) {
            var row = rows[i]
            if (typeof row.getAttribute !== 'function') continue
            // 官方**只给模型行编了 id**（`${id}-model-${index}`），档位行没有 —— 用它区分两页。
            // **不能**用 id 里的序号去索引目录：那个序号是"筛选后"的位置，而 `index.models`
            // 是按 provider 分组展平的全量，跨 provider/搜索时对不上。所以位置只做过滤，
            // 真正的身份取自行上显示的名字（官方显示的就是模型名，和目录 name 同一份数据）。
            var id = row.getAttribute('id')
            if (typeof id !== 'string' || !/(^|-)model-\d+$/.test(id)) continue
            var name = modelNameOf(row)
            var tier = describeModelTier(index, name, name)
            if (tier === null) continue // 目录与静态清单都不认识 → 不写（不瞎标）
            if (row.querySelectorAll('.ces-menu-badge').length > 0) continue // 已经标过
            var copy = row.querySelectorAll('[class*="optionCopy"]')
            var host = copy.length > 0 ? copy[0] : row
            host.appendChild(buildModelBadge(doc, tier))
          }

          // 2）档位页：每一行右侧的原始 API 值
          var effortRows = findEffortOptionRows(menu)
          for (var j = 0; j < effortRows.length; j += 1) {
            var effortRow = effortRows[j]
            if (effortRow.querySelectorAll('.ces-menu-api').length > 0) continue
            var effort = efforts[j]
            if (!effort || typeof effort.id !== 'string' || effort.id.length === 0) continue
            effortRow.appendChild(buildApiValue(doc, effort.id))
          }

          // 3）根面板：模型那一行的归属标签（provider 名）
          if (provider.length > 0) {
            var cells = menu.querySelectorAll('button[role="menuitem"]')
            if (cells.length > 0) {
              var cell = cells[0]
              if (cell.querySelectorAll('.ces-menu-provider').length === 0) {
                var tag = buildProviderTag(doc, provider)
                // 挂在**最后**：官方那一行是 `.cellLabel`(flex:none) + `.cellValue`(flex:auto)
                // + `.cellChevron`(flex:none)，所以追加到末尾只会在箭头右侧多一小段灰字，
                // 不会改变官方三个节点的顺序，也不动它们的任何样式。
                // 用 `insertBefore(tag, null)` 是为了让假 DOM 与真 DOM 走同一条插入路径。
                if (typeof cell.insertBefore === 'function') cell.insertBefore(tag, null)
                else cell.appendChild(tag)
              }
            }
          }
        } catch (error) {
          /* 注记失败只影响观感，绝不拖垮注入与拖动 */
        }
      }

      /**
       * 监听文档，把滑条容器挂进官方那一行。
       *
       * @param options.doc      宿主 document
       * @param options.win       宿主 window（派发 resize 让官方重测菜单位置）
       * @param options.anchor    () => 本会话在 composer 里的锚点元素（用来判定"哪颗席是我的"）
       * @param options.active    () => boolean，当前是否值得注入（没有档位就不注入，免得白加高）
       * @param options.onChange  (host | null) => void
       * @param options.decorate  () => ({ index, provider, efforts } | null)，当前这一屏的注记数据
       */
      function createMenuBridge(options) {
        var doc = options.doc
        var win = options.win
        var anchor = options.anchor
        var active = options.active
        var onChange = options.onChange
        if (!doc || typeof doc.createElement !== 'function') return null

        var current = null
        var seat = null // 收起态那一行里的档位文字（菜单没打开时也要着色）
        var seatColor = '' // 组件给的当前颜色：重新抓到元素时立刻补上，不必等下一次渲染
        var observer = null
        var timer = null
        var disposed = false
        var seatLabels = options.seatLabels // () => string[]，全部已知档位名
        /**
         * 组件交给桥的"当前这一屏该怎么注记"。**每帧现读**（见 decorateMenu 的注释）：
         * 读到什么就画什么，读不到就什么都不加。
         */
        var decorateSource = typeof options.decorate === 'function' ? options.decorate : null

        /** 本会话的 composer 容器：从锚点往上找官方给 composer 卡片打的标记。 */
        function composerOf() {
          var node = anchor()
          if (!node) return null
          var el = node
          while (el && el.nodeType === 1) {
            if (typeof el.getAttribute === 'function' && el.getAttribute('data-composer-card') !== null) return el
            el = el.parentNode
          }
          return null
        }

        function detach() {
          if (current === null) return
          var row = current.row
          var container = current.container
          try {
            if (container && container.parentNode) container.parentNode.removeChild(container)
          } catch (error) {
            /* 行可能已经被官方卸载 */
          }
          try {
            var previous = current.previous
            if (row && row.style) {
              row.style.height = previous.height
              row.style.flexWrap = previous.flexWrap
              row.style.paddingTop = previous.paddingTop
              row.style.paddingBottom = previous.paddingBottom
              row.style.boxShadow = previous.boxShadow
            }
            // 数值文字（"Max"）的颜色也是我们改的，退出时一并还原
            if (current.value && current.value.style) current.value.style.color = previous.valueColor
          } catch (error) {
            /* 还原失败不影响官方菜单自身 */
          }
          current = null
          onChange(null)
        }

        /**
         * 翻页/换内容那一帧的滚动稳定化（移植参考实现的 `setView` 里那两句防御性清零）。
         *
         * 官方换内容时会重新 `.focus()` 一行（**没有带 preventScroll**），浏览器于是把
         * 滚动容器滚到那一行；加上我们给"推理等级"那一行加的 ~48px 高度触发的 scroll
         * anchoring，翻页时就会多出一次位移 —— 看起来就是"进二级页那一下动画没了/接缝闪一下"。
         * 这里在 mutation 回调里**同步**把滚动位置清回去：mutation 回调是微任务，早于绘制，
         * 所以这一帧不会把位移画出来。
         *
         * 只在"确实滚过"时才写（写 0 到已经是 0 的属性是空操作，但省掉它对键盘导航更保险）。
         */
        function stabilizeScroll(menu, container) {
          try {
            if (container && container.scrollTop > 0) container.scrollTop = 0
            if (menu && menu.scrollTop > 0) menu.scrollTop = 0
            if (container && container.scrollLeft > 0) container.scrollLeft = 0
          } catch (error) {
            /* 只影响观感 */
          }
        }

        /**
         * 把官方的滚动容器标成"不再为内容变化追加滚动"（`overflow-anchor:none`），
         * 并挂上我们自己的稳定化类。只加 class，不改官方既有 class。
         */
        function tagMenu(menu) {
          try {
            if (menu && menu.classList && typeof menu.classList.add === 'function')
              menu.classList.add('ces-menu-stable')
            var container = findScrollContainer(menu)
            if (container && container.classList && typeof container.classList.add === 'function') {
              container.classList.add('ces-menu-stable')
            }
            return container
          } catch (error) {
            return null
          }
        }

        /** 收起的档位文字：还原本来的颜色并忘掉它。 */
        function releaseSeat() {
          if (seat === null) return
          try {
            if (seat.el && seat.el.style) seat.el.style.color = seat.previousColor
          } catch (error) {
            /* 元素可能已被官方卸载 */
          }
          seat = null
        }

        /**
         * 同步收起态的档位文字。
         * 只在**元素换了**（官方重渲染换了节点）或还没抓到时重新抓 —— 文字变了不换元素，
         * 所以档位切换不会造成"还原→再上色"的闪动。
         */
        function syncSeat() {
          var composer = composerOf()
          if (composer === null || active() !== true) {
            releaseSeat()
            return
          }
          if (seat !== null && seat.el && doc.documentElement && doc.documentElement.contains(seat.el)) {
            if (seatColor && seat.el.style) seat.el.style.color = seatColor // 官方清过内联样式就补回来
            return
          }
          releaseSeat()
          var wanted = typeof seatLabels === 'function' ? seatLabels() : null
          var el = findSeatEffort(doc, composer, wanted)
          if (el === null || !el.style) return
          seat = { el: el, previousColor: el.style.color || '' }
          if (seatColor) el.style.color = seatColor
        }

        function scan() {
          if (disposed) return
          // 收起态的档位文字：跟菜单那一行互相独立，任一处失败都不该拖垮另一处
          try {
            syncSeat()
          } catch (error) {
            /* 忽略 */
          }
          try {
            var composer = composerOf()
            if (composer === null || active() !== true) {
              detach()
              return
            }
            /*
             * 一条链、两层判据：
             *   · `menu`   —— 打开的是**我这一屏**的官方菜单吗（语义锚点 + 结构约束）
             *   · `found`  —— 这一屏是不是根面板、且那一行认得出（只有这时才注入/加高）
             * 三处注记只需要前者（模型列表/档位列表里根本没有 menuitem），
             * 滑条两者都要 —— 所以"该不该动手"由组件给的 `active()` 决定，这里只管形状。
             */
            var menu = findOpenMenu(doc, composer)
            var found = menu === null ? null : findEffortRow(doc, composer)
            var container = menu === null ? null : tagMenu(menu)
            // 翻页是"同一个菜单换内容"，所以稳定化必须**每帧**做，而不能只在首次注入时做
            if (menu !== null) stabilizeScroll(menu, container)
            if (decorateSource !== null && menu !== null) {
              var spec = null
              try {
                spec = decorateSource()
              } catch (error) {
                spec = null
              }
              if (spec !== null && spec !== undefined) {
                decorateMenu({
                  doc: doc,
                  menu: menu,
                  index: spec.index,
                  provider: spec.provider,
                  efforts: spec.efforts
                })
              }
            }

            // 已经挂好且那一行还在 → 什么都不做
            if (current !== null && current.row && doc.documentElement && doc.documentElement.contains(current.row))
              return
            // 不再是根面板、或那一行认不出 → 撤掉容器（但那三处注记仍按上面那样保留）
            if (found === null) {
              detach()
              return
            }

            var row = found.row
            detach()

            var value = findValueElement(row)
            var previous = {
              // 真实 DOM 里未设置的内联属性读作 ""，这里统一成同样的语义，还原时才不会写回
              // 字面量 "undefined"（那在浏览器里是无效值，会把我们的加高留在原地）。
              height: row.style.height || '',
              flexWrap: row.style.flexWrap || '',
              paddingTop: row.style.paddingTop || '',
              paddingBottom: row.style.paddingBottom || '',
              boxShadow: row.style.boxShadow || '',
              // 数值文字原来的内联颜色（通常没设过，读作 ""）
              valueColor: value && value.style ? value.style.color || '' : ''
            }
            // 「加高那一栏的上下距离」+ 允许折行，让滑条落到第二行并铺满整行宽度。
            row.style.height = 'auto'
            row.style.flexWrap = 'wrap'
            row.style.paddingTop = ROW_PADDING_BLOCK
            row.style.paddingBottom = ROW_PADDING_BLOCK

            var box = doc.createElement('div')
            box.className = 'ces-inline'
            box.setAttribute('data-ces-part', 'host')
            row.appendChild(box)

            current = { row: row, container: box, value: value, previous: previous, menu: menu }
            onChange(current)

            // 官方菜单是"测量后固定定位"的，加高后让它重测一次（官方自己在 resize 里重测并夹取）。
            try {
              win.dispatchEvent(new win.Event('resize'))
            } catch (error) {
              /* 宿主没有 Event 构造器就算了，官方也会在状态变化时重测 */
            }
          } catch (error) {
            try {
              detach()
            } catch (inner) {
              /* 兜到底 */
            }
          }
        }

        function start() {
          scan()
          var MO = win && (win.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null))
          if (typeof MO === 'function') {
            try {
              observer = new MO(function () {
                scan()
              })
              observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true })
              return
            } catch (error) {
              observer = null
            }
          }
          // 没有 MutationObserver 时退化成低频轮询；反正每轮都很便宜。
          if (win && typeof win.setInterval === 'function') timer = win.setInterval(scan, 400)
        }

        return {
          scan: scan,
          start: start,
          /** 组件把当前该用的颜色给进来；桥负责在（重新）抓到元素时立刻应用。 */
          setSeatColor: function (color) {
            seatColor = typeof color === 'string' ? color : ''
            if (seat !== null && seat.el && seat.el.style) {
              try {
                seat.el.style.color = seatColor
              } catch (error) {
                /* 忽略 */
              }
            }
          },
          dispose: function () {
            disposed = true
            if (observer !== null) {
              try {
                observer.disconnect()
              } catch (error) {
                /* 忽略 */
              }
              observer = null
            }
            if (timer !== null) {
              try {
                win.clearInterval(timer)
              } catch (error) {
                /* 忽略 */
              }
              timer = null
            }
            releaseSeat()
            detach()
          },
          host: function () {
            return current
          }
        }
      }

      /* ════════════════════════════ 组件 ════════════════════════════ */

      /**
       * 单组件设计：锚点 + 桥 + 滑条（portal 进官方那一行）都在同一个函数里，
       * 所有 hook 都在同一个实例上，展开/收起不会改变 hook 顺序。
       */
      function CodexEffortSlider(props) {
        // kit 的值优先；`inject` 拿到的 `binding.key` 只做兜底（它不一定等于本会话的 id —— 槽注入键只做兜底候选）
        var sessionId =
          typeof props.sessionId === 'string' && props.sessionId.length > 0
            ? props.sessionId
            : typeof props.__sessionKey === 'string' && props.__sessionKey.length > 0
              ? props.__sessionKey
              : null
        var locked = props.locked === true
        var ctx = props.__ctx

        /** 系统的「减少动态效果」只影响**特效强度**，不影响功能（放缓而不是冻住）。 */
        var reducedMotion = false
        try {
          reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
        } catch (error) {
          reducedMotion = false
        }

        var access = React.useMemo(
          function () {
            if (sessionId === null || !ctx) return null
            return createDirectoryAccess(ctx, sessionId, {
              set: function (fn, delay) {
                return setTimeout(fn, delay)
              },
              clear: function (handle) {
                clearTimeout(handle)
              }
            })
          },
          [ctx, sessionId]
        )

        React.useEffect(
          function () {
            return function () {
              if (access !== null) access.dispose()
            }
          },
          [access]
        )

        var subscribe = React.useCallback(
          function (onChange) {
            return access === null ? function () {} : access.subscribe(onChange)
          },
          [access]
        )
        var getSnapshot = React.useCallback(
          function () {
            return access === null ? EMPTY_SNAPSHOT : access.getSnapshot()
          },
          [access]
        )
        var state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

        var levels = levelsOf(state)
        var effectiveId = effectiveEffortId(state)
        var committedIndex = indexOfLevel(levels, effectiveId)
        var levelCount = levels.length
        /**
         * 目录快照建出来的"provider → 模型 → 档位"能力索引（每个档位/模型集变化时重建一次）。
         * 它是**参考实现里那张静态能力清单的位置**，只不过填充它的是宿主下发的活数据。
         */
        var catalogIndex = React.useMemo(
          function () {
            return buildCatalogIndex(state)
          },
          [state]
        )
        /** 当前模型所属的 provider（根面板归属标签用）。 */
        var providerId =
          state && state.current && typeof state.current.provider === 'string' ? state.current.provider : ''

        var draftState = React.useState(null)
        var draft = draftState[0]
        var setDraft = draftState[1]
        var optimisticState = React.useState(null)
        var optimistic = optimisticState[0]
        var setOptimistic = optimisticState[1]
        var errorState = React.useState(null)
        var errorText_ = errorState[0]
        var setError = errorState[1]
        var busyState = React.useState(false)
        var busy = busyState[0]
        var setBusy = busyState[1]
        var hostState = React.useState(null)
        var host = hostState[0]
        var setHost = hostState[1]

        var anchorRef = React.useRef(null)
        var trackRef = React.useRef(null)
        var optimisticIdRef = React.useRef(null)
        /** 拖动的"最新位置"放 ref：React 会把同一 tick 的多次 setState 合并，
         *  松手那一帧若从 state 读位置，可能读到上一次渲染的旧值，从而写错档位。 */
        var draftRef = React.useRef(null)
        var commitRef = React.useRef({ timer: null, inFlight: false, queued: null })
        var draggingRef = React.useRef(false)
        /**
         * 按下锚点：指针位置（档位单位）、落到了哪一档、以及"判定线是否与落点冲突"。
         * 只有冲突时才需要死区；不冲突时判定线直接说话 —— 起拖不能有额外延迟。
         */
        var pressRef = React.useRef({ u: 0, index: 0, conflict: false, active: false })
        /** 上一次换档的时刻（毫秒）：用来分辨"手在慢慢挪"还是"在快拖"。 */
        var lastStepAtRef = React.useRef(0)
        /** 当前是否走慢档动画：state 用来渲染 data-slide，ref 供事件处理里同步读写。 */
        var slideSlowState = React.useState(false)
        var slideSlow = slideSlowState[0]
        var setSlideSlow = slideSlowState[1]
        var slideSlowRef = React.useRef(false)
        var levelCountRef = React.useRef(0)
        var seatNamesRef = React.useRef([]) // 全部已知档位名（认官方席按钮上的那段文字用）
        var bridgeRef = React.useRef(null)
        /**
         * 桥的"这一刻该不该动手 / 该注记什么"的唯一数据源。
         * 用 ref 而不是 state：桥的回调（MutationObserver）拿不到渲染期的闭包值，
         * 而这个 ref 每次渲染都被刷成最新的一份，读到的永远是"此刻真实的样子"。
         */
        var decorateRef = React.useRef({
          index: { byProvider: {}, models: [] },
          provider: '',
          efforts: [],
          modelCount: 0
        })
        decorateRef.current = {
          index: catalogIndex,
          provider: providerId,
          efforts: levels,
          modelCount: catalogIndex.models.length
        }
        levelCountRef.current = levelCount

        /* 桥：找到官方菜单那一行，把滑条容器挂进去 */
        React.useEffect(
          function () {
            if (sessionId === null || !ctx) return undefined
            var bridge = createMenuBridge({
              doc: typeof document === 'undefined' ? null : document,
              win: typeof window === 'undefined' ? null : window,
              anchor: function () {
                return anchorRef.current
              },
              // 目录里**一个模型都没有**、或当前模型一个档位都没有时不动手：
              // 前者是起步期/目录失败（没什么可注记，也不必加高），后者官方根本不会渲染那一行。
              active: function () {
                var now = decorateRef.current
                return now.modelCount > 0 && now.efforts.length > 0
              },
              onChange: function (next) {
                setHost(next)
              },
              // 收起态那一行显示的档位名（官方 trigger 里的文字就是它）；给全部名字更抗"官方还没重渲染"
              seatLabels: function () {
                return seatNamesRef.current
              }
              // 移植自上游的三处只读注记（档位徽标 / provider 归属 / API 取值）已按需求移除
              // —— 不传 decorate，桥自然跳过。
            })
            if (bridge === null) return undefined
            bridgeRef.current = bridge
            bridge.start()
            return function () {
              bridgeRef.current = null
              bridge.dispose()
            }
          },
          [ctx, sessionId]
        )

        /**
         * 档位是**后到**的（目录 load 完才有 efforts）。那时 DOM 没有任何变化，
         * MutationObserver 不会响，所以这里在档位数变化时主动重扫一次 ——
         * 少了这一句，"目录晚到"会让滑条永远挂不上去（起步期抖动变永久失效）。
         *
         * 依赖里再加一个 `catalogIndex.models.length`：档位数没变、但**模型集**刚到时
         * （例如目录先只列了当前模型），徽标那一批注记也要补上，而这时同样没有 DOM 变化。
         */
        React.useEffect(
          function () {
            if (bridgeRef.current !== null) bridgeRef.current.scan()
          },
          [levelCount, catalogIndex.models.length]
        )

        // 乐观值：提交后先按用户选的那一档显示，直到宿主真实回报（或超时回滚）。
        var optimisticId = optimistic !== null && typeof optimistic.id === 'string' ? optimistic.id : null
        var optimisticIndex = optimisticId === null ? -1 : indexOfLevel(levels, optimisticId)

        // **已生效**的档位（乐观值优先，其次真实值）：收起态那一行显示的是它，不是拖动中的草稿。
        var effectiveIndex = committedIndex >= 0 ? committedIndex : 0
        if (optimisticIndex >= 0) effectiveIndex = optimisticIndex
        var effectivePct = pctFromIndex(effectiveIndex, levelCount)
        var effectiveLevel = levels[effectiveIndex] || null
        // 席按钮上可能出现的是**任意一个档位名**（档位刚切换时官方还没重渲染）
        var seatNames = []
        for (var n = 0; n < levels.length; n += 1) {
          if (levels[n] && typeof levels[n].name === 'string' && levels[n].name.length > 0)
            seatNames.push(levels[n].name)
        }
        seatNamesRef.current = seatNames

        // 显示用的档位：拖动中跟着草稿，否则就是已生效那一档。
        var shownIndex = draft !== null ? draft.index : effectiveIndex
        var shownPct = draft !== null && typeof draft.pct === 'number' ? draft.pct : effectivePct
        var shownLevel = levels[shownIndex] || null

        // 三个由**位置**连续驱动的量：填充色（蓝→紫→深紫）、能量强度（星云+星星渐入）、位置速率。
        var energy = energyFor(shownPct)
        var energyOn = energy > 0
        // Max 档 = 最高那一档（位置在最右端）。这一档不再显示其他档位的定位点（见样式表 data-max 规则）。
        var atMax = levelCount > 0 && shownIndex >= levelCount - 1
        var fillBackground = fillBackgroundFor(shownPct)
        var knobOffset = knobOffsetOf(shownPct)

        /**
         * 「禁用态 = 渲染函数的完整投影」（参考实现那条工程纪律的移植）。
         *
         * 参考实现用 `classList.toggle("disabled", unsupported)` —— 布尔第二参数**每帧同时负责
         * 加与移除**，所以禁用态永远等于"此刻算出来的状态"，不可能残留。这里就是那一条：
         * `unsupported` 每一帧从最新快照重算，**不经过任何可能僵住的 state**；
         * 渲染时再把它投影到 `data-disabled` 上（CSS 里 `.ces-inline[data-disabled='1']` 负责灰化）。
         *
         * **为什么门在"4 档模型"上**：宿主下发的档位表是权威的，但它**不是同一个语义的字段**：
         * 模型没有推理能力时 `reasoning` 整个缺席。这时官方菜单**根本不会渲染"推理等级"那一行**，
         * 滑条也就无处可挂 —— 所以"禁用"在真宿主里首先表现为"这一栏不存在"。
         * 真正会读到这个禁用态的是两种时序：目录这一代列了模型却给不出可读档位（脏数据），
         * 或者档位表被清空的那一瞬。那时给一个灰掉、不可拖的控件，比给一个"拖了没反应"的控件诚实。
         */
        var disabled = levelCount === 0 || shownLevel === null
        /** 状态与渲染必须同源：把禁用态写进无障碍树，而不是只灰一层。 */
        React.useEffect(
          function () {
            if (host === null || !host.container || typeof host.container.setAttribute !== 'function') return
            host.container.setAttribute('data-disabled', disabled ? '1' : '0')
          },
          [host, disabled]
        )

        // 官方那一行在最高档时描一圈紫边，强度跟着能量走（写内联样式，退出时由桥还原）。
        React.useEffect(
          function () {
            if (host === null || !host.row || !host.row.style) return
            host.row.style.boxShadow = energyOn
              ? 'inset 0 0 0 1px rgba(168,85,247,' + (0.16 + 0.34 * energy).toFixed(2) + ')'
              : ''
          },
          [host, energyOn, energy]
        )

        // 官方那一行的**数值文字**（"Max"）也跟着位置变色：蓝 → 亮紫（用户要求）。
        // 同样写内联、退出时由桥还原；**只改颜色，文字内容一个字都不碰**。
        React.useEffect(
          function () {
            if (host === null || !host.value || !host.value.style) return
            host.value.style.color = valueColorFor(shownPct, shownLevel)
          },
          [host, shownPct, shownLevel]
        )

        // **收起态**那一行的档位文字（模型席按钮上的 "High"，菜单没打开时就看得见）也跟着变色。
        // 颜色交给桥保管：官方重渲染换了节点时，桥会在重新抓到的那一刻补上，不必等 React。
        // 注意这里用**已生效**的档位（不是拖动中的草稿）—— 收起态显示的是真实档位。
        React.useEffect(
          function () {
            if (bridgeRef.current === null) return
            bridgeRef.current.setSeatColor(valueColorFor(effectivePct, effectiveLevel))
          },
          [levelCount, effectivePct, effectiveLevel]
        )

        // 宿主追上乐观值 → 撤掉乐观态（此后以真实目录为准）。
        React.useEffect(
          function () {
            if (optimisticId !== null && effectiveId === optimisticId) setOptimistic(null)
          },
          [effectiveId, optimisticId]
        )

        // 超时兜底：宿主迟迟不回报就回滚并说明，不继续假装已生效。
        React.useEffect(
          function () {
            if (optimisticId === null) return undefined
            var handle = setTimeout(function () {
              if (optimisticIdRef.current === optimisticId) {
                optimisticIdRef.current = null
                setOptimistic(null)
                setError('档位切换超时，宿主未回报结果（已回滚显示）')
              }
            }, COMMIT_DEADLINE_MS)
            return function () {
              clearTimeout(handle)
            }
          },
          [optimisticId]
        )

        // 组件卸载：清掉降频定时器（否则会在卸载后写一次宿主）。
        React.useEffect(function () {
          return function () {
            var pending = commitRef.current
            if (pending.timer !== null) {
              clearTimeout(pending.timer)
              pending.timer = null
            }
            pending.queued = null
          }
        }, [])

        function currentState() {
          return access === null ? EMPTY_SNAPSHOT : access.getSnapshot()
        }

        function flush() {
          var pending = commitRef.current
          if (pending.timer !== null) {
            clearTimeout(pending.timer)
            pending.timer = null
          }
          var levelId = pending.queued
          pending.queued = null
          if (levelId === null || levelId === undefined || access === null) return

          var snapshot = currentState()
          var current = snapshot && snapshot.current
          if (!current || typeof current.provider !== 'string' || typeof current.model !== 'string') {
            setError('模型目录尚未就绪，无法写入档位')
            return
          }
          // 发送前再判一次：可能宿主已经把这个档位写好了（去重的第二道闸）。
          if (effectiveEffortId(snapshot) === levelId) return

          var directory = access.directory()
          if (directory === null || typeof directory.select !== 'function') {
            setError('模型目录不可用，档位未写入')
            return
          }

          pending.inFlight = true
          optimisticIdRef.current = levelId
          setOptimistic({ id: levelId })
          setError(null)
          setBusy(true)

          var result
          try {
            result = directory.select({
              provider: current.provider,
              model: current.model,
              reasoningEffort: levelId
            })
          } catch (error) {
            result = Promise.reject(error)
          }

          Promise.resolve(result)
            .then(
              function (outcome) {
                pending.inFlight = false
                if (outcome && outcome.ok === false) {
                  optimisticIdRef.current = null
                  setOptimistic(null)
                  setError(errorText(outcome.error))
                }
              },
              function (error) {
                pending.inFlight = false
                optimisticIdRef.current = null
                setOptimistic(null)
                setError(errorText(error))
              }
            )
            .then(function () {
              setBusy(false)
              // 在途合并：拖动期间攒下的最新值在这里补发。
              if (pending.queued !== null) flush()
            })
        }

        /** 请求写回某一档：同档位去重 + 在途合并 + 停顿去抖；immediate 用于松手。 */
        function requestCommit(levelId, immediate) {
          if (levelId === null || levelId === undefined) return
          var pending = commitRef.current
          var snapshot = currentState()
          if (effectiveEffortId(snapshot) === levelId && pending.queued === null && !pending.inFlight) return
          pending.queued = levelId
          if (pending.inFlight) return
          if (immediate === true) {
            flush()
            return
          }
          // 去抖：每次请求都重置计时器 —— 指针还在动就永远不落地（见 COMMIT_SETTLE_MS）。
          if (pending.timer !== null) clearTimeout(pending.timer)
          pending.timer = setTimeout(function () {
            pending.timer = null
            flush()
          }, COMMIT_SETTLE_MS)
        }

        function pctAt(clientX) {
          var track = trackRef.current
          if (!track || typeof track.getBoundingClientRect !== 'function') return null
          var rect = track.getBoundingClientRect()
          // 与视觉几何一致：指针落点映射到"球心能到的那一段"（两端各内缩一个**轨道端头**半径），
          // 所以拖到最左/最右必定命中端点档位。
          var usable = rect.width - TRACK_RADIUS * 2
          if (!(usable > 0)) return null
          return clamp01((clientX - rect.left - TRACK_RADIUS) / usable)
        }

        /** 吞掉事件：滑条在官方的 <button> 里，不能让拖动触发那一行的 onClick（会跳进等级列表）。 */
        function swallow(event) {
          if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
        }

        /** 指针位置 → "档位单位"（0 = 最低档，levelCount-1 = 最高档）；拿不到轨道几何时返回 null。 */
        function unitAt(clientX) {
          var pct = pctAt(clientX)
          if (pct === null || levelCount === 0) return null
          return pct * (levelCount - 1)
        }

        /**
         * 指针位置 → 目标档位（用户指定的手感）。
         *
         * 判定线固定在**每一档 + 1/3 档距**处：指针越过它就切到下一档。指针停在档位点上时旋钮
         * 不动（不跟手），只在一格一格地滑。
         *
         * ⚠️ 这条线是同一条，所以前进只需走 1/3 档距、后退要退到 1/3 线以下（= 2/3 档距）。
         *    这是"1/3 阈值"本身的必然结果 —— 若做成对称的 ±1/3 迟滞带，状态机会自相矛盾
         *    （越过 1/3 切上去、而新档位的下界又在 2/3，下一步就会自己切回来，来回抖）。
         *    想要对称手感就把 DETENT_THIRD 改成 1/2（判定线落在中点 = 原来的取最近）。
         */
        /** 指针（档位单位）→ 判定线给出的档位：每一档 +1/3 档距处就是分界线。 */
        function mappingOf(u) {
          var last = levelCount - 1
          return Math.max(0, Math.min(last, Math.floor(u - DETENT_THIRD) + 1))
        }

        /**
         * 指针位置 → 目标档位。判定线见 mappingOf：指针停着旋钮就不动，换档由 CSS 过渡滑过去。
         *
         * 按下死区**只在真正需要时才生效**：按下是"点哪去哪"（取最近档），若落点已经站到判定线
         * 外侧（两者最多差 1/6 档距），不拦一下就会在指针刚动时立刻多跳一档。这种情况让指针先退回
         * 判定线以内、或明确拖满 1/3 档距，就认账。
         * **没有冲突时判定线直接生效 —— 起拖不额外加任何延迟**（早先那版无论冲突与否都要求先空拖
         * 1/3 档距，那正是"拖动延迟高"的来源）。
         */
        function resolveTarget(u) {
          var mapped = mappingOf(u)
          var press = pressRef.current
          if (press.active) {
            if (!press.conflict || mapped === press.index || Math.abs(u - press.u) >= DETENT_THIRD) {
              press.active = false
            } else {
              return press.index
            }
          }
          return mapped
        }

        /** 切快/慢档：只在真的变了才写 state，避免白渲染。 */
        function applySlideSlow(next) {
          if (slideSlowRef.current === next) return
          slideSlowRef.current = next
          setSlideSlow(next)
        }

        /**
         * 换档计时 + 快慢判定（用户要求：拖得慢，动画也慢）。
         * 判据是与**上一次换档**的间隔：隔得久说明手在慢慢挪 → 慢档；一直在动 → 快档。
         * 两个阈值构成 120ms 迟滞，速度刚好卡在阈值上时不会快慢来回跳。
         */
        function noteStepTiming() {
          var now = Date.now()
          var gap = now - lastStepAtRef.current
          lastStepAtRef.current = now
          // 当前是慢档：只有"手又快了"（间隔掉到退出阈值以下）才回快档，其余保持慢档。
          if (slideSlowRef.current) applySlideSlow(gap >= SLOW_DRAG_EXIT_MS)
          // 当前是快档：只有"手明显慢了"（间隔超过进入阈值）才换慢档。
          else applySlideSlow(gap > SLOW_DRAG_ENTER_MS)
        }

        /** 落档：位置变化交给 CSS 过渡去"滑"；没换档就什么都不做（不重放动画、不重复写回）。 */
        function applyTarget(index, immediate) {
          if (levelCount === 0) return
          var currentIndex = draftRef.current !== null ? draftRef.current.index : shownIndex
          var changed = currentIndex !== index
          if (changed) {
            var next = { index: index, pct: pctFromIndex(index, levelCount) }
            draftRef.current = next
            setDraft(next)
            noteStepTiming()
          }
          // 只在这两种情况下碰宿主：真的换档了，或需要立即落地（松手）。
          // 指针每动一下都去读一次会话状态本身也是白烧 —— 连续拖动里那是每秒几十次。
          if (changed || immediate === true) requestCommit(levels[index].id, immediate === true)
        }

        function endDrag() {
          if (!draggingRef.current) return
          draggingRef.current = false
          var latest = draftRef.current
          if (latest !== null && levelCount > 0) requestCommit(levels[latest.index].id, true)
          draftRef.current = null
          setDraft(null)
        }

        function onTrackPointerDown(event) {
          if (locked || disabled || levelCount === 0) return
          swallow(event)
          draggingRef.current = true
          try {
            if (
              event.currentTarget &&
              typeof event.currentTarget.setPointerCapture === 'function' &&
              event.pointerId !== undefined
            ) {
              event.currentTarget.setPointerCapture(event.pointerId)
            }
          } catch (error) {
            /* 指针捕获失败不影响拖动 */
          }
          var u = unitAt(event.clientX)
          if (u === null) return
          // 按下 = 点哪去哪：落到离指针**最近**的那一档（不是 1/3 判定）。
          var nearest = Math.max(0, Math.min(levelCount - 1, Math.round(u)))
          lastStepAtRef.current = Date.now() // 第一次换档的间隔从"按下"算起
          pressRef.current = { u: u, index: nearest, conflict: mappingOf(u) !== nearest, active: true }
          applyTarget(nearest, false)
        }

        function onTrackPointerMove(event) {
          if (!draggingRef.current) return
          swallow(event)
          var u = unitAt(event.clientX)
          if (u === null) return
          applyTarget(resolveTarget(u), false)
        }

        /* 刻意不实现键盘操作（用户要求）：滑条不抢焦点、不吞方向键，官方菜单的键盘导航原样保留。 */

        var trackTitle = '推理等级' + (shownLevel !== null ? '：' + shownLevel.name : '（当前模型没有可用档位）')
        if (disabled) trackTitle += '（当前不可拖动：这一代目录没有给出可用的档位表）'
        if (reducedMotion) trackTitle += '（系统「减少动态效果」已开启：粒子已放缓）'

        var tickNodes = []
        for (var t = 0; t < levelCount; t += 1) {
          tickNodes.push(
            React.createElement('span', {
              key: 'tick-' + levels[t].id,
              className: 'ces-tick',
              'data-ces-part': 'tick',
              'data-on': t <= shownIndex ? '1' : '0',
              // 当前位置那一个：Max 档时靠它把自己留下、其余点隐藏（见样式表 data-max 规则）
              'data-current': t === shownIndex ? '1' : '0',
              style: { left: knobOffsetOf(pctFromIndex(t, levelCount)) }
            })
          )
        }

        // 星空：所有出现粒子的档位都用这一套动画（统一的横穿 + 不消失 + 亮度即大小）。
        // 速率随**位置**变化（速度变化保留）：MAX 档 1.5s 横穿，high 档 3s，左端约 8.6s。
        var positionSpeed = speedFor(shownPct)
        var starCount = starCountFor(shownPct)
        var starLayerOpacity = starLayerOpacityFor(shownPct)
        var particleNodes = []
        for (var s = 0; s < starCount; s += 1) {
          var starBrightness = starBrightnessFor(s)
          // 「减少动态效果」的放缓在 JS 里算（时长是内联的，不走媒体查询覆盖）
          var starDuration = starDurationFor(s, positionSpeed) * (reducedMotion ? REDUCED_MOTION_SLOWDOWN : 1)
          particleNodes.push(
            React.createElement(
              'span',
              {
                key: 'star-' + s,
                className: 'ces-star',
                'data-ces-part': 'star',
                style: {
                  top: PARTICLES[s].y + '%',
                  // ⚠️ 时长与**负相位**必须直接内联：写成 CSS 变量时真宿主里相位不生效，
                  //    会出现"一打开星星全挤在起点"（见样式表里的注释）。
                  animationDuration: starDuration.toFixed(3) + 's',
                  animationDelay: starDelayFor(s, starDuration).toFixed(3) + 's'
                }
              },
              React.createElement('span', {
                className: 'ces-star__dot',
                'data-ces-part': 'particle',
                // 亮度即大小系数：越亮越大（同时也是不透明度）
                'data-brightness': starBrightness.toFixed(3),
                style: { '--ces-b': starBrightness.toFixed(3) }
              })
            )
          )
        }

        var ui = null
        if (host !== null && host.container && levelCount > 0) {
          ui = ReactDOM.createPortal(
            React.createElement(
              'div',
              {
                className: 'ces-inline',
                'data-ces-part': 'root',
                'data-energy': energyOn ? '1' : '0',
                'data-motion': reducedMotion ? 'reduced' : 'full',
                'data-busy': busy ? '1' : '0',
                'data-max': atMax ? '1' : '0',
                'data-slide': slideSlow ? 'slow' : 'fast',
                'data-disabled': disabled ? '1' : '0',
                style: { '--ces-energy': String(energy) }
              },
              React.createElement(
                'div',
                {
                  ref: trackRef,
                  className: 'ces-track',
                  'data-ces-part': 'track',
                  role: 'slider',
                  'aria-label': '推理等级',
                  'aria-valuemin': 0,
                  'aria-valuemax': Math.max(0, levelCount - 1),
                  'aria-valuenow': shownIndex,
                  'aria-valuetext': shownLevel !== null ? shownLevel.name : '',
                  // 禁用态与锁定态进无障碍树：不是"没反应"，是"当前不可用"
                  'aria-disabled': locked || disabled ? 'true' : undefined,
                  title: trackTitle,
                  onPointerDown: onTrackPointerDown,
                  onPointerMove: onTrackPointerMove,
                  onPointerUp: endDrag,
                  onPointerCancel: endDrag,
                  onClick: swallow
                },
                React.createElement('div', {
                  className: 'ces-fill',
                  'data-ces-part': 'fill',
                  // 填充宽度 = 到旋钮圆心为止（不是整条轨道）；背景是"左蓝 → 当前位置颜色"的渐变。
                  style: { width: knobOffset, background: fillBackground }
                }),
                // 能力层（星云 + 扫光）：透明度 = 能量强度，负责"通电"的渐入。
                React.createElement(
                  'div',
                  { className: 'ces-energy', 'data-ces-part': 'energy', style: { width: knobOffset } },
                  React.createElement('div', { className: 'ces-energy__sweep', 'data-ces-part': 'sweep' })
                ),
                // 星星单独一层：不跟星云淡入（否则 high 档星星被星云的 0.5 透明度压得看不见）。
                React.createElement(
                  'div',
                  {
                    className: 'ces-stars',
                    'data-ces-part': 'stars',
                    style: { width: knobOffset, opacity: starLayerOpacity.toFixed(3) }
                  },
                  particleNodes
                ),
                tickNodes,
                React.createElement('div', {
                  className: 'ces-knob',
                  'data-ces-part': 'knob',
                  style: { left: knobOffset }
                })
              ),
              errorText_ !== null
                ? React.createElement(
                    'div',
                    { className: 'ces-error', 'data-ces-part': 'error', role: 'status' },
                    errorText_
                  )
                : null
            ),
            host.container
          )
        }

        // 锚点：不可见、不占位，只用来(1)拿住插槽给的 sessionId 上下文 (2)反查自己的 composer。
        return React.createElement(
          'span',
          {
            ref: anchorRef,
            hidden: true,
            'data-ces-part': 'anchor',
            'aria-hidden': 'true'
          },
          ui
        )
      }

      /* ════════════════════════════ 插件接线 ════════════════════════════ */

      /**
       * 五个服务都是官方客户端插件已经在用的（slots 不必说；sessions 与 modelDirectories
       * 是 client-ui-model-selection / client-ui-workspace 的既有注入面）。
       *
       * ⚠️ **`remote` / `remote.session` 是必须的，别删**（1.3.7 的真机事故就出在这里）：
       * Cordis 的服务访问是**跟着调用方 ctx** 的 —— `models.directoryFor(sessionId)` 内部要
       * `new ModelDirectory(this.ctx.remote.session, …)`，访问 `this.ctx.remote.session` 时**要求
       * 调用方**声明过它，否则抛 `cannot get property "remote.session" without inject`。
       * 官方插件的插件级 inject 就是
       * `["commandUi","locale","sessions","slots","remote","remote.session"]`（逐字核对过）。
       *
       * 为什么"以前能用、接管之后才坏"：Resolver 对每个 binding **缓存**目录实例
       * （`live.directories.get(binding)` 命中就直接返回，**根本不碰 `remote.session`**）。
       * 从前官方那颗席按钮也在渲染 —— 它先调一次 `directoryFor()` 把实例建出来，我们后来只是命中缓存；
       * 1.3.2 接管那一格之后**官方组件不再渲染**，我们就成了第一个（也是唯一的）调用方，
       * 于是必须自己建实例、于是必须自己声明这两个服务。启动顺序还会让它"时好时坏"。
       *
       * 这里刻意**不**注入 locale / theme：多声明一个可能不存在的服务会让 fiber 停在 PENDING；
       * 而 remote / remote.session 是**必然存在**的（`modelDirectories` 自己就静态依赖它们）。
       */
      var inject = ['slots', 'sessions', 'remote', 'remote.session', 'modelDirectories']

      /* ── 插件接线 ────────────────────────────────────────────────────────── */

      /* v1.5.2: 自建浮层（client.picker.js chunk）已随 dsh-better-panel 卸载， */
      /* 它的注册路线与 `ENABLE_OFFICIAL_MENU_SLIDER` 的"二选一"分支一并移除 ——  */
      /* 现在只剩官方菜单滑条这一条路，下面的 apply() 就是唯一的接线点。        */

      function apply(ctx) {
        installStyles()
        {
          try {
            startEffortFx()
          } catch (fxError) {
            /* 闪动失败不影响滑条 */
          }
          try {
            if (ctx.slots && typeof ctx.slots.inject === 'function') {
              ctx.slots.inject(SLOT_NAME, function () {
                return ctx.slots.register(
                  {
                    name: SLOT_NAME,
                    id: ENTRY_ID,
                    order: ENTRY_ORDER,
                    label: function () {
                      return 'Reasoning effort'
                    },
                    // ⚠️ 用私有键名当"第二候选"，**不要**返回 `{sessionId}` —— 那会盖掉 kit 里正确的会话 id
                    //（1.3.6 的真机事故：`binding.key` 与 kit 的 `sessionId` 不是同一个值时，目录永久解析不出来）。
                    inject: function (sessionId) {
                      return { __sessionKey: sessionId }
                    }
                  },
                  function SlotComponent(props) {
                    return React.createElement(CodexEffortSlider, Object.assign({}, props, { __ctx: ctx }))
                  }
                )
              })
            }
          } catch (error) {
            // 注册失败只意味着这块控件不出现，绝不能连累宿主输入区。
            try {
              console.error('[' + PACKAGE_ID + '] 插槽注册失败，控件不会出现：', error)
            } catch (e) {
              /* 忽略 */
            }
          }
        }
      }

      /* ══════ 推理档位切换瞬间的芯片能量闪动（v1.5.0 并入 / v1.5.2 重新安放）
         移植来源同上；版权声明见 LICENSE，修改记录见 THIRD-PARTY-NOTICES.md ══════ */
      var FX_CHIP_SELECTOR = '[data-slot="conversation.input.model"] button'
      var FX_MS = 1400
      var FX_STAR_N = 22
      var fxStarted = false
      var fxLastEffort
      var fxScheduled = false
      var fxSeq = 0

      function fxEnsureStyles() {
        if (document.getElementById('dbp-effort-fx-style')) return
        var style = document.createElement('style')
        style.id = 'dbp-effort-fx-style'
        style.textContent = [
          '.dbp-fx{position:fixed;z-index:9000;pointer-events:none;border-radius:999px;overflow:hidden;box-shadow:0 0 0 1.5px rgba(168,85,247,.55),0 0 18px 2px rgba(124,108,246,.35);animation:dbp-fade ' +
            FX_MS +
            'ms ease forwards}',
          '.dbp-fx__beam{position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,#3f8cff 0%,#7c6cf6 55%,#a855f7 100%);transform-origin:left center;animation:dbp-beam ' +
            FX_MS +
            'ms cubic-bezier(.22,1,.36,1) forwards}',
          '.dbp-fx__star{position:absolute;border-radius:50%;background:#fff;box-shadow:0 0 2px rgba(255,255,255,.9);opacity:0;animation:dbp-drift ' +
            FX_MS +
            'ms linear forwards}',
          '@keyframes dbp-beam{0%{transform:scaleX(0);opacity:0}18%{opacity:1}70%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}',
          '@keyframes dbp-drift{0%{transform:translateX(10px);opacity:0}20%{opacity:var(--dbp-o,.85)}75%{opacity:var(--dbp-o,.85)}100%{transform:translateX(-160px);opacity:0}}',
          '@keyframes dbp-fade{0%{opacity:0}12%{opacity:1}78%{opacity:1}100%{opacity:0}}',
          '@media (prefers-reduced-motion:reduce){.dbp-fx{display:none}}'
        ].join('')
        document.head.appendChild(style)
      }

      function fxHash01(index, salt) {
        var x = Math.imul(index + 1, salt) ^ Math.imul(salt, 2654435761)
        x = Math.imul(x ^ (x >>> 16), 2246822507)
        x = Math.imul(x ^ (x >>> 13), 3266489909)
        return ((x ^ (x >>> 16)) >>> 0) / 4294967296
      }

      function fxReadEffort() {
        var chip = document.querySelector(FX_CHIP_SELECTOR)
        if (!chip) return null
        var label = chip.getAttribute('aria-label') || ''
        var m = label.match(/推理等级\s*([^，,]+)/)
        if (m) return m[1].trim()
        var title = chip.getAttribute('title') || ''
        var parts = title.split('·')
        return parts.length > 1 ? parts[parts.length - 1].trim() : null
      }

      function fxEnergyFor(effort) {
        var e = String(effort || '')
          .toLowerCase()
          .replace(/\s+/g, '')
        if (['off', 'none', '关闭', '无'].indexOf(e) >= 0) return 0
        if (e === 'low' || e === '低') return 0.34
        if (e === 'medium' || e === 'mid' || e === '中') return 0.55
        if (e === 'high' || e === '高') return 0.8
        if (['max', 'xhigh', 'ultra', '最高'].indexOf(e) >= 0 || e.indexOf('extra') === 0) return 1
        return 0.75
      }

      function fxPlay(effort) {
        fxEnsureStyles()
        var chip = document.querySelector(FX_CHIP_SELECTOR)
        if (!chip) return
        var rect = chip.getBoundingClientRect()
        if (rect.width < 8) return
        var energy = fxEnergyFor(effort)
        var fx = document.createElement('div')
        fx.className = 'dbp-fx'
        var fxId = 'dbp-fx-' + ++fxSeq
        fx.id = fxId
        var pad = 5
        fx.style.left = rect.left - pad + 'px'
        fx.style.top = rect.top - pad + 'px'
        fx.style.width = rect.width + pad * 2 + 'px'
        fx.style.height = rect.height + pad * 2 + 'px'
        var beam = document.createElement('div')
        beam.className = 'dbp-fx__beam'
        beam.style.opacity = String(0.25 + 0.55 * energy)
        fx.appendChild(beam)
        var count = Math.round(energy * FX_STAR_N)
        var salt = 71 + fxSeq
        for (var i = 0; i < count; i++) {
          var star = document.createElement('div')
          star.className = 'dbp-fx__star'
          var size = 1.5 + fxHash01(i, salt) * 2.5
          star.style.width = size + 'px'
          star.style.height = size + 'px'
          star.style.left = 100 - fxHash01(i + 40, salt) * 60 + '%'
          star.style.top = 15 + fxHash01(i + 80, salt) * 70 + '%'
          star.style.setProperty('--dbp-o', String(0.35 + 0.5 * fxHash01(i + 120, salt)))
          fx.appendChild(star)
        }
        document.body.appendChild(fx)
        setTimeout(function () {
          var el = document.getElementById(fxId)
          if (el && el.parentNode) el.parentNode.removeChild(el)
        }, FX_MS + 60)
      }

      function fxCheck() {
        var cur = fxReadEffort()
        if (cur === null) {
          fxLastEffort = undefined
          return
        }
        if (fxLastEffort === undefined) {
          fxLastEffort = cur
          return
        }
        if (cur !== fxLastEffort) {
          fxLastEffort = cur
          fxPlay(cur)
        }
      }

      function startEffortFx() {
        if (fxStarted || typeof document === 'undefined' || typeof MutationObserver !== 'function') return
        fxStarted = true
        // rAF 在后台标签页不触发，统一用 120ms 防抖定时器调度
        var mo = new MutationObserver(function () {
          if (fxScheduled) return
          fxScheduled = true
          setTimeout(function () {
            fxScheduled = false
            try {
              fxCheck()
            } catch (e) {
              /* 闪动失败不影响任何其它功能 */
            }
          }, 120)
        })
        mo.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['title', 'aria-label']
        })
      }

      installStyles()

      return {
        start: function (hostCtx) {
          try {
            apply(hostCtx)
          } catch (error) {
            try {
              console.warn('[dsh-model-master/effort-fx] 启动失败（不影响面板功能）：', error)
            } catch (e) {
              /* 忽略 */
            }
          }
        }
      }
    })(React, ReactDOM)

    exports.apply = apply
    exports.inject = inject
    exports.name = 'dsh-model-master'

    return Object.assign(module.exports, {
      apply,
      inject,
      name: 'dsh-model-master'
    })
  }
})
