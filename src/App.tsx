import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, File, X } from "lucide-react";
import rawLevels from "./data/levels.json";
import { playableLevels, resolvePlayableId } from "./lib/catalog.mjs";
import { STORAGE_KEY, levelFromHash, normalizeProgress, readProgress, validateAnswer } from "./lib/progress.mjs";
import type { Level, Progress, Resource } from "./types";
import FlashPlayer from "./FlashPlayer";

const levels = playableLevels(rawLevels as Level[]);
type UpdateProgress = (fn: (progress: Progress) => Progress) => void;
type Tab = "puzzle" | "hint" | "notes";
const tabs = [
  { id: "puzzle", label: "题目" },
  { id: "hint", label: "查看提示" },
  { id: "notes", label: "笔记" },
] as const;

function ResourceLink({ resource }: { resource: Resource }) {
  const size = resource.size < 1024 ? `${resource.size} B` : `${(resource.size / 1024).toFixed(1)} KB`;
  return (
    <a className="attachment" href={resource.path} download={resource.name}>
      <File size={18} aria-hidden="true" />
      <span className="attachment-name">{resource.name}</span>
      <span className="attachment-size">{size}</span>
      <Download size={16} aria-hidden="true" />
      <span className="sr-only">下载附件</span>
    </a>
  );
}

function HintConfirmation({ displayNumber, onCancel, onConfirm }: {
  displayNumber: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    cancelButton.current?.focus();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} className="hint-dialog" aria-labelledby="hint-heading" aria-describedby="hint-description"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="dialog-content">
        <button className="dialog-close" aria-label="关闭" onClick={onCancel}><X size={18} /></button>
        <h2 id="hint-heading">查看第 {displayNumber} 关的提示？</h2>
        <p id="hint-description">提示会透露解题思路。</p>
        <div className="dialog-actions">
          <button ref={cancelButton} className="button" onClick={onCancel}>继续自己想</button>
          <button className="button primary" onClick={onConfirm}>确认查看</button>
        </div>
      </div>
    </dialog>
  );
}

