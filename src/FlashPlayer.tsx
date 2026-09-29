import { useEffect, useRef, useState } from "react";
import { Play, LoaderCircle, RotateCcw } from "lucide-react";

type RuffleElement = HTMLElement & {
  ruffle: () => {
    load: (options: {
      url: string;
      autoplay: string;
      backgroundColor: string;
    }) => Promise<void>;
  };
};
declare global {
  interface Window {
    RufflePlayer?: { newest: () => { createPlayer: () => RuffleElement } };
  }
}
let rufflePromise: Promise<void> | undefined;
function loadRuffle() {
  if (window.RufflePlayer?.newest) return Promise.resolve();
  if (!rufflePromise)
    rufflePromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/ruffle/ruffle.js";
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        rufflePromise = undefined;
        reject(new Error("播放器加载失败"));
      };
      document.head.append(script);
    });
  return rufflePromise;
}

export default function FlashPlayer({ url }: { url: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  useEffect(() => {
    if (!attempt) return;
    let cancelled = false;
    let player: RuffleElement | undefined;
    setStatus("loading");
    (async () => {
      try {
        await loadRuffle();
        if (cancelled) return;
        player = window.RufflePlayer!.newest().createPlayer();
        player.style.width = "100%";
        player.style.height = "340px";
        host.current?.replaceChildren(player);
        await player
          .ruffle()
          .load({ url, autoplay: "on", backgroundColor: "#ffffff" });
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      player?.remove();
    };
  }, [url, attempt]);
  return (
    <div className="flash-wrap">
      <div ref={host} hidden={status !== "ready"} />
      {status === "idle" && (
        <button className="button primary" onClick={() => setAttempt(1)}>
          <Play size={16} />
          启动 Flash 关卡
        </button>
      )}
      {status === "loading" && (
        <p className="muted">
          <LoaderCircle className="spin" size={18} /> 正在加载本地播放器…
        </p>
      )}
      {status === "error" && (
        <div>
          <p>播放器未能加载。你仍可下载下方的原始 SWF 文件。</p>
          <button className="button" onClick={() => setAttempt(attempt + 1)}>
            <RotateCcw size={15} />
            重新加载
          </button>
        </div>
      )}
    </div>
  );
}
