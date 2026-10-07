import type { PlanetKey } from "@/lib/design/tokens";

/**
 * Panggung pembuka Beranda: Matahari dan delapan planet pada satu lengkung orbit.
 * Statis (tanpa gerak non-pemicu — PRD §8.5). Ukuran sengaja tidak proporsional,
 * dan labelnya dinyatakan jelas (PRD §13).
 */
const PLANETS: { key: Exclude<PlanetKey, "matahari">; r: number; ring?: boolean }[] = [
  { key: "merkurius", r: 6.5 },
  { key: "venus", r: 10 },
  { key: "bumi", r: 10.5 },
  { key: "mars", r: 8 },
  { key: "jupiter", r: 21 },
  { key: "saturnus", r: 17, ring: true },
  { key: "uranus", r: 13.5 },
  { key: "neptunus", r: 13 },
];

const X_START = 132;
const X_END = 598;
const Y_BASE = 104;
const LABEL_Y = 166;

function yOnArc(x: number) {
  // Lengkung lembut: titik terendah di tengah rel.
  const t = (x - X_START) / (X_END - X_START);
  return Y_BASE + Math.sin(t * Math.PI) * 14;
}

export function OrbitStage({
  label,
  scaleNote,
  names,
}: {
  label: string;
  scaleNote: string;
  names: Record<PlanetKey, string>;
}) {
  const step = (X_END - X_START) / (PLANETS.length - 1);
  return (
    <figure
      className="relative m-0 overflow-hidden rounded-panel bg-panggung"
      style={{
        backgroundImage:
          "radial-gradient(circle at 0% 55%, rgb(245 166 35 / 0.3) 0, rgb(245 166 35 / 0.08) 30%, transparent 55%)",
      }}
    >
      <svg
        viewBox="0 0 640 186"
        role="img"
        aria-label={`${label}: ${PLANETS.map((p) => names[p.key]).join(", ")}`}
        className="block h-auto w-full overflow-visible"
      >
        <defs>
          {/* Bayangan sisi malam: membuat bulatan terbaca sebagai bola, bukan titik datar */}
          <radialGradient id="bola" cx="0.35" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
        </defs>

        {/* Matahari di tepi kiri */}
                <circle cx="-10" cy={Y_BASE} r="96" fill="var(--planet-matahari)" />
        <circle cx="-10" cy={Y_BASE} r="96" fill="url(#bola)" opacity="0.5" />

        {/* Rel orbit */}
        <path
          d={`M ${X_START - 24} ${yOnArc(X_START)} Q ${(X_START + X_END) / 2} ${Y_BASE + 28} ${X_END + 24} ${yOnArc(X_END)}`}
          fill="none"
          stroke="var(--panggung-tinta-2)"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />

        {PLANETS.map((p, i) => {
          const cx = X_START + step * i;
          const cy = yOnArc(cx);
          return (
            <g key={p.key}>
              {p.ring ? (
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={p.r * 1.9}
                  ry={p.r * 0.55}
                  fill="none"
                  stroke="var(--planet-saturnus)"
                  strokeOpacity="0.8"
                  strokeWidth="2.5"
                  transform={`rotate(-14 ${cx} ${cy})`}
                />
              ) : null}
              <circle cx={cx} cy={cy} r={p.r} fill={`var(--planet-${p.key})`} />
              <circle cx={cx} cy={cy} r={p.r} fill="url(#bola)" />
              <text
                x={cx}
                y={LABEL_Y}
                textAnchor="middle"
                className="max-sm:hidden"
                fill="var(--panggung-tinta)"
                style={{ font: "500 13px 'Lexend Variable', system-ui, sans-serif" }}
              >
                {names[p.key]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="px-4 pb-3 text-right text-[0.75rem] text-panggung-tinta-2 sm:-mt-1">{scaleNote}</figcaption>
    </figure>
  );
}
