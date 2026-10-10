"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CloudOff, LockKeyhole, Loader2, PartyPopper } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { deviceQueue, loadSnapshot, saveSnapshot } from "@/lib/tes/idb";
import { backoff, enqueue, flush, type QueuedResponse, type SendResult } from "@/lib/tes/queue";
import { countComplete, EMPTY_ANSWER, firstIncomplete, isComplete, visibleTiers, type Answer, type TierField } from "@/lib/tes/session";
import type { AttemptPayload, Phase } from "@/lib/tes/types";

type Load =
  | { kind: "loading" }
  | { kind: "blocked"; reason: "closed" | "consent" | "learn_only" | "forbidden" | "network" | "unknown" }
  | { kind: "ready"; payload: AttemptPayload; offlineCopy: boolean };

type Sync = "saved" | "saving" | "waiting";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
/** Jam dipanggil hanya dari penangan kejadian (bukan saat render). */
const clock = () => Date.now();
const SNAP_KEY = (phase: string) => `arssmed:tes:percobaan:${phase}`;

/**
 * Mesin tes siswa (FR-31…FR-36): satu butir per layar, tier tampil bertahap, simpan otomatis
 * tiap tier ke antrean perangkat lalu ke server, bisa kembali ke butir sebelumnya, layar penutup netral.
 */
