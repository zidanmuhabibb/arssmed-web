/**
 * Ilustrasi sederhana per langkah Panduan (FR-03). SVG sebaris: ringan, tajam, ikut mode gelap
 * (warna dari token). Dekoratif bagi pembaca layar kecuali diberi label.
 */
export type GuideKind = "masuk" | "belajar" | "tigaD" | "titik" | "ar" | "kamera";

const S = { ink: "var(--tinta)", ink2: "var(--tinta-2)", line: "var(--garis)", paper: "var(--permukaan)", sun: "var(--matahari)", sea: "var(--laut)", stage: "var(--panggung)", earth: "var(--planet-bumi)", mars: "var(--planet-mars)" };

function Planet({ cx, cy, r, fill = S.earth }: { cx: number; cy: number; r: number; fill?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.45} fill="#fff" opacity="0.18" />
    </g>
  );
}

export function GuideIllustration({ kind, label }: { kind: GuideKind; label: string }) {
  return (
    <svg viewBox="0 0 120 88" role="img" aria-label={label} className="h-auto w-full max-w-[9rem] shrink-0">
      <rect x="1" y="1" width="118" height="86" rx="14" fill={kind === "tigaD" || kind === "titik" || kind === "ar" ? S.stage : "var(--kertas)"} />
      {kind === "masuk" ? (
        <g>
          <rect x="18" y="16" width="84" height="56" rx="8" fill={S.paper} stroke={S.line} strokeWidth="2" />
          <rect x="26" y="25" width="36" height="6" rx="3" fill={S.sun} />
          {[38, 49, 60].map((y, i) => (
            <g key={y}>
              <rect x="26" y={y} width="22" height="5" rx="2.5" fill={S.ink2} opacity="0.6" />
              <rect x="54" y={y - 1} width={i === 2 ? 26 : 38} height="7" rx="3.5" fill={S.sea} opacity="0.85" />
            </g>
          ))}
        </g>
      ) : null}
      {kind === "belajar" ? (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx={20 + i * 27} cy="44" r="11" fill={i < 2 ? S.sun : S.paper} stroke={i < 2 ? "none" : S.line} strokeWidth="2" />
              <text x={20 + i * 27} y="49" textAnchor="middle" fontSize="13" fontWeight="800" fill={S.ink}>
                {i + 1}
              </text>
              {i < 3 ? <rect x={32 + i * 27} y="43" width="4" height="2" fill={S.ink2} /> : null}
            </g>
          ))}
        </g>
      ) : null}
      {kind === "tigaD" ? (
        <g>
          <Planet cx={52} cy={42} r={22} />
          <path d="M28 70 q24 12 48 0" stroke={S.sun} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M72 66 l6 4 -7 3" stroke={S.sun} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="92" cy="58" r="7" fill="#fff" opacity="0.9" />
          <rect x="88" y="62" width="8" height="18" rx="4" fill="#fff" opacity="0.9" />
        </g>
      ) : null}
      {kind === "titik" ? (
        <g>
          <Planet cx={58} cy={44} r={26} fill={S.mars} />
          {[
            [48, 34, 1],
            [70, 52, 2],
          ].map(([x, y, n]) => (
            <g key={n}>
              <circle cx={x} cy={y} r="8" fill={S.stage} stroke={S.sun} strokeWidth="2.5" />
              <text x={x} y={y! + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
                {n}
              </text>
            </g>
          ))}
        </g>
      ) : null}
      {kind === "ar" ? (
        <g>
          <rect x="14" y="62" width="92" height="10" rx="3" fill="#5b6b7f" />
          <Planet cx={60} cy={46} r={13} fill={S.earth} />
          <rect x="70" y="14" width="30" height="48" rx="6" fill="none" stroke="#fff" strokeWidth="3" />
          <circle cx="85" cy="56" r="2" fill="#fff" />
        </g>
      ) : null}
      {kind === "kamera" ? (
        <g>
          <rect x="30" y="28" width="60" height="40" rx="8" fill={S.ink} />
          <rect x="48" y="22" width="20" height="8" rx="3" fill={S.ink} />
          <circle cx="60" cy="48" r="12" fill={S.paper} />
          <circle cx="60" cy="48" r="6" fill={S.sea} />
          <circle cx="92" cy="26" r="10" fill={S.sun} />
          <path d="M87 26 l4 4 6 -8" stroke={S.ink} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
    </svg>
  );
}
