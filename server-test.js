import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("AI server OK");
});

app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "ping ok" });
});

app.listen(8787, "0.0.0.0", () => {
  console.log("AI server running: http://0.0.0.0:8787");
});