function Challenge({ level, displayNumber, progress, update }: {
  level: Level;
  displayNumber: number;
  progress: Progress;
  update: UpdateProgress;
}) {
  const [tab, setTab] = useState<Tab>("puzzle");
  const [hintConfirmed, setHintConfirmed] = useState(false);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const [answer, setAnswer] = useState(progress.answers[level.id] || "");
  const [username, setUsername] = useState(progress.username);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const promptHtml = level.promptHtml.replaceAll(
    `alt="第 ${level.id} 关原始图片线索"`,
    `alt="第 ${displayNumber} 关图片线索"`,
  );
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const wasConfirmingHint = useRef(false);
  useEffect(() => {
    if (wasConfirmingHint.current && !confirmingHint) tabRefs.current.hint?.focus();
    wasConfirmingHint.current = confirmingHint;
  }, [confirmingHint]);

  function selectTab(next: Tab) {
    if (next === "hint" && !hintConfirmed) setConfirmingHint(true);
    else setTab(next);
  }

  function moveTabFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current[tabs[next].id]?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    try {
      const result = await validateAnswer(level, answer, progress.username);
      if (result === "empty") {
        setFeedback({ type: "error", text: "请输入答案。" });
        return;
      }
      update((previous) => ({
        ...previous,
        answers: { ...previous.answers, [level.id]: answer },
        completed: result === "correct" ? { ...previous.completed, [level.id]: "verified" } : previous.completed,
      }));
      setFeedback(result === "correct"
        ? { type: "success", text: "答案正确。" }
        : { type: "error", text: "答案不对，请再试试。" });
    } catch {
      setFeedback({ type: "error", text: "暂时无法验证，请刷新后重试。" });
    } finally {
      setChecking(false);
    }
  }

  function saveUsername() {
    const value = username.trim() || progress.username;
    setUsername(value);
    if (value === progress.username) return;
    setFeedback(null);
    update((previous) => {
      const completed = { ...previous.completed };
      delete completed[9];
      return { ...previous, username: value, completed };
    });
  }

  return (
    <>
      <div className="challenge-heading">
        <h1>第 {displayNumber} 关</h1>
        {progress.completed[level.id] === "verified" && <span className="solved"><Check size={15} />已解答</span>}
      </div>
      <div className="tabs" role="tablist" aria-label="关卡内容">
        {tabs.map(({ id, label }, index) => (
          <button key={id} ref={(element) => { tabRefs.current[id] = element; }}
            role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1} onKeyDown={(event) => moveTabFocus(event, index)}
            onClick={() => selectTab(id)}>{label}</button>
        ))}
      </div>
      <section className="tab-panel" id="panel-puzzle" role="tabpanel" aria-labelledby="tab-puzzle" hidden={tab !== "puzzle"}>
        <div className="original-content" dangerouslySetInnerHTML={{ __html: promptHtml }} />
        {level.puzzlePath && (
          <a className="button puzzle-link" href={level.puzzlePath}>
            打开题目页<ArrowRight size={16} aria-hidden="true" />
          </a>
        )}
        {level.validation === "username" && (
          <div className="username-field">
            <label htmlFor="username">本地用户名</label>
            <input id="username" value={username} maxLength={40} autoComplete="off" onChange={(event) => setUsername(event.target.value)}
              onBlur={saveUsername} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </div>
        )}
        {level.resources.filter((resource) => resource.extension === "swf").map((resource) => <FlashPlayer key={resource.path} url={resource.path} />)}
        {level.resources.length > 0 && (
          <div className="attachments">
            <h2>附件</h2>
            {level.resources.map((resource) => <ResourceLink key={resource.path} resource={resource} />)}
          </div>
        )}
      </section>
      <section className="tab-panel" id="panel-hint" role="tabpanel" aria-labelledby="tab-hint" hidden={tab !== "hint"}>
        {hintConfirmed && <p className="hint-text">{level.hint}</p>}
      </section>
      <section className="tab-panel" id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" hidden={tab !== "notes"}>
        <label className="sr-only" htmlFor="notes">第 {displayNumber} 关笔记</label>
        <textarea id="notes" className="notes" placeholder="记下思路…" maxLength={20000} value={progress.notes[level.id] || ""}
          onChange={(event) => update((previous) => ({ ...previous, notes: { ...previous.notes, [level.id]: event.target.value } }))} />
        <p className="save-caption">自动保存</p>
      </section>
      <form className="answer-form" onSubmit={submit}>
        <label htmlFor="answer">答案</label>
        <div className="answer-row">
          <input id="answer" placeholder="输入过关密码" autoComplete="off" spellCheck={false} value={answer}
            onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} aria-describedby={feedback ? "answer-feedback" : undefined} />
          <button type="submit" className="button primary" disabled={checking}>{checking ? "验证中…" : "提交"}<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="feedback-space" aria-live="polite">
          {feedback && <p id="answer-feedback" className={`feedback ${feedback.type}`}>{feedback.text}</p>}
        </div>
      </form>
      {confirmingHint && <HintConfirmation displayNumber={displayNumber}
        onCancel={() => setConfirmingHint(false)}
        onConfirm={() => { setHintConfirmed(true); setTab("hint"); setConfirmingHint(false); }} />}
    </>
  );
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => {
    try { return readProgress(localStorage); }
    catch { return normalizeProgress(null); }
  });
  const [requested, setRequested] = useState(() => resolvePlayableId(levelFromHash(location.hash, progress.lastLevel), levels));
  const current = resolvePlayableId(requested, levels);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const index = levels.findIndex((level) => level.id === current);
  const displayNumber = index + 1;
  const level = levels[index];
  const previous = levels[index - 1];
  const next = levels[index + 1];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [progress]);

  useEffect(() => {
    const onHashChange = () => {
      const id = resolvePlayableId(levelFromHash(location.hash), levels);
      if (location.hash !== `#/level/${id}`) history.replaceState(null, "", `#/level/${id}`);
      setRequested(id);
      setDirectoryOpen(false);
    };
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const hash = `#/level/${current}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    setProgress((previous) => previous.lastLevel === current ? previous : { ...previous, lastLevel: current });
    document.title = `第 ${displayNumber} 关 · 路路解密`;
  }, [current, displayNumber]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#challenge" onClick={(event) => { event.preventDefault(); document.getElementById("challenge")?.focus(); }}>跳到题目</a>
      <header className="topbar">
        <a className="brand" href="#/level/1">路路解密<span className="brand-dot" aria-hidden="true" /></a>
        <span className="edition">第一部 · 技术</span>
      </header>
      <div className="layout">
        <aside className={`directory ${directoryOpen ? "is-open" : ""}`}>
          <h2 className="directory-title">关卡</h2>
          <button className="directory-toggle" aria-expanded={directoryOpen} aria-controls="level-directory" onClick={() => setDirectoryOpen(!directoryOpen)}>
            <span>关卡<span className="mobile-current">第 {displayNumber} 关</span></span><ChevronDown size={17} />
          </button>
          <nav id="level-directory" className="number-grid" aria-label="选择关卡">
            {levels.map((item, position) => {
              const completed = progress.completed[item.id] === "verified";
              const label = `第 ${position + 1} 关${completed ? "，已解答" : ""}`;
              return (
                <a key={item.id} href={`#/level/${item.id}`} aria-label={label} title={label}
                  aria-current={item.id === current ? "page" : undefined} onClick={() => setDirectoryOpen(false)}>
                  {completed ? <span className="completed-check" aria-hidden="true">✅</span> : position + 1}
                </a>
              );
            })}
          </nav>
        </aside>
        <main id="challenge" tabIndex={-1}>
          <Challenge key={level.id} level={level} displayNumber={displayNumber} progress={progress} update={setProgress} />
          <nav className="level-pagination" aria-label="相邻关卡">
            {previous ? <a href={`#/level/${previous.id}`}><ArrowLeft size={15} aria-hidden="true" />上一关</a> : <span />}
            {next ? <a href={`#/level/${next.id}`}>下一关<ArrowRight size={15} aria-hidden="true" /></a> : <span />}
          </nav>
          {storageError && <p className="storage-error" role="alert">浏览器存储不可用，本次答案和笔记无法保存。</p>}
        </main>
      </div>
    </div>
  );
}
