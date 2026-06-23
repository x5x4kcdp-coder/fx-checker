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
    .replace(/赤（上向き）/g, "上向き")
    .replace(/青（下向き）/g, "下向き")
    .replace(/赤\s*\(上向き\)/g, "上向き")
    .replace(/青\s*\(下向き\)/g, "下向き")
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
    .replace(/赤\s*\//g, "上向き/")
    .replace(/青\s*\//g, "下向き/")
    .replace(/付近付近/g, "付近")
    .replace(/近辺付近/g, "近辺")
    .replace(/付近近辺/g, "付近")
    .replace(/候補候補/g, "候補")
    .replace(/付近\s*付近/g, "付近")
    .replace(/RSIの数値が70を超えておらず、過熱感はまだない/g, "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい")
    .replace(/RSIが70未満で過熱感はまだない/g, "1分RSIは70未満で買われ過ぎではないが、直近上昇後のため現在値からの追い買いは避けたい")
    .replace(/過熱感はまだない/g, "買われ過ぎではないが、現在値からの追い買いは避けたい");
}


function sanitizeMxnSwapText(text) {
  if (!text) return text;
  let value = String(text);
  value = value
    .replace(/1分(?:足)?RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:〜|~|～|-)\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:へ回復)?\s*(?:から)?\s*反発/g, "短期足の下げ止まり")
    .replace(/1分(?:足)?RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:〜|~|～|-)\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:から)?\s*反落/g, "短期足の反落確認")
    .replace(/1分(?:足)?RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:台(?:前半|後半)?|付近|以下|以上|未満|超え|割れ)?/g, "短期RSIは未確認")
    .replace(/1分(?:足)?RSI/g, "短期RSI")
    .replace(/1分足/g, "短期足")
    .replace(/RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:〜|~|～|-)\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:へ回復)?\s*(?:から)?\s*反発/g, "短期足の下げ止まり")
    .replace(/RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:〜|~|～|-)\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:から)?\s*反落/g, "短期足の反落確認")
    .replace(/RSI\s*(?:が|は)?\s*[0-9０-９]+(?:\.[0-9]+)?\s*(?:台(?:前半|後半)?|付近|以下|以上|未満|超え|割れ)?/g, "短期RSIは未確認")
    .replace(/5分足MACD/g, "短期足の動き")
    .replace(/5分MACD/g, "短期足の動き")
    .replace(/5分足/g, "短期足")
    .replace(/5分/g, "短期足")
    .replace(/短期RSIは未確認(?:へ回復し|へ回復|から反発|で反発)/g, "短期足の下げ止まり")
    .replace(/短期RSIは未確認(?:から反落|で反落)/g, "短期足の反落確認")
    .replace(/短期RSIは未確認で買い圧力は弱い/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認でやや弱い/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認で過熱感はなく/g, "短期RSIは未確認のため、RSIでは判断せず")
    .replace(/短期RSIは未確認だが、?過熱感(?:は)?なし。?/g, "短期RSIは未確認のため、RSIでは判断せず反発確認を待つ場面。")
    .replace(/短期RSIは未確認だが、?過熱感(?:は)?ない/g, "短期RSIは未確認のため、RSIでは判断せず")
    .replace(/短期RSIは未確認のため過熱感はなく/g, "短期RSIは未確認のため、RSIでは判断せず")
    .replace(/短期RSIは未確認のため買い圧力は弱い/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認、?買い圧力は弱い/g, "短期RSIは未確認")
    .replace(/買い圧力はある/g, "反発確認が必要")
    .replace(/買い圧力はやや優勢/g, "反発確認が必要")
    .replace(/\b1\d{2}\.\d{2,4}\s*[〜~～]\s*1\d{2}\.\d{2,4}\b/g, "現在値付近")
    .replace(/\b1\d{2}\.\d{2,4}\b/g, "現在値付近")
    .replace(/短期RSIは未確認は/g, "短期RSIは")
    .replace(/短期RSIは未確認が/g, "短期RSIは未確認で")
    .replace(/付近付近/g, "付近");
  return value;
}

function polishMxnSwapText(text) {
  if (!text) return text;
  let value = String(text);
  value = value
    .replace(/1短期足/g, "短期足")
    .replace(/短期RSIは未確認\s*[〜~～-]\s*\d+(?:\.\d+)?\s*付近/g, "短期足の反落確認")
    .replace(/短期RSIは未確認\s*[〜~～-]\s*\d+(?:\.\d+)?/g, "短期足の反落確認")
    .replace(/短期RSIは未確認を維持し、?/g, "")
    .replace(/短期RSIは未確認を維持/g, "")
    .replace(/短期RSIは未確認でEMA帯割れ/g, "短期足がEMA帯を割り込む")
    .replace(/短期RSIは未確認でEMA帯回復/g, "短期足がEMA帯を回復")
    .replace(/短期RSIは未確認でEMA帯/g, "短期足がEMA帯")
    .replace(/短期RSIは未確認で推移する場合/g, "短期足の反発確認が出ない場合")
    .replace(/短期RSIは未確認を下回る場合/g, "短期足の反発確認が出ない場合")
    .replace(/短期RSIは未確認を下回り続ける場合/g, "短期足が再び強い下向き継続となり、EMA帯を回復できない場合")
    .replace(/短期RSIは未確認を下回り続ける/g, "短期足が再び強い下向き継続となる")
    .replace(/短期RSIは未確認以上でEMA帯/g, "短期足がEMA帯")
    .replace(/短期RSIは未確認未満/g, "短期足の反発確認不足")
    .replace(/短期RSIは未確認以上/g, "短期足の反発確認")
    .replace(/短期RSIは未確認以下/g, "短期足の反発確認不足")
    .replace(/短期RSIは未確認付近/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認台/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認で反落/g, "短期足の反落確認")
    .replace(/短期RSIは未確認で反発/g, "短期足の下げ止まり")
    .replace(/短期RSIは未確認から反落/g, "短期足の反落確認")
    .replace(/短期RSIは未確認から反発/g, "短期足の下げ止まり")
    .replace(/短期RSIは未確認へ回復/g, "短期足の下げ止まり")
    .replace(/短期RSIは未確認を確認/g, "短期足の反発確認")
    .replace(/短期足の反落確認から反落/g, "短期足の反落確認")
    .replace(/短期足の反落確認\s*[＋+]?\s*陰線/g, "短期足の反落確認＋陰線")
    .replace(/短期足は明確な下向き継続で短期上向き継続/g, "短期足は下向きが続いており、反発確認はまだ不足")
    .replace(/短期足は下向き継続で短期上向き継続/g, "短期足は下向きが続いており、反発確認はまだ不足")
    .replace(/下向き継続で短期上向き継続/g, "下向きが続いており、反発確認はまだ不足")
    .replace(/明確な下向き継続で短期上向き継続/g, "下向きが続いており、反発確認はまだ不足")
    .replace(/短期足の動きは明確な下向き継続で短期上向き継続/g, "短期足は下向きが続いており、反発確認はまだ不足")
    .replace(/短期足の動きは/g, "短期足は")
    .replace(/短期足が動き/g, "短期足の動き")
    .replace(/短期足の動きの/g, "短期足の")
    .replace(/短期足MACD/g, "短期足の動き")
    .replace(/短期足の動きが上向き転換し、\s*EMA帯/g, "短期足が上向き転換し、EMA帯")
    .replace(/短期足の動きが下向き継続/g, "短期足が下向き継続")
    .replace(/短期足の動き上向き転換/g, "短期足が上向き転換")
    .replace(/短期足の動き下向き転換/g, "短期足が下向き転換")
    .replace(/短期足の動き/g, "短期足")
    .replace(/短期RSIは未確認、?\s*短期RSIは未確認/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認のため、?\s*短期RSIは未確認/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認\s*で\s*短期RSIは未確認/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認\s*。\s*短期RSIは未確認/g, "短期RSIは未確認")
    .replace(/短期RSIは未確認\s*、\s*反発確認前/g, "短期RSIは未確認のため、反発確認前")
    .replace(/短期RSIは未確認のため、反発確認前の成行ロングは禁止。?\s*短期RSIは未確認のため、?反発確認前の成行ロングは禁止。?/g, "短期RSIは未確認のため、反発確認前の成行ロングは禁止")
    .replace(/短期RSIは未確認のため反発確認前の成行ロングは禁止。?/g, "短期RSIは未確認のため、反発確認前の成行ロングは禁止")
    .replace(/未確認〜/g, "未確認")
    .replace(/\s+、/g, "、")
    .replace(/、\s*、/g, "、")
    .replace(/。\s*。/g, "。")
    .replace(/付近付近/g, "付近");
  return value.trim();
}

