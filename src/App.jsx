import { useMemo, useState } from "react";
import "./App.css";

const MODES = {
  USDJPY: {
    name: "USDJPY短期モード",
    pair: "USDJPY",
    description: "1分RSI + 5分/15分/1時間MACDで短期スキャル判定",
    slots: ["1分足 RSI", "5分足 MACD", "15分足 MACD", "1時間足 MACD"],
  },
  MXNJPY: {
    name: "MXNJPYスワップ押し目モード",
    pair: "MXNJPY",
    description: "日足/4時間/1時間/15分MACDで長期押し目ロング判定",
    slots: ["日足 MACD", "4時間足 MACD", "1時間足 MACD", "15分足 MACD"],
  },
};

const checks = [
  {
    id: "trend",
    title: "上位足トレンド",
    options: [
      { label: "上位足がロング方向", side: "long", point: 20 },
      { label: "上位足がショート方向", side: "short", point: 20 },
      { label: "方向感なし", side: "neutral", point: 0 },
    ],
  },
  {
    id: "ema",
    title: "EMA/価格位置",
    options: [
      { label: "価格がEMA上、EMAも上向き", side: "long", point: 20 },
      { label: "価格がEMA下、EMAも下向き", side: "short", point: 20 },
      { label: "EMA付近で迷い", side: "neutral", point: 0 },
    ],
  },
  {
    id: "macdMain",
    title: "メイン足 MACD",
    options: [
      { label: "赤・上向き", side: "long", point: 20 },
      { label: "青・下向き", side: "short", point: 20 },
      { label: "弱い / 横ばい", side: "neutral", point: 0 },
    ],
  },
  {
    id: "macdSub",
    title: "短期足 MACD",
    options: [
      { label: "赤・上向き", side: "long", point: 15 },
      { label: "青・下向き", side: "short", point: 15 },
      { label: "逆行 / 迷い", side: "neutral", point: 0 },
    ],
  },
  {
    id: "timing",
    title: "タイミング",
    options: [
      { label: "押し目から反発", side: "long", point: 15 },
      { label: "戻りから反落", side: "short", point: 15 },
      { label: "中途半端", side: "neutral", point: 0 },
    ],
  },
  {
    id: "price",
    title: "サポート/レジスタンス",
    options: [
      { label: "サポート付近で反発", side: "long", point: 10 },
      { label: "レジスタンス付近で反落", side: "short", point: 10 },
      { label: "中途半端な位置", side: "neutral", point: 0 },
    ],
  },
];

const WAIT_WORDS = [
  "新規成行禁止",
  "成行禁止",
  "候補",
  "確認後",
  "押し目",
  "戻り",
  "反発",
  "反落",
  "追い買い",
  "追い売り",
];

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  if (value == null) return "";
  return String(value);
}

function makeAllText(result) {
  return [
    result?.decision,
    result?.entryStatus,
    result?.summary,
    result?.risk,
    result?.entryTrigger,
    result?.entryPlan,
    result?.cancelCondition,
    result?.takeProfitPlan,
    result?.stopPlan,
    toText(result?.reasons),
    toText(result?.riskAlerts),
  ]
    .filter(Boolean)
    .join(" ");
}

