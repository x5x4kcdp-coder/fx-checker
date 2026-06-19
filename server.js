import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function fileToDataUrl(file) {
  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
}

function buildPrompt(mode, pair) {
  const isMxn = mode === "MXNJPY";

  if (isMxn) {
    return `
あなたはFXチャートの条件整理AIです。
これは投資助言ではなく、チャート画像から押し目状態を採点する補助ツールです。

モード: MXNJPYスワップ押し目モード
通貨ペア: ${pair}

画像の役割:
1枚目: 日足 MACD
2枚目: 4時間足 MACD
3枚目: 1時間足 MACD
4枚目: 15分足 MACD

目的:
スワップ狙いの長期ロングを、押し目で入れるか確認する。
短期スキャルではない。
ショート推奨ではなく、ロングを待つべきか、押し目候補か、危険かを判定する。

判定ルール:
- 日足が上昇基調ならロング加点
- 4時間足が上昇基調、または上昇トレンド中の押し目ならロング加点
- 1時間足で下げ止まりの兆候があればロング加点
- 15分足MACDが青縮小、または赤転換ならエントリータイミング加点
- 日足や4時間足でEMA割れ、安値更新、MACD強い青ならロング減点
- 15分足だけ反発しても、上位足が崩れていたらENTRY_OKにしない
- スワップ狙いなのでENTRY_OKは厳しめにする
- 分割ロング候補、押し目待ち、下げ止まり待ち、危険のどれかを明確にする

採点ルール:
- longScore と shortScore は必ず 0〜100 の整数で返す
- longScore は「スワップ狙いロングの有利度」
- shortScore は「今ロングする危険度」
- 0〜20点: 根拠ほぼなし
- 21〜40点: 弱い
- 41〜60点: 中立〜やや優勢
- 61〜80点: 優勢
- 81〜100点: 強く優勢
- 点数差が10点未満なら decision は WAIT
- longScore が75点以上かつ shortScore より20点以上高いときだけ ENTRY_OK
- shortScore が高い場合でも、基本はショート推奨ではなく「ロング見送り/危険」と表現する

必ずJSONだけで返してください。コードブロックは禁止。

追加ルール:
- riskAlerts は危険条件を0〜4個の配列で返す
- entryTrigger はエントリーしてよい条件を具体的に書く
- cancelCondition はその方向の見送り条件・取消条件を書く
- takeProfitPlan は利確目安を書く
- stopPlan は損切り/撤退目安を書く

重要な方向一致ルール:
- decision が LONG の場合、entryTrigger は必ずロング条件を書く
- decision が SHORT の場合、entryTrigger は必ずショート条件を書く
- decision が WAIT の場合、無理にロング条件やショート条件を書かない
- decision が WAIT かつ longScore と shortScore が近い場合、entryTrigger には「何が揃うまで待つか」を書く
- decision が WAIT でも shortScore が longScore より明確に高い場合、entryTrigger は「ショート検討に変わる条件」を書く
- decision が WAIT でも longScore が shortScore より明確に高い場合、entryTrigger は「ロング検討に変わる条件」を書く
- 危険条件とentryTriggerの方向を矛盾させない
- 例: riskAlertsで「5分足と15分足MACDが下降傾向」と書いた場合、entryTriggerでロング条件を優先して書かない
- 例: 上位足ロング、短期足ショートで混在している場合は「見送り。上位足と短期足の方向一致待ち」と書く
- 例: ショート寄りWAITなら「戻り売り条件」を書き、ロング条件はcancelCondition側に書く
- 例: ロング寄りWAITなら「押し目買い条件」を書き、ショート条件はcancelCondition側に書く

WAIT時の書き方:
- entryTrigger は「今すぐ入る条件」ではなく「次にエントリー候補になる条件」を書く
- cancelCondition は「その候補が消える条件」を書く
- direction が混在している場合、entryTrigger は「方向一致まで待ち」とする

形式:
{
  "decision": "LONG" | "SHORT" | "WAIT",
  "entryStatus": "ENTRY_OK" | "WAIT" | "NO_ENTRY",
  "longScore": 0,
  "shortScore": 0,
  "confidence": 0,
  "summary": "短い総合コメント",
  "reasons": ["理由1", "理由2", "理由3"],
  "risk": "注意点",
  "entryPlan": "押し目ロングなら何を待つか",
  "takeProfitPlan": "長期保有/分割利確/スワップ目線の管理",
  "riskAlerts": ["危険条件1", "危険条件2"],
  "entryTrigger": "エントリーしてよい条件",
  "cancelCondition": "この条件なら見送り",
  "stopPlan": "撤退・見送りライン"
}
`;
  }

  return `
あなたはFXスキャル用のエントリーチェック補助AIです。
これは投資助言ではなく、チャート画像から条件を整理する補助ツールです。

モード: USDJPY短期モード
通貨ペア: ${pair}

画像の役割:
1枚目: 1分足 RSI
2枚目: 5分足 MACD
3枚目: 15分足 MACD
4枚目: 1時間足 MACD

判定ルール:
- 1時間足が上昇基調ならロング加点、下降基調ならショート加点
- 15分足MACDが赤/上向きならロング加点、青/下向きならショート加点
- 5分足MACDが赤/上向きならロング加点、青/下向きならショート加点
- 1分足RSIが30以下から反発ならロングタイミング
- 1分足RSIが70以上から反落ならショートタイミング
- RSIだけで逆張りしない。上位足とMACDが逆ならWAIT
- 点数差が小さい、方向が混ざる、価格が中途半端ならWAIT
- 追いかけエントリーは避ける

採点ルール:
- longScore と shortScore は必ず 0〜100 の整数で返す
- 0〜20点: 根拠ほぼなし
- 21〜40点: 弱い
- 41〜60点: 中立〜やや優勢
- 61〜80点: 優勢
- 81〜100点: 強く優勢
- 根拠の個数ではなく、方向の強さを100点満点で評価する
- 点数差が10点未満なら decision は WAIT
- どちらも60点未満なら decision は WAIT
- ENTRY_OK は点数差20点以上かつ優勢側が75点以上のときだけ

必ずJSONだけで返してください。コードブロックは禁止。

追加ルール:
- riskAlerts は危険条件を0〜4個の配列で返す
- entryTrigger はエントリーしてよい条件を具体的に書く
- cancelCondition はその方向の見送り条件・取消条件を書く
- takeProfitPlan は利確目安を書く
- stopPlan は損切り/撤退目安を書く

重要な方向一致ルール:
- decision が LONG の場合、entryTrigger は必ずロング条件を書く
- decision が SHORT の場合、entryTrigger は必ずショート条件を書く
- decision が WAIT の場合、無理にロング条件やショート条件を書かない
- decision が WAIT かつ longScore と shortScore が近い場合、entryTrigger には「何が揃うまで待つか」を書く
- decision が WAIT でも shortScore が longScore より明確に高い場合、entryTrigger は「ショート検討に変わる条件」を書く
- decision が WAIT でも longScore が shortScore より明確に高い場合、entryTrigger は「ロング検討に変わる条件」を書く
- 危険条件とentryTriggerの方向を矛盾させない
- 例: riskAlertsで「5分足と15分足MACDが下降傾向」と書いた場合、entryTriggerでロング条件を優先して書かない
- 例: 上位足ロング、短期足ショートで混在している場合は「見送り。上位足と短期足の方向一致待ち」と書く
- 例: ショート寄りWAITなら「戻り売り条件」を書き、ロング条件はcancelCondition側に書く
- 例: ロング寄りWAITなら「押し目買い条件」を書き、ショート条件はcancelCondition側に書く

WAIT時の書き方:
- entryTrigger は「今すぐ入る条件」ではなく「次にエントリー候補になる条件」を書く
- cancelCondition は「その候補が消える条件」を書く
- direction が混在している場合、entryTrigger は「方向一致まで待ち」とする

形式:
{
  "decision": "LONG" | "SHORT" | "WAIT",
  "entryStatus": "ENTRY_OK" | "WAIT" | "NO_ENTRY",
  "longScore": 0,
  "shortScore": 0,
  "confidence": 0,
  "summary": "短い総合コメント",
  "reasons": ["理由1", "理由2", "理由3"],
  "risk": "注意点",
  "entryPlan": "入るならどこを待つか",
  "takeProfitPlan": "利確の目安",
  "riskAlerts": ["危険条件1", "危険条件2"],
  "entryTrigger": "エントリーしてよい条件",
  "cancelCondition": "この条件なら見送り",
  "stopPlan": "損切り/撤退の目安"
}
`;
}