export function TestRunner({ phase }: { phase: Phase }) {
  const t = useTranslations("tes");
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [sync, setSync] = useState<Sync>("saved");
  const [submitState, setSubmitState] = useState<"idle" | "pending" | "waiting" | "done">("idle");
  const [missing, setMissing] = useState<number[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownAt = useRef(0);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);

  // ---------------------------------------------------------------- muat

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let res: Response | null = null;
      try {
        res = await fetch(`/api/tes/${phase}/mulai`, { cache: "no-store" });
      } catch {
        res = null;
      }
      if (cancelled) return;
      const body = res?.ok ? ((await res.json()) as AttemptPayload | { blocked: string }) : null;
      if (body && "blocked" in body) {
        const reason = (["closed", "consent", "learn_only", "forbidden"] as const).find((r) => r === body.blocked) ?? "unknown";
        setLoad({ kind: "blocked", reason });
        return;
      }
      if (body) {
        const payload = body;
        try {
          sessionStorage.setItem(SNAP_KEY(phase), payload.attemptId);
        } catch {
          // abaikan
        }
        if (!payload.submitted) void saveSnapshot(payload.attemptId, payload);
        await startWith(payload, false);
        return;
      }
      if (res) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const reason = (["closed", "consent", "learn_only", "forbidden"] as const).find((r) => r === body.error) ?? "unknown";
        setLoad({ kind: "blocked", reason });
        return;
      }
      // Luring: lanjutkan dari salinan di perangkat bila ada.
      let attemptId: string | null = null;
      try {
        attemptId = sessionStorage.getItem(SNAP_KEY(phase));
      } catch {
        attemptId = null;
      }
      const snap = attemptId ? await loadSnapshot(attemptId, phase) : null;
      if (snap) await startWith(snap, true);
      else setLoad({ kind: "blocked", reason: "network" });
    })();
    async function startWith(payload: AttemptPayload, offlineCopy: boolean) {
      // Jawaban di antrean perangkat lebih baru daripada yang ada di server.
      const queued = (await deviceQueue.getAll()).filter((q) => q.attemptId === payload.attemptId);
      const merged = { ...payload.answers };
      for (const q of queued) merged[q.itemId] = q.answer;
      if (cancelled) return;
      setAnswers(merged);
      setIndex(firstIncomplete(payload.items, merged) ?? Math.max(0, payload.items.length - 1));
      setReview(payload.items.length > 0 && firstIncomplete(payload.items, merged) === null);
      setSubmitState(payload.submitted ? "done" : "idle");
      shownAt.current = clock();
      setLoad({ kind: "ready", payload, offlineCopy });
      if (queued.length) setSync("waiting");
    }
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // ---------------------------------------------------------------- sinkron

  const send = useCallback(async (r: QueuedResponse): Promise<SendResult> => {
    try {
      const res = await fetch(`/api/tes/attempt/${r.attemptId}/respons`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: r.itemId,
          answer: r.answer,
          clientTs: new Date(r.clientTs).toISOString(),
          responseTimeMs: r.responseTimeMs,
          optionOrder: r.optionOrder,
        }),
      });
      if (res.ok) return "ok";
      if (res.status >= 500 || res.status === 401 || res.status === 429) return "retry";
      return "drop";
    } catch {
      return "retry";
    }
  }, []);

  const runFlush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      setSync("saving");
      const r = await flush(deviceQueue, send);
      if (r.dropped.length) setNotice(t("runner.closedWhileWorking"));
      if (r.remaining > 0) {
        setSync("waiting");
        timer.current = setTimeout(() => void runFlush(), backoff(retries.current++));
      } else {
        retries.current = 0;
        setSync("saved");
      }
    } finally {
      flushing.current = false;
    }
  }, [send, t]);

  useEffect(() => {
    const on = () => {
      retries.current = 0;
      void runFlush();
    };
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("online", on);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [runFlush]);

  // Muat pertama dengan antrean tersisa → coba kirim.
  const ready = load.kind === "ready";
  useEffect(() => {
    if (ready) void runFlush();
  }, [ready, runFlush]);

  // ---------------------------------------------------------------- jawab

  const payload = load.kind === "ready" ? load.payload : null;
  const items = useMemo(() => payload?.items ?? [], [payload]);
  const item = items[index];
  const answer = (item && answers[item.id]) || EMPTY_ANSWER;

  function setTier(field: TierField, value: string | number) {
    if (!item || !payload) return;
    // Mengubah tier awal tidak menghapus tier berikutnya: siswa tetap bisa memperbaiki satu bagian saja.
    const next: Answer = { ...answer, [field]: value };
    setAnswers((a) => ({ ...a, [item.id]: next }));
    void enqueue(deviceQueue, {
      attemptId: payload.attemptId,
      itemId: item.id,
      answer: next,
      clientTs: clock(),
      responseTimeMs: shownAt.current ? clock() - shownAt.current : null,
      optionOrder: { tier1: item.tier1.map((o) => o.key), reason: item.reason.map((o) => o.key) },
    }).then(() => runFlush());
  }

  const goTo = useCallback((i: number) => {
    setReview(false);
    setIndex(i);
    shownAt.current = clock();
    setMissing(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      heading.current?.focus({ preventScroll: true });
    });
  }, []);

  // ---------------------------------------------------------------- selesai

  const submit = useCallback(async () => {
    if (!payload) return;
    setSubmitState("pending");
    await runFlush();
    if ((await deviceQueue.getAll()).some((q) => q.attemptId === payload.attemptId)) {
      setSubmitState("waiting");
      return;
    }
    try {
      const res = await fetch(`/api/tes/attempt/${payload.attemptId}/selesai`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; missing?: number[]; error?: string };
      if (res.ok && body.ok) {
        setSubmitState("done");
        return;
      }
      if (res.status === 422 && body.missing) {
        setMissing(body.missing);
        setSubmitState("idle");
        return;
      }
      if (body.error === "submitted") {
        setSubmitState("done");
        return;
      }
      if (body.error === "closed") setNotice(t("runner.closedWhileWorking"));
      setSubmitState(res.status >= 500 || res.status === 429 ? "waiting" : "idle");
    } catch {
      setSubmitState("waiting");
    }
  }, [payload, runFlush, t]);

  // Menunggu internet untuk mengirim → coba lagi saat tersambung.
  useEffect(() => {
    if (submitState !== "waiting") return;
    const again = () => void submit();
    window.addEventListener("online", again);
    const id = setInterval(again, 15_000);
    return () => {
      window.removeEventListener("online", again);
      clearInterval(id);
    };
  }, [submitState, submit]);

  // ---------------------------------------------------------------- tampilan

  if (load.kind === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-tinta-2">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        {t("runner.loading")}
      </p>
    );
  }
  if (load.kind === "blocked") {
    return (
      <EmptyState
        icon={load.reason === "network" ? <CloudOff className="size-7" /> : <LockKeyhole className="size-7" />}
        title={t(`blocked.${load.reason}.title`)}
        body={t(`blocked.${load.reason}.body`)}
        action={
          load.reason === "forbidden" ? (
            <LinkButton href="/masuk">{t("signIn")}</LinkButton>
          ) : (
            <LinkButton href="/belajar" variant="kedua">
              {t("toLearn")}
            </LinkButton>
          )
        }
      />
    );
  }
  if (submitState === "done") {
    // FR-36: layar penutup netral, tanpa hasil.
    return (
      <section className="flex flex-col items-start gap-4 rounded-panel border border-garis bg-permukaan p-6" aria-labelledby="tes-selesai" data-testid="test-done">
        <span className="flex size-14 items-center justify-center rounded-full bg-kertas" aria-hidden="true">
          <PartyPopper className="size-7" />
        </span>
        <h2 id="tes-selesai" className="text-[1.6rem] font-bold" tabIndex={-1}>
          {t("done.title")}
        </h2>
        <p className="max-w-[60ch] text-tinta-2">{t("done.body")}</p>
        <LinkButton href="/belajar">{t("toLearn")}</LinkButton>
      </section>
    );
  }

  const total = items.length;
  const doneCount = countComplete(items, answers);
  const syncBadge = (
    <p
      role="status"
      data-testid="sync-status"
      data-sync={sync}
      className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-tinta-2"
    >
      {sync === "waiting" ? <CloudOff aria-hidden="true" className="size-4 text-e" /> : sync === "saving" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
      {t(`sync.${sync}`)}
    </p>
  );

  if (review || !item) {
    return (
      <section aria-labelledby="periksa-judul" className="flex flex-col gap-5" data-testid="test-review">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="periksa-judul" ref={heading} tabIndex={-1} className="text-[1.5rem] font-bold outline-none">
            {t("review.title")}
          </h2>
          {syncBadge}
        </div>
        <p className="text-tinta-2">{t("review.lead", { done: doneCount, total })}</p>
        <ol className="grid grid-cols-5 gap-2 sm:grid-cols-10" aria-label={t("review.grid")}>
          {items.map((it, i) => {
            const ok = isComplete(it.format, answers[it.id]);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={`tekan flex min-h-12 w-full items-center justify-center rounded-kontrol border-2 font-semibold tabular-nums ${ok ? "border-sc bg-permukaan" : "border-m bg-permukaan text-m-teks"}`}
                  aria-label={t(ok ? "review.itemDone" : "review.itemTodo", { n: it.order })}
                >
                  {it.order}
                </button>
              </li>
            );
          })}
        </ol>
        {missing && missing.length ? (
          <p role="alert" className="font-semibold text-m-teks">
            {t("review.missing", { list: missing.join(", ") })}
          </p>
        ) : null}
        {notice ? (
          <p role="alert" className="font-semibold text-m-teks">
            {notice}
          </p>
        ) : null}
        {submitState === "waiting" ? (
          <p role="status" className="flex items-center gap-2 rounded-kontrol border border-garis bg-permukaan p-3">
            <CloudOff aria-hidden="true" className="size-5 shrink-0 text-e" />
            {t("review.waiting")}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={submit} disabled={doneCount < total || submitState !== "idle"} aria-busy={submitState === "pending"}>
            {submitState === "pending" ? t("review.submitting") : t("review.submit")}
          </Button>
          <Button variant="kedua" onClick={() => goTo(firstIncomplete(items, answers) ?? total - 1)} icon={<ArrowLeft aria-hidden="true" className="size-5" />}>
            {t("review.back")}
          </Button>
        </div>
        {doneCount < total ? <p className="text-[0.9rem] text-tinta-2">{t("review.needAll")}</p> : null}
      </section>
    );
  }

  const visible = visibleTiers(item.format, answer);
  const complete = isComplete(item.format, answer);
  const tierBlock = (field: TierField) => {
    const isConf = field === "confidenceA" || field === "confidenceR";
    const opts = field === "tier1" ? item.tier1 : field === "reason" ? item.reason : item.levels.map((l, i) => ({ key: String(i), text: l }));
    const current = answer[field];
    const legend = t(`tiers.${field}${item.format === "modified_tier2" && field === "confidenceR" ? "Only" : ""}`);
    return (
      <fieldset key={field} className="flex flex-col gap-2" data-testid={`tier-${field}`}>
        <legend className="mb-2 font-semibold">{legend}</legend>
        <div className={isConf ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
          {opts.map((o, i) => {
            const value = isConf ? Number(o.key) : o.key;
            const checked = current === value;
            return (
              <label
                key={o.key}
                className="tekan flex min-h-14 cursor-pointer items-center gap-3 rounded-kontrol border-2 border-garis bg-permukaan px-4 py-3 has-[:checked]:border-laut has-[:checked]:bg-kertas has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-laut"
              >
                <input type="radio" name={`${item.id}-${field}`} checked={checked} onChange={() => setTier(field, value)} className="sr-only" />
                {!isConf ? (
                  <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-bold ${checked ? "border-laut bg-laut text-white" : "border-garis"}`}>
                    {LETTERS[i]}
                  </span>
                ) : null}
                <span className={isConf ? "w-full text-center font-semibold" : ""}>
                  {!isConf ? <span className="sr-only">{LETTERS[i]}. </span> : null}
                  {o.text}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <section aria-labelledby="soal-judul" className="flex flex-col gap-5" data-testid="test-item" data-item-order={item.order}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold tabular-nums">{t("runner.progress", { n: index + 1, total })}</p>
          {syncBadge}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-garis" aria-hidden="true">
          <div className="h-full rounded-full bg-matahari" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        {load.offlineCopy ? <p className="text-[0.85rem] text-tinta-2">{t("runner.offlineCopy")}</p> : null}
      </div>
      {notice ? (
        <p role="alert" className="font-semibold text-m-teks">
          {notice}
        </p>
      ) : null}

      <h2 id="soal-judul" ref={heading} tabIndex={-1} className="text-[1.35rem] leading-snug font-bold outline-none">
        <span className="sr-only">{t("runner.progress", { n: index + 1, total })}. </span>
        {item.stem}
      </h2>

      <div className="flex flex-col gap-6">{visible.map(tierBlock)}</div>

      <div className="flex gap-2">
        <Button variant="kedua" block={false} onClick={() => goTo(index - 1)} disabled={index === 0} icon={<ArrowLeft aria-hidden="true" className="size-5" />}>
          {t("runner.prev")}
        </Button>
        <Button
          className="flex-1"
          onClick={() => (index === total - 1 ? (setReview(true), setMissing(null), requestAnimationFrame(() => heading.current?.focus())) : goTo(index + 1))}
          disabled={!complete}
          icon={<ArrowRight aria-hidden="true" className="size-5" />}
        >
          {index === total - 1 ? t("runner.toReview") : t("runner.next")}
        </Button>
      </div>
      {!complete ? <p className="text-[0.9rem] text-tinta-2">{t("runner.answerAll")}</p> : null}
      <p className="text-[0.85rem] text-tinta-2">
        <Link href="/tes" className="text-laut-teks underline">
          {t("runner.pause")}
        </Link>
      </p>
    </section>
  );
}
