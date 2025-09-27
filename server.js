import express from "express";
import { exec as ytDlp } from "yt-dlp-exec";
import { spawn } from "child_process";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => res.status(200).send("ok"));

app.get("/transcode/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^[\w-]{8,}$/.test(id)) return res.status(400).send("invalid id");

    const info = await ytDlp(`https://www.youtube.com/watch?v=${id}`, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      preferFreeFormats: true
    });

    const bestAudio = (info.formats || [])
      .filter(f => f.acodec && f.url)
      .sort((a,b) => (b.abr || 0) - (a.abr || 0))[0];

    if (!bestAudio?.url) return res.status(404).send("no audio url");

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    const ff = spawn("ffmpeg", [
      "-hide_banner","-nostats",
      "-i", bestAudio.url,
      "-vn",
      "-acodec", "libmp3lame",
      "-b:a", "192k",
      "-f", "mp3",
      "pipe:1"
    ]);

    ff.stdout.pipe(res);
    ff.stderr.on("data", d => console.log(d.toString()));
    ff.on("close", code => {
      if (code !== 0 && !res.headersSent) res.status(500).end("ffmpeg failed");
    });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).send("error");
  }
});

app.listen(PORT, () => console.log("listening on", PORT));