app.post(
  "/api/analyze",
  upload.fields([
    { name: "slot1", maxCount: 1 },
    { name: "slot2", maxCount: 1 },
    { name: "slot3", maxCount: 1 },
    { name: "slot4", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};

      const slot1 = files.slot1?.[0];
      const slot2 = files.slot2?.[0];
      const slot3 = files.slot3?.[0];
      const slot4 = files.slot4?.[0];

      const mode = req.body.mode || "USDJPY";
      const pair = req.body.pair || "USDJPY";

      if (!slot1 || !slot2 || !slot3 || !slot4) {
        return res.status(400).json({
          error: "4枚すべてのスクショを入れてください。",
        });
      }

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: buildPrompt(mode, pair) },
              { type: "input_image", image_url: fileToDataUrl(slot1) },
              { type: "input_image", image_url: fileToDataUrl(slot2) },
              { type: "input_image", image_url: fileToDataUrl(slot3) },
              { type: "input_image", image_url: fileToDataUrl(slot4) },
            ],
          },
        ],
      });

      const text = response.output_text || "{}";
      const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch {
        result = {
          decision: "WAIT",
          entryStatus: "WAIT",
          longScore: 0,
          shortScore: 0,
          confidence: 0,
          summary: "AIの返答をJSONとして読み取れませんでした。",
          reasons: [text],
          risk: "再度スクショを入れ直してください。",
          entryPlan: "見送り",
          takeProfitPlan: "なし",
          stopPlan: "なし",
        };
      }

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "AI判定でエラーが出ました。",
        detail: error.message,
      });
    }
  }
);

app.use(express.static("dist"));

app.use((req, res, next) => {
  if (req.method === "GET") {
    return res.sendFile("index.html", { root: "dist" });
  }
  next();
});

const PORT = process.env.PORT || 8787;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI server running: http://0.0.0.0:${PORT}`);
});