function parseRsi(text) {
  const patterns = [
    /1分(?:足)?RSI(?:は|が|:|：|\s)*約?([0-9]{1,2}(?:\.[0-9]+)?)/,
    /RSI(?:は|が|:|：|\s)*約?([0-9]{1,2}(?:\.[0-9]+)?)/,
    /RSI([0-9]{1,2}(?:\.[0-9]+)?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  if (text.includes("RSI30台") || text.includes("30台")) return 35;
  if (text.includes("RSI40台") || text.includes("40台")) return 45;
  if (text.includes("RSI70以上")) return 70;
  if (text.includes("RSI30以下")) return 30;
  return null;
}

function sanitizeMacdWords(text) {
  if (!text) return text;

  return String(text)
    .replace(/赤色で上向き転換気味/g, "上向き転換気味")
    .replace(/赤色で上向き継続/g, "上向き継続")
    .replace(/赤色で上向き/g, "上向き")
    .replace(/赤色/g, "上向き傾向")
    .replace(/青色で下向き継続/g, "下向き継続")
    .replace(/青色で下向き/g, "下向き")
    .replace(/青色/g, "下向き傾向")
    .replace(/赤転換/g, "上向き転換")
    .replace(/青転換/g, "下向き転換")
    .replace(/赤継続/g, "上向き継続")
    .replace(/青継続/g, "下向き継続")
    .replace(/赤の上向き/g, "上向き")
    .replace(/青の下向き/g, "下向き")
    .replace(/MACD赤/g, "MACD上向き")
    .replace(/MACD青/g, "MACD下向き")
    .replace(/付近付近/g, "付近")
    .replace(/近辺付近/g, "近辺")
    .replace(/付近近辺/g, "付近")
    .replace(/候補候補/g, "候補")
    .replace(/付近\s*付近/g, "付近")
    .replace(/RSIの数値が70を超えておらず、過熱感はまだない/g, "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい")
    .replace(/RSIが70未満で過熱感はまだない/g, "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい")
    .replace(/過熱感はまだない/g, "買われ過ぎではないが、現在値からの追い買いは避けたい");
}

function normalizeTextFields(result) {
  const next = { ...result };
  [
    "summary",
    "risk",
    "entryTrigger",
    "entryPlan",
    "cancelCondition",
    "takeProfitPlan",
    "stopPlan",
  ].forEach((key) => {
    if (next[key]) next[key] = sanitizeMacdWords(next[key]);
  });

  if (Array.isArray(next.reasons)) next.reasons = next.reasons.map(sanitizeMacdWords);
  if (Array.isArray(next.riskAlerts)) next.riskAlerts = next.riskAlerts.map(sanitizeMacdWords);

  return next;
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function clampScore(value, min, max) {
  const n = Number(value ?? 0);
  return Math.max(min, Math.min(max, n));
}

function fmtPrice(value) {
  return Number(value).toFixed(3);
}

function extractFirstPrice(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? Number(match[1]) : null;
}

function estimateCurrentPriceForLong(next) {
  const text = makeAllText(next);
  const explicit = extractFirstPrice(text, /現在(?:値|価格)(?:は|が|:|：|\s)*([0-9]{3}\.[0-9]{3,4})/);
  if (explicit) return explicit;

  const longTp1 = extractFirstPrice(text, /ロング時[\s\S]*?TP1\s*[:：]?\s*([0-9]{3}\.[0-9]{3,4})/);
  if (longTp1) return longTp1 - 0.005;

  const tp1 = extractFirstPrice(text, /TP1\s*[:：]?\s*([0-9]{3}\.[0-9]{3,4})/);
  if (tp1) return tp1 - 0.005;

  const entryRange = String(next?.entryTrigger || next?.entryPlan || "").match(/([0-9]{3}\.[0-9]{3,4})\s*[〜~～]\s*([0-9]{3}\.[0-9]{3,4})/);
  if (entryRange) return (Number(entryRange[1]) + Number(entryRange[2])) / 2 + 0.020;

  return null;
}

function buildRsiMidLongEntry(next) {
  const current = estimateCurrentPriceForLong(next);
  if (!current) return null;

  const firstLow = current - 0.020;
  const firstHigh = current - 0.010;
  const secondLow = current - 0.040;
  const secondHigh = current - 0.020;
  const shortLow = current + 0.005;
  const shortHigh = current + 0.025;

  return `新規成行禁止。
ロング候補:
第一候補は${fmtPrice(firstLow)}〜${fmtPrice(firstHigh)}付近で下げ止まり、1分RSIが50〜55まで落ち着き、陽線確定した場合。5分MACDが上向き継続し、15分MACDの上向き基調を維持していればロング検討。
第二候補は${fmtPrice(secondLow)}〜${fmtPrice(secondHigh)}付近まで押した場合。15分足の上昇基調が崩れず、1分RSI40〜50から反発したらロング検討。
ショート候補:
上位足ロング背景が強いため、ショートは短期逆張り扱い。${fmtPrice(shortLow)}〜${fmtPrice(shortHigh)}付近で上値が重くなり、1分RSIが60〜70から反落。5分MACDが下向き転換し、陰線確定した場合のみ短期ショート検討。`;
}

function inferState({ direction, currentState, longScore, shortScore, confidence, rsi, allText }) {
  const diff = Math.abs(longScore - shortScore);

  if (diff < 10) {
    if (rsi != null && rsi >= 70) return "反落待ち";
    if (rsi != null && rsi <= 30) return "反発待ち";
    return "方向待ち";
  }

  if (confidence < 50) return "方向待ち";

  if (String(direction).includes("ロング")) {
    if (rsi != null && rsi >= 70) return "押し目買い待ち";
    if (rsi != null && rsi >= 40 && rsi <= 55) return "反発確認待ち";
    if (hasAny(allText, ["押し目", "反発確認", "下げ止まり"])) return "反発確認待ち";
    return currentState && currentState !== "待ち" ? currentState : "押し目買い待ち";
  }

  if (String(direction).includes("ショート")) {
    if (rsi != null && rsi <= 30) return "戻り売り待ち";
    if (hasAny(allText, ["戻り売り", "上値が重", "反落確認"])) return "戻り売り待ち";
    return currentState && currentState !== "待ち" ? currentState : "戻り売り待ち";
  }

  if (currentState && currentState !== "待ち") return currentState;
  return "方向待ち";
}

function normalizeFxResult(aiResult, mode) {
  if (!aiResult) return null;

  let next = normalizeTextFields({ ...aiResult });
  const allText = makeAllText(next);
  const rsi = parseRsi(allText);
  let longScore = Number(next.longScore ?? 0);
  let shortScore = Number(next.shortScore ?? 0);
  let confidence = Number(next.confidence ?? 0);
  let decision = String(next.decision || "見送り");
  let state = String(next.state || next.statusText || next.entryStatusText || "待ち");

  const hasHigherLong = hasAny(allText, [
    "1時間足は上昇",
    "1時間足は上向き",
    "1時間足MACDは上向き",
    "1時間足MACDはプラス圏",
    "上位足ロング",
    "ロング背景",
    "上昇基調を維持",
  ]);

  const hasHigherShort = hasAny(allText, [
    "1時間足は下降",
    "1時間足MACDは下向き",
    "上位足ショート",
    "下降基調",
  ]);

  const macdDownContext = hasAny(allText, [
    "MACD下向き継続",
    "下向き継続",
    "5分足MACDは下向き",
    "5分MACDが下向き",
    "5分MACD下向き",
  ]);

  const weakBounceContext = hasAny(allText, [
    "戻りが弱い",
    "戻りは弱い",
    "上値が重",
    "EMA帯を下回",
    "EMA帯割れ",
    "EMAの下",
    "EMA下",
    "回復できず",
  ]);

  const textForWait = `${next.entryTrigger || ""} ${next.entryPlan || ""} ${next.summary || ""} ${next.risk || ""}`;
  const hasWaitText = WAIT_WORDS.some((word) => textForWait.includes(word));

  // 小差は方向待ちを優先する
  if (Math.abs(longScore - shortScore) < 10) {
    decision = "見送り";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 50, 50);
    if (rsi != null && rsi >= 70) state = "反落待ち";
    else if (rsi != null && rsi <= 30) state = "反発待ち";
    else state = "方向待ち";
  }

  // 上位足ロング背景 + RSI30台: 原則ショートへ寄せすぎない。
  if (mode === "USDJPY" && hasHigherLong && rsi != null && rsi >= 30 && rsi < 40) {
    if (weakBounceContext && macdDownContext) {
      decision = "ショート寄り";
      state = "戻り売り待ち";
      shortScore = Math.max(shortScore, 60);
      longScore = Math.min(longScore, 50);
      confidence = Math.min(confidence || 65, 65);
      next.summary =
        "上位足にはロング背景が残るが、1分足がEMA帯を下回り、戻りが弱い。短期はショート寄り。ただし1分RSIは30台で追い売りは禁止のため、戻り売り待ち。";
    } else {
      decision = "ロング優勢";
      state = "反発確認待ち";
      longScore = Math.max(longScore, 65);
      shortScore = Math.min(shortScore, 45);
      confidence = Math.min(confidence || 65, 65);
      next.entryStatus = "WAIT";
      next.summary =
        "上位足にはロング背景があり、1分足だけ急落してRSI30台まで低下している。現在値からの追い売りは禁止。押し目に入っている可能性があり、下げ止まりと反発確認を待つ場面。";
      next.riskAlerts = [
        "上位足ロング背景で1分RSIが30台のため、追い売りではなく反発確認待ち",
        "急落直後で上下に振れやすい",
        "反発確認前の成行ロングも禁止",
      ];
    }
  }

  // 上位足ロング背景 + RSI40〜50台 + 押し目: 強くしすぎない。
  if (
    mode === "USDJPY" &&
    hasHigherLong &&
    rsi != null &&
    rsi >= 40 &&
    rsi <= 55 &&
    (String(decision).includes("ロング") || longScore >= shortScore)
  ) {
    decision = String(decision).includes("見送り") ? "ロング寄り" : "ロング優勢";
    state = "反発確認待ち";
    longScore = clampScore(longScore || 70, 65, 75);
    shortScore = Math.min(shortScore, 50);
    confidence = Math.min(confidence || 65, 65);
    next.entryStatus = "WAIT";
  }

  // 上位足ロング背景 + RSI55〜65 + 5分足やや鈍化では、浅めの押し目候補を優先する。
  if (
    mode === "USDJPY" &&
    hasHigherLong &&
    String(decision).includes("ロング") &&
    rsi != null &&
    rsi >= 55 &&
    rsi <= 65
  ) {
    state = "反発確認待ち";
    confidence = Math.min(confidence || 65, 65);
    next.entryStatus = "WAIT";
    const rebuiltEntry = buildRsiMidLongEntry(next);
    if (rebuiltEntry) next.entryTrigger = rebuiltEntry;
    next.summary = sanitizeMacdWords(
      String(next.summary || "").replace(
        /RSI(?:の数値)?が70(?:を)?(?:超えておらず|未満で)[^。]*過熱感[^。]*。?/g,
        "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい。"
      )
    );
    next.reasons = Array.isArray(next.reasons)
      ? next.reasons.map((reason) =>
          sanitizeMacdWords(
            String(reason).replace(
              /RSI(?:の数値)?が70(?:を)?(?:超えておらず|未満で)[^。]*過熱感[^。]*。?/g,
              "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい。"
            )
          )
        )
      : next.reasons;
  }

  // RSI70以上のロング優勢は押し目待ち・成行禁止。
  if (String(decision).includes("ロング") && rsi != null && rsi >= 70) {
    state = "押し目買い待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 70, 70);
    next.riskAlerts = [
      ...(Array.isArray(next.riskAlerts) ? next.riskAlerts : next.risk ? [next.risk] : []),
      "1分RSIが70以上のため追い買い禁止。押し目買い待ち。",
    ];
  }

  // RSI30以下のショート優勢は戻り売り待ち・成行禁止。
  if (String(decision).includes("ショート") && rsi != null && rsi <= 30) {
    state = "戻り売り待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 70, 70);
    next.riskAlerts = [
      ...(Array.isArray(next.riskAlerts) ? next.riskAlerts : next.risk ? [next.risk] : []),
      "1分RSIが30以下のため追い売り禁止。戻り売り待ち。",
    ];
  }

  // 文字上で新規成行禁止/候補/確認待ちがある場合は必ずWAIT。
  if (hasWaitText) {
    next.entryStatus = "WAIT";
  }

  // 方向名と状態ラベルの最終補正。
  state = inferState({
    direction: decision,
    currentState: state,
    longScore,
    shortScore,
    confidence,
    rsi,
    allText: makeAllText(next),
  });

  if (next.entryStatus === "WAIT" && state === "待ち") {
    state = inferState({
      direction: decision,
      currentState: "方向待ち",
      longScore,
      shortScore,
      confidence,
      rsi,
      allText: makeAllText(next),
    });
  }

  // TPコメントの固定化。
  if (next.takeProfitPlan) {
    next.takeProfitPlan = sanitizeMacdWords(next.takeProfitPlan).replace(
      /TP1は無理に狙わずTP2まで狙う形が望ましい。?/g,
      "TP1は短期利確候補。反発/反落が強い場合のみTP2以降を検討。"
    );
    if (!next.takeProfitPlan.includes("TP1は短期利確候補")) {
      next.takeProfitPlan +=
        "\nRR目安: ENTRY価格とSTOP位置次第。TP1は短期利確候補。反発/反落が強い場合のみTP2以降を検討。";
    }
  }

  next = normalizeTextFields(next);

  return {
    ...next,
    decision,
    state,
    entryStatus: next.entryStatus || "WAIT",
    longScore: Math.round(longScore),
    shortScore: Math.round(shortScore),
    confidence: Math.round(confidence),
  };
}

function buildDisplayResult({ normalizedAiResult, answers, mode }) {
  if (normalizedAiResult) {
    const long = Number(normalizedAiResult.longScore ?? 0);
    const short = Number(normalizedAiResult.shortScore ?? 0);
    const diff = Math.abs(long - short);
    const max = Math.max(long, short);

    let direction = normalizedAiResult.decision || "見送り";
    let status = normalizedAiResult.entryStatus || "WAIT";
    let statusText = normalizedAiResult.state || "方向待ち";
    let className = "wait";
    const message = normalizedAiResult.summary || "AI判定結果";

    if (String(direction).includes("ロング")) className = "long";
    if (String(direction).includes("ショート")) className = "short";
    if (String(direction).includes("見送り")) className = "wait";

    if (status === "ENTRY_OK" || status === "ENTRY OK") {
      status = "ENTRY OK";
      statusText = statusText === "待ち" ? "エントリー可" : statusText;
    } else {
      status = "WAIT";
      statusText = statusText && statusText !== "待ち" ? statusText : "方向待ち";
    }

    if (diff < 10 || max < 50) {
      direction = direction.includes("見送り") ? direction : "見送り";
      status = "WAIT";
      if (!statusText || statusText === "待ち") statusText = "方向待ち";
      className = "wait";
    }

    return { long, short, diff, direction, status, statusText, message, className };
  }

  let long = 0;
  let short = 0;

  checks.forEach((check) => {
    const selected = answers[check.id];
    const option = check.options.find((o) => o.label === selected);
    if (!option) return;
    if (option.side === "long") long += option.point;
    if (option.side === "short") short += option.point;
  });

  const diff = Math.abs(long - short);
  const max = Math.max(long, short);

  let direction = "見送り";
  let status = "WAIT";
  let statusText = "方向待ち";
  let message = "方向感が弱いので無理に入らない。";
  let className = "wait";

  if (max < 45 || diff < 10) {
    status = "NO ENTRY";
    statusText = "禁止";
    message = "ロング・ショートの根拠が混ざっています。";
    className = "danger";
  } else if (long >= 75 && diff >= 25) {
    direction = "ロング優勢";
    status = "ENTRY OK";
    statusText = "エントリー可";
    message = "ロング条件が揃い気味。";
    className = "long";
  } else if (short >= 75 && diff >= 25) {
    direction = "ショート優勢";
    status = "ENTRY OK";
    statusText = "エントリー可";
    message = "ショート条件が揃い気味。";
    className = "short";
  } else if (long > short) {
    direction = mode === "MXNJPY" ? "押し目待ち" : "ややロング";
  } else if (short > long) {
    direction = mode === "MXNJPY" ? "買いは慎重" : "ややショート";
  }

  return { long, short, diff, direction, status, statusText, message, className };
}

function App() {
  const [mode, setMode] = useState("USDJPY");
  const currentMode = MODES[mode];

  const [images, setImages] = useState([null, null, null, null]);
  const [files, setFiles] = useState([null, null, null, null]);
  const [answers, setAnswers] = useState({});
  const [memo, setMemo] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const normalizedAiResult = useMemo(() => normalizeFxResult(aiResult, mode), [aiResult, mode]);

  const result = useMemo(
    () => buildDisplayResult({ normalizedAiResult, answers, mode }),
    [answers, normalizedAiResult, mode]
  );

  const handleImage = (index, file) => {
    if (!file) return;

    const url = URL.createObjectURL(file);

    const nextImages = [...images];
    nextImages[index] = url;
    setImages(nextImages);

    const nextFiles = [...files];
    nextFiles[index] = file;
    setFiles(nextFiles);

    setAiResult(null);
  };

  const handleBulkImages = (selectedFiles) => {
    const arr = Array.from(selectedFiles).slice(0, 4);

    if (arr.length !== 4) {
      alert("スクショは4枚まとめて選択してください。");
      return;
    }

    setFiles(arr);
    setImages(arr.map((file) => URL.createObjectURL(file)));
    setAiResult(null);
  };

  const apiBase = window.location.port === "5173" ? `http://${window.location.hostname}:8787` : window.location.origin;

  const analyzeWithAi = async () => {
    if (files.some((f) => !f)) {
      alert("4枚すべてのスクショを入れてください。");
      return;
    }

    setLoading(true);
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("pair", currentMode.pair);
      formData.append("slot1", files[0]);
      formData.append("slot2", files[1]);
      formData.append("slot3", files[2]);
      formData.append("slot4", files[3]);

      const res = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert((data.error || "AI判定に失敗しました。") + "\n" + (data.detail || ""));
        return;
      }

      setAiResult(data);

      const normalized = normalizeFxResult(data, mode) || data;
      setMemo(
        `モード: ${currentMode.name}
AI判定: ${normalized.decision}
ステータス: ${normalized.entryStatus}
LONG: ${normalized.longScore}点 / SHORT: ${normalized.shortScore}点
信頼度: ${normalized.confidence}

理由:
${(normalized.reasons || []).map((r) => `・${r}`).join("\n")}

注意:
${(normalized.riskAlerts || [normalized.risk]).filter(Boolean).map((r) => `・${r}`).join("\n")}

エントリー:
${normalized.entryTrigger || normalized.entryPlan || ""}

利確:
${normalized.takeProfitPlan || ""}

撤退:
${normalized.stopPlan || ""}`
      );
    } catch (e) {
      alert("AIサーバーにつながりません。node server.js が起動しているか確認してください。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setImages([null, null, null, null]);
    setFiles([null, null, null, null]);
    setAnswers({});
    setMemo("");
    setAiResult(null);
  };

  const changeMode = (newMode) => {
    setMode(newMode);
    resetAll();
  };

  const riskAlerts = useMemo(() => {
    if (!normalizedAiResult) return [];

    if (Array.isArray(normalizedAiResult.riskAlerts) && normalizedAiResult.riskAlerts.length > 0) {
      return normalizedAiResult.riskAlerts;
    }

    if (normalizedAiResult.risk) return [normalizedAiResult.risk];

    return [];
  }, [normalizedAiResult]);

  const entryCard = useMemo(
    () => ({
      entryTrigger:
        normalizedAiResult?.entryTrigger ||
        normalizedAiResult?.entryPlan ||
        "AI判定後に表示されます。",
      cancelCondition: normalizedAiResult?.cancelCondition || "AI判定後に表示されます。",
      takeProfitPlan: normalizedAiResult?.takeProfitPlan || "AI判定後に表示されます。",
      stopPlan: normalizedAiResult?.stopPlan || "AI判定後に表示されます。",
    }),
    [normalizedAiResult]
  );

  const chatCopyText = useMemo(() => {
    if (!normalizedAiResult) return "";

    return `【FXチェック結果】
モード：${currentMode.name}
判定：${result.direction}
状態：${result.statusText}
LONG：${result.long}点
SHORT：${result.short}点
差：${result.diff}点
信頼度：${normalizedAiResult.confidence ?? "-"}点

総評：
${normalizedAiResult.summary || "-"}

危険条件：
${riskAlerts.length > 0 ? riskAlerts.map((r) => `・${r}`).join("\n") : "・特になし"}

ENTRY：
${entryCard.entryTrigger}

CANCEL：
${entryCard.cancelCondition}

TP：
${entryCard.takeProfitPlan}

STOP：
${entryCard.stopPlan}

AI理由：
${(normalizedAiResult.reasons || []).map((r) => `・${r}`).join("\n")}`;
  }, [normalizedAiResult, currentMode.name, result, riskAlerts, entryCard]);

  const copyForChat = async () => {
    if (!chatCopyText) return;

    try {
      await navigator.clipboard.writeText(chatCopyText);
      alert("ChatGPT用テキストをコピーしました。");
    } catch {
      alert("コピーに失敗しました。テキスト欄から手動でコピーしてください。");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>FX エントリーチェッカー</h1>
          <p>{currentMode.description}</p>
        </div>
        <button className="reset" onClick={resetAll}>リセット</button>
      </header>

      <section className="modeBox">
        <button
          className={mode === "USDJPY" ? "mode active" : "mode"}
          onClick={() => changeMode("USDJPY")}
        >
          USDJPY短期
        </button>

        <button
          className={mode === "MXNJPY" ? "mode active" : "mode"}
          onClick={() => changeMode("MXNJPY")}
        >
          MXNJPYスワップ
        </button>
      </section>

      <section className={`result ${result.className}`}>
        <div className="resultMain">
          <span className="smallLabel">判定</span>
          <h2>{result.direction}</h2>
          <p>{result.message}</p>
        </div>

        <div className="statusBox">
          <div className="status">{loading ? "AI CHECK..." : result.status}</div>
          <div className="statusText">{loading ? "判定中" : result.statusText}</div>
        </div>

        <div className="scoreBox">
          <div className="score longScore">LONG {result.long}点</div>
          <div className="score shortScore">SHORT {result.short}点</div>
          <div className="diff">差 {result.diff}点</div>
        </div>
      </section>

      <button className="aiButton" onClick={analyzeWithAi} disabled={loading}>
        {loading ? "AI判定中..." : "スクショからAI自動チェック"}
      </button>

      {normalizedAiResult && (
        <section className="tradeCards">
          <div className="dangerAlert">
            <h3>危険条件アラート</h3>
            {riskAlerts.length > 0 ? (
              <ul>
                {riskAlerts.map((alert, i) => (
                  <li key={i}>{alert}</li>
                ))}
              </ul>
            ) : (
              <p>大きな危険条件は検出されていません。</p>
            )}
          </div>

          <div className="entryCards">
            <div className="planCard entry">
              <span>ENTRY</span>
              <h3>エントリー条件</h3>
              <p>{entryCard.entryTrigger}</p>
            </div>

            <div className="planCard cancel">
              <span>CANCEL</span>
              <h3>取消条件</h3>
              <p>{entryCard.cancelCondition}</p>
            </div>

            <div className="planCard profit">
              <span>TAKE PROFIT</span>
              <h3>利確目安</h3>
              <p>{entryCard.takeProfitPlan}</p>
            </div>

            <div className="planCard stop">
              <span>STOP</span>
              <h3>損切り/撤退目安</h3>
              <p>{entryCard.stopPlan}</p>
            </div>
          </div>
        </section>
      )}

      {normalizedAiResult && (
        <section className="copyBox">
          <div className="copyHeader">
            <h3>ChatGPTに送る用テキスト</h3>
            <button onClick={copyForChat}>コピーする</button>
          </div>

          <textarea
            className="copyText"
            value={chatCopyText}
            readOnly
          />
        </section>
      )}

      <section className="bulkBox">
        <h3>一括アップロード</h3>
        <p>下の順番で4枚まとめて選択してください。</p>
        <ol>
          {currentMode.slots.map((slot) => (
            <li key={slot}>{slot}</li>
          ))}
        </ol>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleBulkImages(e.target.files)}
        />
      </section>

      <section className="images">
        {currentMode.slots.map((name, i) => (
          <div className="imageBox" key={name}>
            <label>{name}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImage(i, e.target.files[0])}
            />
            {images[i] ? (
              <img src={images[i]} alt={name} />
            ) : (
              <div className="placeholder">スクショを選択</div>
            )}
          </div>
        ))}
      </section>

      {normalizedAiResult && (
        <section className="aiDetail">
          <h3>AIの理由</h3>
          <ul>
            {(normalizedAiResult.reasons || []).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <p><b>注意:</b> {riskAlerts.join(" / ") || normalizedAiResult.risk}</p>
          <p><b>エントリー:</b> {entryCard.entryTrigger}</p>
          <p><b>利確:</b> {entryCard.takeProfitPlan}</p>
          <p><b>撤退:</b> {entryCard.stopPlan}</p>
        </section>
      )}

      <section className="memo">
        <h3>エントリーメモ</h3>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="AI判定結果や自分のトレードメモが入ります。"
        />
      </section>

      <footer>
        ※これは売買を保証するものではなく、チャート条件の整理用です。
      </footer>
    </div>
  );
}

export default App;
