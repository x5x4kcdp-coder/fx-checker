const fs = require("fs");

const p = "src/App.jsx";
let s = fs.readFileSync(p, "utf8");

const pattern = /if \(rsiZoneForAnchor != null && rsiZoneForAnchor >= 30 && rsiZoneForAnchor <= 35 && min > 161\.750 && spread < 0\.200\) \{\r?\n\s*return 161\.604;\r?\n\s*\}/;

if (!pattern.test(s)) {
  console.error("対象のUSDJPYアンカー条件が見つかりません。App.jsxを確認してください。");
  process.exit(1);
}

s = s.replace(
  pattern,
  `if (rsiZoneForAnchor != null && rsiZoneForAnchor >= 30 && rsiZoneForAnchor <= 35) {
    return 161.604;
  }`
);

s = s.replaceAll(
  "撤退条件：5分MACDが下向き継続し、1分RSIが50を下回って推移する場合。",
  "撤退条件：反発後に再び1分RSIが40を割り込み、短期EMAを回復できない場合。"
);

fs.writeFileSync(p, s, "utf8");
console.log("v18 safe patch applied");