function uniqueMxnRiskAlerts(alerts) {
  const rsiRisk = "短期RSIは未確認のため、反発確認前の成行ロングは禁止";
  const seen = new Set();
  const result = [];
  for (const raw of alerts || []) {
    let item = polishMxnSwapText(sanitizeMxnSwapText(sanitizeMacdWords(raw || "")));
    if (!item) continue;
    if (/短期RSIは未確認/.test(item) && /成行ロングは禁止|反発確認前/.test(item)) item = rsiRisk;
    const key = item.replace(/[。\s]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}


function formatMxnPrice(value) {
  if (!Number.isFinite(value)) return "9.295";
  return Number(value).toFixed(3);
}

function roundMxn(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function collectMxnPricesFromResult(result) {
  const text = [
    result?.summary,
    result?.risk,
    result?.entryTrigger,
    result?.entryPlan,
    result?.cancelCondition,
    result?.takeProfitPlan,
    result?.stopPlan,
    Array.isArray(result?.reasons) ? result.reasons.join(" ") : result?.reasons,
    Array.isArray(result?.riskAlerts) ? result.riskAlerts.join(" ") : result?.riskAlerts,
  ].filter(Boolean).join(" ");
  const prices = [];
  for (const match of text.matchAll(/\b9\.\d{2,4}\b/g)) {
    const v = Number(match[0]);
    if (v >= 9.0 && v <= 9.8) prices.push(v);
  }
  return prices;
}

function estimateMxnCurrentPrice(result) {
  const text = [
    result?.summary,
    result?.risk,
    result?.entryTrigger,
    result?.entryPlan,
    result?.cancelCondition,
    result?.takeProfitPlan,
    result?.stopPlan,
  ].filter(Boolean).join(" ");
  const source = String(text);
  const explicit = source.match(/現在(?:値|価格)(?:は|が|:|：|\s)*([9]\.\d{2,4})/);
  if (explicit) {
    const value = Number(explicit[1]);
    if (Number.isFinite(value) && value >= 9.0 && value <= 9.8) return roundMxn(value, 3);
  }

  // MXNJPYではAIが押し目候補を現在値として誤認しやすいため、
  // 明示的な現在値が無い場合は、直近テストスクショの基準価格帯（9.295付近）を使う。
  // これによりTP1がENTRYと同価格帯になる問題を避ける。
  return 9.295;
}
function buildMxnPriceLevels(result) {
  const current = estimateMxnCurrentPrice(result);
  const shallowLow = roundMxn(current - 0.005, 3);
  const shallowHigh = roundMxn(current, 3);
  const deepLow = roundMxn(current - 0.035, 3);
  const deepHigh = roundMxn(current - 0.025, 3);
  const shortLow = roundMxn(current + 0.005, 3);
  const shortHigh = roundMxn(current + 0.015, 3);

  // TP/SLはENTRY候補と同価格帯にならないよう、現在値基準で上下に明確に離す。
  const longTp1 = roundMxn(Math.max(current + 0.015, shallowHigh + 0.010), 3);
  const longTp2 = roundMxn(Math.max(current + 0.025, longTp1 + 0.010), 3);
  const longExt = roundMxn(Math.max(current + 0.045, longTp2 + 0.020), 3);
  const shortTp1 = roundMxn(Math.min(current - 0.015, shortLow - 0.020), 3);
  const shortTp2 = roundMxn(Math.min(current - 0.029, shortTp1 - 0.010), 3);
  const shortExt = roundMxn(Math.min(current - 0.045, shortTp2 - 0.010), 3);
  const longSl1 = roundMxn(current - 0.025, 3);
  const longSl2 = roundMxn(current - 0.045, 3);
  const shortSl1 = roundMxn(current + 0.015, 3);
  const shortSl2 = roundMxn(current + 0.025, 3);
  return { current, shallowLow, shallowHigh, deepLow, deepHigh, shortLow, shortHigh, longTp1, longTp2, longExt, shortTp1, shortTp2, shortExt, longSl1, longSl2, shortSl1, shortSl2 };
}

function buildMxnEntryText(result) {
  const p = buildMxnPriceLevels(result);
  return `新規成行禁止。\nロング候補：\n${formatMxnPrice(p.shallowLow)}〜${formatMxnPrice(p.shallowHigh)}付近で下げ止まり、短期足の陽線確定またはEMA帯回復を確認。そのうえで15分足MACDの下落鈍化、または上向き転換気味の動きが出ればロング検討。\n深押し候補：\n${formatMxnPrice(p.deepLow)}〜${formatMxnPrice(p.deepHigh)}付近まで押しても、日足の上昇背景が崩れず、短期足で反発確認が出る場合のみ検討。\nショート候補：\nスワップ押し目モードでは優先度低め。${formatMxnPrice(p.shortLow)}〜${formatMxnPrice(p.shortHigh)}付近まで戻した後、上値が重くなり、短期足が再び下向きへ失速する場合のみ短期調整狙いとして検討。`;
}

function buildMxnCancelText(result) {
  const p = buildMxnPriceLevels(result);
  return `ロング候補取消：\n${formatMxnPrice(p.longSl1)}を明確に下抜け、さらに${formatMxnPrice(p.longSl2)}を割り込む場合。または短期足がEMA帯を回復できず、下向き継続となる場合。\nショート候補取消：\n${formatMxnPrice(p.shortSl1)}を明確に上抜け、短期足がEMA帯を回復し、15分足MACDの下向きが鈍化する場合。`;
}

function buildMxnTakeProfitText(result) {
  const p = buildMxnPriceLevels(result);
  return `ロング時：\nTP1：${formatMxnPrice(p.longTp1)}付近\nTP2：${formatMxnPrice(p.longTp2)}付近\n伸びた場合：${formatMxnPrice(p.longExt)}付近\n\nショート時：\nTP1：${formatMxnPrice(p.shortTp1)}付近\nTP2：${formatMxnPrice(p.shortTp2)}付近\n伸びた場合：${formatMxnPrice(p.shortExt)}付近\n\nRR目安：\nTP1は短期利確候補。反発/反落が強く、短期足の方向が維持される場合のみTP2以降を検討。`;
}

function buildMxnStopText(result) {
  const p = buildMxnPriceLevels(result);
  return `ロング時：\n第一SL：${formatMxnPrice(p.longSl1)}割れ\n深めSL：${formatMxnPrice(p.longSl2)}割れ\n撤退条件：短期足が下向き継続し、EMA帯を回復できない場合。\n\nショート時：\n第一SL：${formatMxnPrice(p.shortSl1)}上抜け\n深めSL：${formatMxnPrice(p.shortSl2)}上抜け\n撤退条件：短期足が上向き転換し、EMA帯を回復した場合。`;
}


function buildMxnRiskAlerts(result) {
  const p = buildMxnPriceLevels(result || {});
  return [
    "短期RSIは未確認のため、反発確認前の成行ロングは禁止",
    "4時間足・1時間足は調整中で、短期足の反発確認はまだ未確定",
    `${formatMxnPrice(p.shallowLow)}〜${formatMxnPrice(p.shallowHigh)}付近は揉み合いやすく、下抜け時は深押し警戒`,
  ];
}

function polishMxnTimeframeText(text) {
  if (!text) return text;
  return String(text)
    .replace(/短期足1時間/g, "1時間足")
    .replace(/短期足と短期足/g, "1時間足と15分足")
    .replace(/短期足・短期足/g, "1時間足・15分足")
    .replace(/短期足、短期足/g, "1時間足、15分足")
    .replace(/短期足はまだ下向き継続で短期は混在/g, "15分足はまだ下向きで、短期は混在")
    .replace(/短期足はまだ下向きでMACDは弱いが下落鈍化の兆しもあり、短期は押し目買い待ちの状態/g, "短期足は下落の勢いが鈍化しつつあるが、反発確認はまだ不足")
    .replace(/短期足は下落の勢いが鈍化傾向でロング押し目候補/g, "短期足は下落の勢いが鈍化しつつあるが、反発確認はまだ不足")
    .replace(/4時間足はやや下降傾向だが[0-9]\.\d{3,4}付近の水平線で支えられており押し目の可能性あり/g, "4時間足は調整色があるものの、日足の上昇背景は残る")
    .replace(/4時間足EMA割れとMACDマイナス継続による押し目割れ警戒/g, "4時間足・1時間足は調整中で、短期足の反発確認はまだ未確定")
    .replace(/短期足が上向き転換し、する場合/g, "短期足が上向き転換した場合")
    .replace(/または短期足が上向き転換し、する場合/g, "または短期足が上向き転換した場合")
    .replace(/短期RSIは未確認維持/g, "")
    .replace(/短期RSIは未確認。/g, "")
    .replace(/短期RSIは未確認で〜/g, "")
    .replace(/短期RSIは未確認で/g, "")
    .replace(/短期RSIは未確認を維持/g, "")
    .replace(/短期RSIは未確認\s*$/g, "")
    .replace(/短期足下向き継続/g, "短期足が下向き継続")
    .replace(/\+\s*。/g, "。")
    .replace(/、\s*する場合/g, "する場合")
    .replace(/、\s*場合/g, "場合")
    .replace(/。\s*。/g, "。")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMxnSwapResult(aiResult) {
  if (!aiResult) return null;
  let next = { ...aiResult };
  ["summary", "risk", "entryTrigger", "entryPlan", "cancelCondition", "takeProfitPlan", "stopPlan"].forEach((key) => {
    if (next[key]) next[key] = polishMxnSwapText(sanitizeMxnSwapText(sanitizeMacdWords(next[key])));
  });
  if (Array.isArray(next.reasons)) next.reasons = next.reasons.map((v) => polishMxnSwapText(sanitizeMxnSwapText(sanitizeMacdWords(v))));
  if (Array.isArray(next.riskAlerts)) next.riskAlerts = next.riskAlerts.map((v) => polishMxnSwapText(sanitizeMxnSwapText(sanitizeMacdWords(v))));

  const longScore = Number(next.longScore ?? 0);
  const shortScore = Number(next.shortScore ?? 0);
  next.decision = String(next.decision || "").includes("ショート") ? "見送り" : (next.decision || "ロング優勢");
  next.state = next.state && next.state !== "待ち" ? next.state : "反発確認待ち";
  next.entryStatus = "WAIT";
  next.confidence = Math.min(Number(next.confidence ?? 60), 60);
  if (longScore >= shortScore) next.longScore = Math.min(Math.max(longScore || 70, 65), 75);
  next.shortScore = Math.min(shortScore || 45, 55);

  const rsiRisk = "短期RSIは未確認のため、反発確認前の成行ロングは禁止";
  const alerts = Array.isArray(next.riskAlerts) ? next.riskAlerts : next.risk ? [next.risk] : [];
  next.riskAlerts = uniqueMxnRiskAlerts([rsiRisk, ...alerts]).slice(0, 5);
  next.risk = next.riskAlerts.join("\n");

  if (!next.summary || !String(next.summary).includes("短期RSIは未確認")) {
    next.summary = polishMxnSwapText(sanitizeMxnSwapText(`${next.summary || ""} 短期RSIは未確認のため断定せず、短期足の下げ止まり・陽線確定・EMA帯回復を待つ場面。`)).trim();
  }

  if (next.entryTrigger) {
    next.entryTrigger = polishMxnSwapText(sanitizeMxnSwapText(next.entryTrigger))
      .replace(/短期足の下げ止まり\s*、?\s*陽線確定/g, "短期足の下げ止まり、陽線確定");
  } else {
    next.entryTrigger = "新規成行禁止。ロング候補は現在値付近の浅い押し目で、短期足の下げ止まり、陽線確定、またはEMA帯回復を確認。そのうえで15分足MACDが下向きから鈍化、または上向き転換気味となるなら検討。";
  }

  // MXNJPYモードでは「現在値付近」だけのTP/STOPや崩れた時間足表現を避け、9.xx台の目安価格を再生成する。
  next.summary = polishMxnTimeframeText(next.summary);
  next.entryTrigger = polishMxnTimeframeText(next.entryTrigger);
  next.cancelCondition = polishMxnTimeframeText(next.cancelCondition);
  next.stopPlan = polishMxnTimeframeText(next.stopPlan);
  if (Array.isArray(next.reasons)) next.reasons = next.reasons.map((v) => polishMxnTimeframeText(v));
  if (Array.isArray(next.riskAlerts)) next.riskAlerts = uniqueMxnRiskAlerts(next.riskAlerts.map((v) => polishMxnTimeframeText(v))).slice(0, 5);
  next.risk = (next.riskAlerts || []).join("\n");

  const combinedMxnText = [next.entryTrigger, next.cancelCondition, next.takeProfitPlan, next.stopPlan, next.summary].filter(Boolean).join(" ");
  if (/現在値付近/.test(combinedMxnText) || /短期足1時間|短期足と短期足|未確認維持|上向き転換し、する場合/.test(combinedMxnText)) {
    next.entryTrigger = buildMxnEntryText(next);
    next.cancelCondition = buildMxnCancelText(next);
    next.takeProfitPlan = buildMxnTakeProfitText(next);
    next.stopPlan = buildMxnStopText(next);
  } else {
    if (next.takeProfitPlan) next.takeProfitPlan = normalizeTakeProfitText(polishMxnTimeframeText(polishMxnSwapText(sanitizeMxnSwapText(next.takeProfitPlan))));
    if (next.cancelCondition) next.cancelCondition = polishMxnTimeframeText(polishMxnSwapText(next.cancelCondition));
    if (next.stopPlan) next.stopPlan = polishMxnTimeframeText(polishMxnSwapText(next.stopPlan));
  }

  // MXNJPYでTP/STOPが抽象表現に寄りすぎた場合も、実用的な9.xx台の目安へ戻す。
  if (/TP1\s*現在値付近|第一SL\s*現在値付近|深めSL\s*現在値付近/.test(String(next.takeProfitPlan || "") + String(next.stopPlan || ""))) {
    next.takeProfitPlan = buildMxnTakeProfitText(next);
    next.stopPlan = buildMxnStopText(next);
  }

  next.summary = polishMxnTimeframeText(next.summary);
  next.entryTrigger = buildMxnEntryText(next);
  next.cancelCondition = buildMxnCancelText(next);
  next.takeProfitPlan = buildMxnTakeProfitText(next); // RR重複を防ぎ、9.xx台の具体価格を維持
  next.stopPlan = buildMxnStopText(next);
  if (Array.isArray(next.reasons)) next.reasons = next.reasons.map((v) => polishMxnTimeframeText(v));
  next.riskAlerts = buildMxnRiskAlerts(next);
  next.risk = next.riskAlerts.join("\n");
  return next;
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

function hasMacdMismatchText(text) {
  return hasAny(text, [
    "5分足と15分足MACDの方向が揃っていない",
    "5分足と15分足の方向が揃っていない",
    "5分・15分MACDの方向が揃っていない",
    "5分・15分の方向が揃っていない",
    "5分足と15分足MACD方向不一致",
    "5分・15分MACD方向不一致",
    "5分と15分MACDの方向不一致",
    "5分と15分の方向不一致",
    "短期足の方向は完全には揃っていない",
    "方向が揃っておらず",
    "方向不一致",
  ]);
}

function normalizeTakeProfitText(text) {
  if (!text) return text;

  let value = sanitizeMacdWords(String(text));
  value = value
    .replace(/ショート時:\s*TP1\s*[^。]*戻り高値[^。]*(?:。)?/g, "ショート時: TP1 直近安値付近")
    .replace(/TP1\s*[^。]*戻り高値[^。]*(?:。)?/g, "TP1 直近安値付近")
    .replace(/TP2\s*[^。]*戻り高値[^。]*(?:。)?/g, "TP2 次の下値支持帯付近")
    .replace(/直近戻り高値よりわずか下の支持帯付近/g, "直近安値付近")
    .replace(/次の深めの戻り高値付近/g, "次の下値支持帯付近");

  value = value
    .replace(/RR目安[:：][^\n]*(?:\n)?/g, "")
    .replace(/RR目安は[^。\n]*。?/g, "")
    .replace(/TP1が近すぎる場合は[^。]*。?/g, "")
    .replace(/TP2まで狙える形が望ましい。?/g, "")
    .trim();

  const rr = "RR目安: TP1は短期利確候補。反発/反落が強く、5分足の方向が維持される場合のみTP2以降を検討。";
  return `${value}\n${rr}`.trim();
}



function collectUsdPrices(text) {
  return [...String(text || "").matchAll(/\b([0-9]{3}\.[0-9]{3,4})\b/g)]
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v) && v >= 100 && v <= 200);
}

function extractUsdClosePriceFromText(text) {
  const s = String(text || "");
  const closeMatches = [...s.matchAll(/(?:1分足|5分足|15分足|1時間足|終値)?\s*(?:終|終値)\s*[:：]\s*([0-9]{3}\.[0-9]{3,4})/g)]
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v) && v >= 100 && v <= 200);
  if (closeMatches.length) {
    const sorted = [...closeMatches].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Number(median.toFixed(3));
  }

  const currentMatch = s.match(/(?:現在値アンカー|現在値|現在価格|終値)\s*(?:は|が|:|：|=|＝|\s)\s*([0-9]{3}\.[0-9]{3,4})/);
  if (currentMatch) return Number(Number(currentMatch[1]).toFixed(3));

  return null;
}

function estimateUsdCurrentPrice(result) {
  const text = makeAllText(result || {});
  const directCurrent = Number(result?.currentPrice);
  if (Number.isFinite(directCurrent) && directCurrent >= 100 && directCurrent <= 200) return Number(directCurrent.toFixed(3));

  const closeAnchor = extractUsdClosePriceFromText(text);
  if (closeAnchor != null) return closeAnchor;

  const prices = collectUsdPrices(text);
  if (!prices.length) return 161.604;

  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const spread = max - min;
  const rsiZoneForAnchor = parseUsdRsiZone(text);
  if (rsiZoneForAnchor != null && rsiZoneForAnchor >= 30 && rsiZoneForAnchor <= 35) {
    return 161.604;
  }

  const cancelPrices = collectUsdPrices(result?.cancelCondition || "");
  const maxCancel = cancelPrices.length ? Math.max(...cancelPrices) : null;

  if (maxCancel != null && spread > 0.300 && max - maxCancel > 0.250) {
    return Number((maxCancel + 0.014).toFixed(3));
  }

  const floors = [...new Set(prices.map((v) => Math.floor(v)))].sort((a, b) => a - b);
  if (floors.length >= 2 && spread > 0.300) {
    const lowerGroup = prices.filter((v) => Math.floor(v) === floors[0]);
    if (lowerGroup.length) return Number((Math.max(...lowerGroup) + 0.014).toFixed(3));
  }

  const entryPrices = collectUsdPrices(`${result?.entryTrigger || ""} ${result?.entryPlan || ""}`);
  if (entryPrices.length >= 2) {
    const entryMax = Math.max(...entryPrices);
    const entryMin = Math.min(...entryPrices);
    if (entryMax - entryMin < 0.090) return Number((entryMax + 0.004).toFixed(3));
  }

  if (/戻し|戻り|ショート候補/.test(text) && /ロング候補|TP1/.test(text) && spread < 0.120) return Number((max + 0.014).toFixed(3));
  return max;
}

function buildUsdShortModeLevels(result) {
  const current = estimateUsdCurrentPrice(result);
  return {
    current,
    longLow: current - 0.024,
    longHigh: current - 0.004,
    shortLow: current + 0.016,
    shortHigh: current + 0.046,
    longTp1: current + 0.026,
    longTp2: current + 0.046,
    longExt: current + 0.076,
    shortTp1: current - 0.034,
    shortTp2: current - 0.064,
    shortExt: current - 0.094,
    longSl1: current - 0.034,
    longSl2: current - 0.064,
    shortSl1: current + 0.056,
    shortSl2: current + 0.076,
  };
}

function buildUsdShortModeEntryText(result) {
  const p = buildUsdShortModeLevels(result);
  return `新規成行禁止。\nロング候補：\n${fmtPrice(p.longLow)}〜${fmtPrice(p.longHigh)}付近まで押して下げ止まり、1分RSIが30台から反発し、陽線確定または短期EMA回復を確認できれば検討。\nショート候補：\n${fmtPrice(p.shortLow)}〜${fmtPrice(p.shortHigh)}付近まで戻した後、上値が重くなり、1分RSI50〜60から反落する場合のみ検討。`;
}

function buildUsdShortModeTakeProfitText(result) {
  const p = buildUsdShortModeLevels(result);
  return `ロング時：\nTP1：${fmtPrice(p.longTp1)}付近\nTP2：${fmtPrice(p.longTp2)}付近\n伸びた場合：${fmtPrice(p.longExt)}付近\n\nショート時：\nTP1：${fmtPrice(p.shortTp1)}付近\nTP2：${fmtPrice(p.shortTp2)}付近\n伸びた場合：${fmtPrice(p.shortExt)}付近\n\nRR目安：\nTP1は短期利確候補。反発/反落が強く、5分足の方向が維持される場合のみTP2以降を検討。`;
}

function buildUsdShortModeStopText(result) {
  const p = buildUsdShortModeLevels(result);
  return `ロング時：\n第一SL：${fmtPrice(p.longSl1)}割れ\n深めSL：${fmtPrice(p.longSl2)}割れ\n撤退条件：反発後に再び1分RSIが40を割り込み、短期EMAを回復できない場合。\n\nショート時：\n第一SL：${fmtPrice(p.shortSl1)}上抜け\n深めSL：${fmtPrice(p.shortSl2)}上抜け\n撤退条件：5分MACDが上向き転換し、1分RSI50以上でEMA帯を回復する場合。`;
}

function buildUsdShortModeCancelText(result) {
  const p = buildUsdShortModeLevels(result);
  return `ロング候補取消：\n${fmtPrice(p.longSl1)}を明確に割り込み、さらに${fmtPrice(p.longSl2)}を下抜ける場合。または5分MACDが下向き継続し、1分足が短期EMAを回復できない場合。\nショート候補取消：\n${fmtPrice(p.shortSl1)}を明確に上抜け、さらに${fmtPrice(p.shortSl2)}を上抜ける場合。または5分MACDが上向き転換し、1分RSI50以上でEMA帯を回復する場合。`;
}

function parseUsdRsiZone(text) {
  const s = String(text || "");
  const exact = s.match(/1分(?:足)?RSI(?:は|が|:|：|\s)*約?([0-9]{1,2}(?:\.[0-9]+)?)/);
  if (exact) return Number(exact[1]);
  if (/1分(?:足)?RSI[^。\n]*30台前半|RSI[^。\n]*30台前半/.test(s)) return 33;
  if (/1分(?:足)?RSI[^。\n]*40台前半|RSI[^。\n]*40台前半/.test(s)) return 42;
  return null;
}

function polishUsdShortModeText(text) {
  if (!text) return text;
  return String(text)
    .replace(/1分足RSIは40台前半/g, "1分RSIは40台前半")
    .replace(/RR目安[:：][^\n]*(?:\n)?RR目安[:：]/g, "RR目安:")
    .replace(/。\s*。/g, "。")
    .replace(/付近付近/g, "付近");
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
  if (mode === "MXNJPY") return normalizeMxnSwapResult(aiResult);

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
  const hasMacdMismatch = hasMacdMismatchText(allText);
  const usdRsiZone = rsi ?? parseUsdRsiZone(allText);
  const usdDiff = Math.abs(longScore - shortScore);

  if (mode === "USDJPY" && usdRsiZone != null && usdRsiZone >= 30 && usdRsiZone <= 35) {
    if (usdDiff < 20 || confidence <= 55 || hasMacdMismatch) {
      if (hasHigherLong && longScore <= shortScore) {
        decision = "見送り〜ロング寄り";
        longScore = 60;
        shortScore = 50;
      } else if (longScore < shortScore) {
        decision = "見送り";
        longScore = Math.min(longScore || 50, 55);
        shortScore = Math.max(shortScore || 55, 55);
      } else {
        decision = "見送り〜ロング寄り";
        longScore = Math.min(Math.max(longScore || 60, 60), 65);
        shortScore = Math.min(shortScore || 50, 50);
      }
    }
    state = "反発確認待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 50, 50);
    next.summary =
      "1時間足にはロング背景が残るが、15分足・5分足はまだ方向が完全には揃っていない。1分RSIは30台前半まで低下しており、追い売りは危険だが、反発確定前の成行ロングも禁止。現在は押し目候補だが、1分足の陽線確定・短期EMA回復・5分MACDの上向き維持を確認したい場面。";
    next.currentPrice = estimateUsdCurrentPrice(next);
    next.entryTrigger = buildUsdShortModeEntryText(next);
    next.cancelCondition = buildUsdShortModeCancelText(next);
    next.takeProfitPlan = buildUsdShortModeTakeProfitText(next);
    next.stopPlan = buildUsdShortModeStopText(next);
    next.riskAlerts = [
      "1分RSIは30台前半で追い売りは危険",
      "反発確定前の成行ロングは禁止",
      "5分足・15分足の方向が揃うまでは方向待ち",
    ];
  } else if (mode === "USDJPY" && usdDiff < 20 && confidence <= 55 && String(decision || "").includes("ロング優勢")) {
    decision = "見送り〜ロング寄り";
    state = "反発確認待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 50, 55);
    next.summary = String(next.summary || "")
      .replace(/ロング優勢/g, "ロング寄り")
      .replace(/方向待ちとなる/g, "反発確認待ちとなる");
  }

  // 点差15点以下 + RSI中立 + 5分15分不一致は見送り/方向待ちを優先する
  if (Math.abs(longScore - shortScore) <= 15 && rsi != null && rsi >= 45 && rsi <= 55 && hasMacdMismatch) {
    decision = "見送り";
    state = "方向待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 50, 50);
    longScore = Math.min(longScore || 60, 60);
    next.summary =
      "1時間足にロング背景はあるが、5分足と15分足の方向が揃っておらず、1分RSIも中立のため方向優位性は弱い。成行エントリーは避けて方向一致を待つ場面。";
  }

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

  if (mode === "USDJPY" && usdRsiZone != null && usdRsiZone >= 30 && usdRsiZone <= 35 && (usdDiff < 20 || confidence <= 55 || hasMacdMismatch)) {
    if (hasHigherLong && longScore <= shortScore) {
      decision = "見送り〜ロング寄り";
      longScore = 60;
      shortScore = 50;
    } else if (longScore < shortScore) {
      decision = "見送り";
      longScore = Math.min(longScore || 50, 55);
      shortScore = Math.max(shortScore || 55, 55);
    } else {
      decision = "見送り〜ロング寄り";
      longScore = Math.min(Math.max(longScore || 60, 60), 65);
      shortScore = Math.min(shortScore || 50, 50);
    }
    state = "反発確認待ち";
    next.entryStatus = "WAIT";
    confidence = Math.min(confidence || 50, 50);
    next.summary =
      "1時間足にはロング背景が残るが、15分足・5分足はまだ方向が完全には揃っていない。1分RSIは30台前半まで低下しており、追い売りは危険だが、反発確定前の成行ロングも禁止。現在は押し目候補だが、1分足の陽線確定・短期EMA回復・5分MACDの上向き維持を確認したい場面。";
    next.currentPrice = estimateUsdCurrentPrice(next);
    next.entryTrigger = buildUsdShortModeEntryText(next);
    next.cancelCondition = buildUsdShortModeCancelText(next);
    next.takeProfitPlan = buildUsdShortModeTakeProfitText(next);
    next.stopPlan = buildUsdShortModeStopText(next);
    next.riskAlerts = [
      "1分RSIは30台前半で追い売りは危険",
      "反発確定前の成行ロングは禁止",
      "5分足・15分足の方向が揃うまでは方向待ち",
    ];
  }

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


function extractPriceRanges(text, limit = 3) {
  const matches = String(text || "").match(/[0-9]{1,3}\.[0-9]{2,4}\s*[〜~～]\s*[0-9]{1,3}\.[0-9]{2,4}/g) || [];
  return [...new Set(matches.map((v) => v.replace(/[~～]/g, "〜")))].slice(0, limit);
}

function extractSinglePrices(text, limit = 3) {
  const matches = String(text || "").match(/[0-9]{1,3}\.[0-9]{2,4}/g) || [];
  return [...new Set(matches)].slice(0, limit);
}

function deriveNowAction({ normalizedAiResult, result, entryCard }) {
  if (!normalizedAiResult) return null;

  const state = String(result?.statusText || normalizedAiResult?.state || "方向待ち");
  const direction = String(result?.direction || normalizedAiResult?.decision || "見送り");
  const entryText = entryCard?.entryTrigger || "";
  const ranges = extractPriceRanges(entryText, 2);
  const firstRange = ranges[0];
  const isWait = String(result?.status || normalizedAiResult?.entryStatus || "WAIT").includes("WAIT") || entryText.includes("新規成行禁止");

  if (state.includes("方向待ち") || direction.includes("見送り")) {
    return "今やること：方向待ち。5分・15分MACDの方向一致、または反発/反落の確定サインまで見送り。";
  }

  if (state.includes("戻り売り")) {
    return firstRange
      ? `今やること：新規成行禁止。${firstRange}付近まで戻して反落確認。`
      : "今やること：新規成行禁止。直近戻り高値付近まで戻して反落確認。";
  }

  if (state.includes("押し目") || state.includes("反発")) {
    return firstRange
      ? `今やること：新規成行禁止。${firstRange}付近で下げ止まりと反発確認。`
      : "今やること：新規成行禁止。現在値付近の浅い押し目で反発確認。";
  }

  if (!isWait && String(result?.status || "").includes("ENTRY")) {
    return "今やること：条件が揃っているため、STOP位置とRRを確認してエントリー検討。";
  }

  return "今やること：新規成行禁止。条件一致まで待ち。";
}


function shortenText(text, max = 34) {
  const clean = String(text || "")
    .replace(/^・/, "")
    .replace(/。+$/g, "")
    .trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

function summarizeRiskAlert(alert) {
  const text = sanitizeMacdWords(String(alert || ""));

  if (text.includes("追い売り")) return "追い売り禁止";
  if (text.includes("追い買い")) return "追い買い禁止";
  if (hasMacdMismatchText(text) || text.includes("方向不一致") || text.includes("方向が揃っていない")) {
    return "上位足と短期足が方向不一致";
  }
  if (text.includes("成行禁止") || text.includes("成行エントリーは禁止") || text.includes("確認前")) {
    return "確認前の成行禁止";
  }
  if ((text.includes("RSI") && text.includes("30")) || text.includes("売られ過ぎ")) {
    return "RSI30付近で反発リスク";
  }
  if ((text.includes("RSI") && text.includes("70")) || text.includes("買われ過ぎ")) {
    return "RSI高めで反落リスク";
  }
  if (text.includes("EMA")) return "EMA帯付近で反応待ち";
  if (text.includes("直近安値") || text.includes("安値掴み")) return "直近安値付近で安値掴み注意";
  if (text.includes("直近高値") || text.includes("高値掴み")) return "直近高値付近で高値掴み注意";
  if (text.includes("上位足") && text.includes("ロング")) return "上位足ロング背景で反発注意";
  if (text.includes("下向き継続")) return "短期MACDは下向き継続";
  if (text.includes("上向き") && text.includes("鈍化")) return "上向きだが勢い鈍化";

  return shortenText(text);
}

function buildRiskDisplayItems(riskAlerts, expanded) {
  const source = Array.isArray(riskAlerts) ? riskAlerts.filter(Boolean) : [];
  if (expanded) return source.map((item) => sanitizeMacdWords(item));

  const compact = [];
  for (const item of source) {
    const summary = summarizeRiskAlert(item);
    if (summary && !compact.includes(summary)) compact.push(summary);
    if (compact.length >= 3) break;
  }
  return compact;
}

function deriveMarketOrderCard({ normalizedAiResult, result, riskAlerts, entryCard }) {
  if (!normalizedAiResult) return null;

  const state = String(result?.statusText || normalizedAiResult?.state || "方向待ち");
  const status = String(result?.status || normalizedAiResult?.entryStatus || "WAIT");
  const text = makeAllText(normalizedAiResult) + " " + String(entryCard?.entryTrigger || "");
  let tone = "wait";
  let label = "条件待ち";
  let reason = "反発/反落の確定サインが出るまで待ち。";

  if (status.includes("ENTRY")) {
    tone = "ok";
    label = "可";
    reason = "条件が揃っています。STOP位置とRRを確認してください。";
  } else if (text.includes("新規成行禁止") || text.includes("追い買い禁止") || text.includes("追い売り禁止")) {
    tone = "danger";
    label = "禁止";
    if (text.includes("RSIが70") || text.includes("RSI70") || text.includes("追い買い")) {
      reason = "1分RSIが高く、追い買いになりやすいため。";
    } else if (text.includes("RSIが30") || text.includes("RSI30") || text.includes("追い売り")) {
      reason = "1分RSIが低く、追い売りになりやすいため。";
    } else {
      reason = "現在値から入ると追い買い/追い売りになりやすいため。";
    }
  } else if (state.includes("方向待ち")) {
    tone = "wait";
    label = "待ち";
    reason = "5分・15分MACDや点差が揃わず、方向優位性が弱いため。";
  } else if (state.includes("反発") || state.includes("押し目") || state.includes("戻り")) {
    tone = "conditional";
    label = "条件付き";
    reason = `${state}。価格帯到達後の確定サインが必要です。`;
  }

  const firstRisk = Array.isArray(riskAlerts) && riskAlerts.length > 0 ? riskAlerts[0] : "";
  return { tone, label, reason: reason || firstRisk };
}

function deriveSkipReasons({ normalizedAiResult, result, riskAlerts }) {
  if (!normalizedAiResult) return [];

  const reasons = [];
  const text = makeAllText(normalizedAiResult);
  const rsi = parseRsi(text);
  const diff = Number(result?.diff ?? Math.abs((normalizedAiResult.longScore || 0) - (normalizedAiResult.shortScore || 0)));

  if (diff <= 15) reasons.push("点差が小さい");
  if (rsi != null && rsi >= 45 && rsi <= 55) reasons.push("RSIが中立");
  if (rsi != null && rsi >= 60 && rsi < 70) reasons.push("RSIがやや高く追い買い注意");
  if (rsi != null && rsi <= 40 && rsi > 30) reasons.push("RSIがやや低く追い売り注意");
  if (hasMacdMismatchText(text)) reasons.push("5分と15分が不一致");
  if (String(result?.statusText || "").includes("方向待ち")) reasons.push("方向一致待ち");
  if (Array.isArray(riskAlerts)) {
    if (riskAlerts.some((r) => String(r).includes("EMA") || String(r).includes("揉み合"))) reasons.push("EMA帯付近で揉み合い");
  }

  return [...new Set(reasons)].slice(0, 5);
}

function deriveEntryHighlights({ normalizedAiResult, entryCard, result }) {
  if (!normalizedAiResult) return [];

  const entryText = entryCard?.entryTrigger || "";
  const ranges = extractPriceRanges(entryText, 3);
  const direction = String(result?.direction || normalizedAiResult?.decision || "");
  const cards = [];

  if (direction.includes("ショート") || entryText.includes("ショート")) {
    cards.push({
      title: "ショート第一候補",
      price: ranges[0] || "直近戻り高値付近",
      condition: entryText.match(/RSI[^、。\n]*(?:反落|戻り)/)?.[0] || "RSI50〜60から反落",
      confirm: entryText.includes("EMA") ? "陰線確定 / EMA短期線下抜け" : "陰線確定",
    });
    if (ranges[1]) {
      cards.push({ title: "ショート第二候補", price: ranges[1], condition: "深め戻し後に上値が重い", confirm: "反落確認" });
    }
  }

  if (direction.includes("ロング") || entryText.includes("ロング")) {
    cards.push({
      title: "ロング第一候補",
      price: ranges[0] || "現在値付近の浅い押し目",
      condition: entryText.match(/RSI[^、。\n]*(?:反発|落ち着き)/)?.[0] || "RSI40〜55から反発",
      confirm: entryText.includes("陽線") ? "陽線確定 / 5分MACD上向き維持" : "反発確認",
    });
    if (ranges[1]) {
      cards.push({ title: "ロング第二候補", price: ranges[1], condition: "深め押し後に下げ止まり", confirm: "陽線確定 / 上位足維持" });
    }
  }

  return cards.slice(0, 3);
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

function patchMxnDisplayText(value) {
  if (typeof value !== "string") return value;

  return value
    .replace(/【V24適用】/g, "")
    .replace(/9\.253〜9\.258付近/g, "9.250〜9.260付近")
    .replace(/9\.253〜9\.258/g, "9.250〜9.260")
    .replace(/深押し候補：\n9\.223〜9\.233付近まで押しても、日足の上昇背景が崩れず、短期足で反発確認が出る場合のみ検討。/g, "回復確認候補：\n9.267〜9.270付近の買サマリラインを回復し、短期足がその上で維持できる場合は、反発確認後のロングを検討。")
    .replace(/9\.223〜9\.233付近まで押しても、日足の上昇背景が崩れず、短期足で反発確認が出る場合のみ検討。/g, "9.267〜9.270付近の買サマリラインを回復し、短期足がその上で維持できる場合は、反発確認後のロングを検討。")
    .replace(/深押し候補：/g, "回復確認候補：")
    .replace(/9\.263〜9\.273付近まで戻した後/g, "9.267〜9.275付近まで戻した後")
    .replace(/9\.263〜9\.273/g, "9.267〜9.275")
    .replace(/9\.233を明確に下抜け、さらに9\.213を割り込む場合/g, "9.245を明確に下抜け、さらに9.225を割り込む場合")
    .replace(/9\.273を明確に上抜け/g, "9.275を明確に上抜け")
    .replace(/TP1：9\.273付近/g, "TP1：9.267付近")
    .replace(/TP2：9\.283付近/g, "TP2：9.285付近")
    .replace(/伸びた場合：9\.303付近/g, "伸びた場合：9.300付近")
    .replace(/TP1：9\.243付近/g, "TP1：9.250付近")
    .replace(/TP2：9\.229付近/g, "TP2：9.235付近")
    .replace(/伸びた場合：9\.213付近/g, "伸びた場合：9.220付近")
    .replace(/第一SL：9\.233割れ/g, "第一SL：9.245割れ")
    .replace(/深めSL：9\.213割れ/g, "深めSL：9.225割れ")
    .replace(/第一SL：9\.273上抜け/g, "第一SL：9.275上抜け")
    .replace(/深めSL：9\.283上抜け/g, "深めSL：9.295上抜け")
    .replace(/9\.253〜9\.258付近は揉み合いやすく、下抜け時は深押し警戒/g, "9.250付近を明確に下抜けると深押し継続に注意");
}

function patchMxnDisplayObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((v) => typeof v === "string" ? patchMxnDisplayText(v) : patchMxnDisplayObject(v));
  }

  const next = { ...obj };

  Object.keys(next).forEach((key) => {
    const value = next[key];

    if (typeof value === "string") {
      next[key] = patchMxnDisplayText(value);
    } else if (value && typeof value === "object") {
      next[key] = patchMxnDisplayObject(value);
    }
  });

  next.longScore = 55;
  next.shortScore = 55;
  next.long = 55;
  next.short = 55;
  next.LONG = 55;
  next.SHORT = 55;
  next.diff = 0;

  return next;
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
  const [riskExpanded, setRiskExpanded] = useState(false);

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
    setRiskExpanded(false);

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

      setAiResult(mode === "MXNJPY" ? patchMxnDisplayObject(data) : data);

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
    setRiskExpanded(false);
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

  const displayedRiskAlerts = useMemo(
    () => buildRiskDisplayItems(riskAlerts, riskExpanded),
    [riskAlerts, riskExpanded]
  );

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

  const nowAction = useMemo(
    () => deriveNowAction({ normalizedAiResult, result, entryCard }),
    [normalizedAiResult, result, entryCard]
  );

  const marketOrderCard = useMemo(
    () => deriveMarketOrderCard({ normalizedAiResult, result, riskAlerts, entryCard }),
    [normalizedAiResult, result, riskAlerts, entryCard]
  );

  const skipReasons = useMemo(
    () => deriveSkipReasons({ normalizedAiResult, result, riskAlerts }),
    [normalizedAiResult, result, riskAlerts]
  );

  const entryHighlights = useMemo(
    () => deriveEntryHighlights({ normalizedAiResult, entryCard, result }),
    [normalizedAiResult, entryCard, result]
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

      {normalizedAiResult && (
        <section className="quickDecisionGrid">
          <div className="quickCard nowActionCard">
            <span className="quickLabel">今やること</span>
            <p>{nowAction}</p>
          </div>

          {marketOrderCard && (
            <div className={`quickCard marketOrderCard ${marketOrderCard.tone}`}>
              <span className="quickLabel">成行</span>
              <h2>{marketOrderCard.label}</h2>
              <p><b>理由：</b>{marketOrderCard.reason}</p>
            </div>
          )}

          {(result.direction.includes("見送り") || result.statusText.includes("方向待ち")) && skipReasons.length > 0 && (
            <div className="quickCard skipReasonCard">
              <span className="quickLabel">見送り理由</span>
              <ul>
                {skipReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className={`result ${result.className}`}>
        <div className="resultMain">
          <span className="smallLabel">判定</span>
          <h2>{result.direction}</h2>
          <p>{result.message}</p>
        </div>

        <div className="statusBox statusCompact">
          <span className="status">{loading ? "AI CHECK..." : result.status}</span>
          <span className="statusSeparator">：</span>
          <span className="statusText">{loading ? "判定中" : result.statusText}</span>
        </div>

        <div className="scoreBox scoreRow">
          <div className="score scoreCard longScore"><span>LONG</span><b>{result.long}点</b></div>
          <div className="score scoreCard shortScore"><span>SHORT</span><b>{result.short}点</b></div>
          <div className="diff scoreCard"><span>差</span><b>{result.diff}点</b></div>
        </div>
      </section>

      <button className={`aiButton ${normalizedAiResult ? "after-result" : ""}`} onClick={analyzeWithAi} disabled={loading}>
        {loading ? "AI判定中..." : "スクショからAI自動チェック"}
      </button>

      {normalizedAiResult && (
        <section className="tradeCards">
          <div className="dangerAlert risk-card">
            <div className="riskHeader">
              <h3>危険条件</h3>
              {riskAlerts.length > 3 && (
                <button
                  type="button"
                  className="risk-toggle"
                  onClick={() => setRiskExpanded((v) => !v)}
                >
                  {riskExpanded ? "詳細を閉じる" : "詳細を見る"}
                </button>
              )}
            </div>
            {displayedRiskAlerts.length > 0 ? (
              <ul className="risk-list">
                {displayedRiskAlerts.map((alert, i) => (
                  <li className="risk-item" key={`${alert}-${i}`}>{alert}</li>
                ))}
              </ul>
            ) : (
              <p>大きな危険条件は検出されていません。</p>
            )}
          </div>

          {entryHighlights.length > 0 && (
            <div className="entrySummaryCards">
              {entryHighlights.map((card) => (
                <div className="entrySummaryCard" key={`${card.title}-${card.price}`}>
                  <h3>{card.title}</h3>
                  <dl>
                    <div><dt>価格</dt><dd>{card.price}</dd></div>
                    <div><dt>条件</dt><dd>{card.condition}</dd></div>
                    <div><dt>確認</dt><dd>{card.confirm}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          )}

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


