/** Tanda ARSSMED: Matahari dengan satu orbit dan satu planet. Dekoratif. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="32" height="32" rx="9" fill="var(--panggung)" />
      <ellipse cx="16" cy="16" rx="11.5" ry="6" fill="none" stroke="var(--panggung-tinta-2)" strokeWidth="1.2" transform="rotate(-20 16 16)" />
      <circle cx="16" cy="16" r="5" fill="var(--matahari)" />
      <circle cx="25.6" cy="11.6" r="2.4" fill="var(--planet-bumi)" />
    </svg>
  );
}
