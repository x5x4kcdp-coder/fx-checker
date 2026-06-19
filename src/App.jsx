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

function App() {
  const [mode, setMode] = useState("USDJPY");
  const currentMode = MODES[mode];

  const [images, setImages] = useState([null, null, null, null]);
  const [files, setFiles] = useState([null, null, null, null]);
  const [answers, setAnswers] = useState({});
  const [memo, setMemo] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const result = useMemo(() => {
    if (aiResult) {
      const long = Number(aiResult.longScore ?? 0);
      const short = Number(aiResult.shortScore ?? 0);
      const diff = Math.abs(long - short);
      const max = Math.max(long, short);

      let direction = "見送り";
      let status = "WAIT";
      let statusText = "待ち";
      let className = "wait";
      let message = aiResult.summary || "AI判定結果";

      if (long >= 75 && long - short >= 20) {
        direction = mode === "MXNJPY" ? "押し目ロング候補" : "ロング優勢";
        status = "ENTRY OK";
        statusText = mode === "MXNJPY" ? "分割候補" : "エントリー可";
        className = "long";
      } else if (short >= 75 && short - long >= 20) {
        direction = mode === "MXNJPY" ? "長期ロング注意" : "ショート優勢";
        status = "ENTRY OK";
        statusText = mode === "MXNJPY" ? "買い待ち" : "エントリー可";
        className = "short";
      } else if (diff < 10 || max < 60) {
        direction = "見送り";
        status = "WAIT";
        statusText = "待ち";
        className = "wait";
      } else if (long >= 60 && short < 60) {
        direction = mode === "MXNJPY" ? "押し目待ち" : "ロング寄り";
        status = "WAIT";
        statusText = mode === "MXNJPY" ? "反発待ち" : "押し目待ち";
        className = "long";
      } else if (short >= 60 && long < 60) {
        direction = mode === "MXNJPY" ? "買いは慎重" : "ショート寄り";
        status = "WAIT";
        statusText = mode === "MXNJPY" ? "下げ止まり待ち" : "戻り売り待ち";
        className = "short";
      }

      return {
        long,
        short,
        diff,
        direction,
        status,
        statusText,
        message,
        className,
      };
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
    let statusText = "待ち";
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
      direction = "ややロング";
    } else if (short > long) {
      direction = "ややショート";
    }

    return { long, short, diff, direction, status, statusText, message, className };
  }, [answers, aiResult, mode]);

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

      setMemo(
        `モード: ${currentMode.name}
AI判定: ${data.decision}
ステータス: ${data.entryStatus}
LONG: ${data.longScore}点 / SHORT: ${data.shortScore}点
信頼度: ${data.confidence}

理由:
${(data.reasons || []).map((r) => `・${r}`).join("\n")}

注意:
${data.risk || ""}

エントリー:
${data.entryPlan || ""}

利確:
${data.takeProfitPlan || ""}

撤退:
${data.stopPlan || ""}`
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

      {aiResult && (
        <section className="aiDetail">
          <h3>AIの理由</h3>
          <ul>
            {(aiResult.reasons || []).map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <p><b>注意:</b> {aiResult.risk}</p>
          <p><b>エントリー:</b> {aiResult.entryPlan}</p>
          <p><b>利確:</b> {aiResult.takeProfitPlan}</p>
          <p><b>撤退:</b> {aiResult.stopPlan}</p>
        </section>
      )}

      <section className="checks">
        {checks.map((check) => (
          <div className="check" key={check.id}>
            <h3>{check.title}</h3>
            <div className="options">
              {check.options.map((option) => (
                <label
                  key={option.label}
                  className={`${answers[check.id] === option.label ? "selected" : ""} ${option.side}`}
                >
                  <input
                    type="radio"
                    name={check.id}
                    checked={answers[check.id] === option.label}
                    onChange={() => {
                      setAiResult(null);
                      setAnswers({ ...answers, [check.id]: option.label });
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

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


