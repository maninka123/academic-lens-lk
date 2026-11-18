/** Lanka Academia's mark: a small observatory. An orbit around a fixed point, with two recorded points on it. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="9" className="bm-tile" />
      <ellipse cx="16" cy="16" rx="10.5" ry="4.6" transform="rotate(-32 16 16)" className="bm-orbit" />
      <circle cx="16" cy="16" r="2.6" className="bm-core" />
      <circle cx="9.2" cy="20.6" r="1.7" className="bm-node" />
      <circle cx="22.8" cy="11.4" r="1.7" className="bm-node" />
    </svg>
  );
}
