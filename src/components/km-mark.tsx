import { useId } from "react";

/** KM logo: same drawing as public/favicon.svg and atm-km's mark. */
export function KmMark({ size = 32 }: { size?: number }) {
  const gradientId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 430 430"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="KM"
      className="shrink-0 rounded-[12%]"
    >
      <rect width="430" height="430" rx="50" fill="#1A1A1A" />
      <g transform="translate(-30.1 -30.1) scale(1.14)" fill={`url(#${gradientId})`}>
        <path d="M67 130L103 130L103 300L67 300Z" />
        <path d="M139 130L181 130L97 223.333L97 176.667Z" />
        <path d="M139 300L181 300L97 206.667L97 253.333Z" />
        <path d="M203 130L239 130L239 300L203 300Z" />
        <path d="M327 130L363 130L363 300L327 300Z" />
        <path d="M203 130L239 130L301 250L265 250Z" />
        <path d="M363 130L327 130L265 250L301 250Z" />
      </g>
      <defs>
        <linearGradient id={gradientId} x1="215" y1="120" x2="215" y2="310" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7DE34C" />
          <stop offset="1" stopColor="#15CFB3" />
        </linearGradient>
      </defs>
    </svg>
  );
}
