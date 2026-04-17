/**
 * Custom pixel-art brutalist icons.
 * All icons are 24x24 grids of 4x4 pixel "cells" rendered as SVG <rect>s.
 * Color uses currentColor + an accent fill (yellow secondary) for variety.
 * No emoji, no off-the-shelf icon libraries — fully bespoke for the brand.
 */

type IconProps = {
  size?: number;
  className?: string;
  accentClass?: string; // tailwind class controlling accent fill via currentColor isn't possible per-rect; we use raw hsl ref via CSS var
};

const ACCENT = "hsl(var(--secondary))";

const wrap = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    shapeRendering="crispEdges"
    fill="currentColor"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// Pixel magnifier — bold ring + accent diagonal handle
export const PixelSearch = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* outer ring */}
      <rect x="6" y="2" width="8" height="2" />
      <rect x="4" y="4" width="2" height="2" />
      <rect x="14" y="4" width="2" height="2" />
      <rect x="2" y="6" width="2" height="8" />
      <rect x="16" y="6" width="2" height="8" />
      <rect x="4" y="14" width="2" height="2" />
      <rect x="14" y="14" width="2" height="2" />
      <rect x="6" y="16" width="8" height="2" />
      {/* lens highlight */}
      <rect x="6" y="6" width="2" height="2" fill={ACCENT} />
      <rect x="8" y="6" width="2" height="2" fill={ACCENT} />
      {/* handle */}
      <rect x="14" y="14" width="2" height="2" />
      <rect x="16" y="16" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="20" y="20" width="2" height="2" />
    </>
  );

// Pixel robot — boxy head, antenna, accent eye
export const PixelRobot = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* antenna */}
      <rect x="11" y="0" width="2" height="2" />
      <rect x="10" y="2" width="4" height="2" />
      {/* head */}
      <rect x="4" y="4" width="16" height="2" />
      <rect x="2" y="6" width="2" height="10" />
      <rect x="20" y="6" width="2" height="10" />
      <rect x="4" y="14" width="16" height="2" />
      {/* face fill */}
      <rect x="4" y="6" width="16" height="8" fill="hsl(var(--background))" />
      {/* eyes */}
      <rect x="6" y="8" width="3" height="3" />
      <rect x="15" y="8" width="3" height="3" fill={ACCENT} />
      {/* mouth */}
      <rect x="8" y="12" width="8" height="1" />
      {/* neck + body bottom */}
      <rect x="9" y="16" width="6" height="2" />
      <rect x="6" y="18" width="12" height="4" />
      <rect x="8" y="20" width="2" height="2" fill={ACCENT} />
      <rect x="14" y="20" width="2" height="2" fill={ACCENT} />
    </>
  );

// Pixel chain link
export const PixelChain = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* left link */}
      <rect x="2" y="8" width="2" height="8" />
      <rect x="4" y="6" width="6" height="2" />
      <rect x="4" y="16" width="6" height="2" />
      <rect x="8" y="8" width="2" height="8" fill={ACCENT} />
      {/* connector */}
      <rect x="10" y="11" width="4" height="2" />
      {/* right link */}
      <rect x="14" y="8" width="2" height="8" fill={ACCENT} />
      <rect x="14" y="6" width="6" height="2" />
      <rect x="14" y="16" width="6" height="2" />
      <rect x="20" y="8" width="2" height="8" />
    </>
  );

// Pixel brain (static AI)
export const PixelBrain = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* outline */}
      <rect x="6" y="2" width="12" height="2" />
      <rect x="4" y="4" width="2" height="14" />
      <rect x="18" y="4" width="2" height="14" />
      <rect x="6" y="18" width="12" height="2" />
      {/* fill */}
      <rect x="6" y="4" width="12" height="14" fill="hsl(var(--background))" />
      {/* center seam */}
      <rect x="11" y="4" width="2" height="14" />
      {/* circuits */}
      <rect x="7" y="7" width="3" height="2" fill={ACCENT} />
      <rect x="14" y="7" width="3" height="2" fill={ACCENT} />
      <rect x="7" y="12" width="2" height="2" />
      <rect x="15" y="12" width="2" height="2" />
      <rect x="8" y="14" width="2" height="2" fill={ACCENT} />
      <rect x="14" y="14" width="2" height="2" fill={ACCENT} />
    </>
  );

// Pixel honeypot — pot with hex grid lid
export const PixelHoneypot = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* pot body */}
      <rect x="4" y="10" width="16" height="2" />
      <rect x="4" y="12" width="2" height="8" fill={ACCENT} />
      <rect x="18" y="12" width="2" height="8" fill={ACCENT} />
      <rect x="6" y="12" width="12" height="8" fill={ACCENT} />
      <rect x="4" y="20" width="16" height="2" />
      {/* hex lid pattern */}
      <rect x="6" y="6" width="2" height="2" />
      <rect x="10" y="6" width="2" height="2" />
      <rect x="14" y="6" width="2" height="2" />
      <rect x="8" y="8" width="2" height="2" />
      <rect x="12" y="8" width="2" height="2" />
      <rect x="16" y="8" width="2" height="2" />
      {/* drip */}
      <rect x="11" y="14" width="2" height="4" />
    </>
  );

// Pixel beaker (fuzz testing)
export const PixelBeaker = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* neck */}
      <rect x="8" y="2" width="8" height="2" />
      <rect x="9" y="4" width="2" height="6" />
      <rect x="13" y="4" width="2" height="6" />
      {/* flask body */}
      <rect x="6" y="10" width="2" height="2" />
      <rect x="16" y="10" width="2" height="2" />
      <rect x="4" y="12" width="2" height="6" />
      <rect x="18" y="12" width="2" height="6" />
      <rect x="4" y="18" width="16" height="2" />
      <rect x="6" y="20" width="12" height="2" />
      {/* liquid */}
      <rect x="6" y="14" width="12" height="4" fill={ACCENT} />
      {/* bubbles */}
      <rect x="8" y="15" width="2" height="2" />
      <rect x="14" y="16" width="2" height="2" />
    </>
  );

// Pixel CPU/chip (AI fuzz)
export const PixelChip = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      {/* pins */}
      <rect x="4" y="2" width="2" height="2" />
      <rect x="10" y="2" width="2" height="2" />
      <rect x="16" y="2" width="2" height="2" />
      <rect x="4" y="20" width="2" height="2" />
      <rect x="10" y="20" width="2" height="2" />
      <rect x="16" y="20" width="2" height="2" />
      <rect x="2" y="6" width="2" height="2" />
      <rect x="2" y="12" width="2" height="2" />
      <rect x="20" y="6" width="2" height="2" />
      <rect x="20" y="12" width="2" height="2" />
      {/* body */}
      <rect x="4" y="4" width="16" height="2" />
      <rect x="4" y="18" width="16" height="2" />
      <rect x="4" y="4" width="2" height="16" />
      <rect x="18" y="4" width="2" height="16" />
      {/* core */}
      <rect x="8" y="8" width="8" height="8" fill={ACCENT} />
      <rect x="10" y="10" width="4" height="4" />
    </>
  );

// Pixel sun (light mode)
export const PixelSun = ({ size = 24, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="10" y="2" width="4" height="2" />
      <rect x="10" y="20" width="4" height="2" />
      <rect x="2" y="10" width="2" height="4" />
      <rect x="20" y="10" width="2" height="4" />
      <rect x="4" y="4" width="2" height="2" />
      <rect x="18" y="4" width="2" height="2" />
      <rect x="4" y="18" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="8" y="8" width="8" height="8" fill={ACCENT} />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="16" y="6" width="2" height="2" />
      <rect x="6" y="16" width="2" height="2" />
      <rect x="16" y="16" width="2" height="2" />
    </>
  );

// Pixel moon (dark mode)
export const PixelMoon = ({ size = 24, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="8" y="2" width="8" height="2" />
      <rect x="6" y="4" width="2" height="2" />
      <rect x="16" y="4" width="2" height="2" />
      <rect x="4" y="6" width="2" height="12" />
      <rect x="6" y="18" width="2" height="2" />
      <rect x="8" y="20" width="8" height="2" />
      <rect x="16" y="18" width="4" height="2" />
      <rect x="18" y="14" width="2" height="4" />
      {/* body */}
      <rect x="6" y="6" width="10" height="12" fill="hsl(var(--background))" />
      {/* crater accents */}
      <rect x="8" y="8" width="2" height="2" fill={ACCENT} />
      <rect x="12" y="12" width="3" height="3" fill={ACCENT} />
    </>
  );

// Pixel check (passed)
export const PixelCheck = ({ size = 28, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="18" y="6" width="2" height="2" />
      <rect x="16" y="8" width="2" height="2" />
      <rect x="14" y="10" width="2" height="2" />
      <rect x="12" y="12" width="2" height="2" />
      <rect x="10" y="14" width="2" height="2" />
      <rect x="8" y="12" width="2" height="2" />
      <rect x="6" y="10" width="2" height="2" />
      <rect x="4" y="12" width="2" height="2" fill={ACCENT} />
      <rect x="6" y="14" width="2" height="2" fill={ACCENT} />
      <rect x="8" y="16" width="2" height="2" fill={ACCENT} />
    </>
  );

// Pixel X (failed)
export const PixelX = ({ size = 28, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="4" y="4" width="2" height="2" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="8" y="8" width="2" height="2" />
      <rect x="10" y="10" width="4" height="4" fill={ACCENT} />
      <rect x="14" y="14" width="2" height="2" />
      <rect x="16" y="16" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="18" y="4" width="2" height="2" />
      <rect x="16" y="6" width="2" height="2" />
      <rect x="14" y="8" width="2" height="2" />
      <rect x="8" y="14" width="2" height="2" />
      <rect x="6" y="16" width="2" height="2" />
      <rect x="4" y="18" width="2" height="2" />
    </>
  );

// Pixel warning triangle
export const PixelWarning = ({ size = 28, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="11" y="2" width="2" height="2" />
      <rect x="9" y="4" width="6" height="2" />
      <rect x="7" y="6" width="10" height="2" />
      <rect x="5" y="8" width="14" height="2" />
      <rect x="3" y="10" width="18" height="2" />
      <rect x="3" y="12" width="18" height="6" />
      <rect x="3" y="18" width="18" height="2" />
      {/* ! */}
      <rect x="11" y="8" width="2" height="6" fill={ACCENT} />
      <rect x="11" y="16" width="2" height="2" fill={ACCENT} />
    </>
  );

// Pixel skip arrow
export const PixelSkip = ({ size = 28, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="4" y="6" width="2" height="12" />
      <rect x="6" y="8" width="2" height="8" />
      <rect x="8" y="10" width="2" height="4" />
      <rect x="14" y="6" width="2" height="12" />
      <rect x="16" y="8" width="2" height="8" />
      <rect x="18" y="10" width="2" height="4" fill={ACCENT} />
    </>
  );

// Pixel question
export const PixelQuestion = ({ size = 28, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="8" y="4" width="8" height="2" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="16" y="6" width="2" height="4" />
      <rect x="14" y="10" width="2" height="2" />
      <rect x="12" y="12" width="2" height="2" fill={ACCENT} />
      <rect x="11" y="14" width="2" height="2" fill={ACCENT} />
      <rect x="11" y="18" width="2" height="2" fill={ACCENT} />
    </>
  );

// Pixel siren (honeypot alert)
export const PixelSiren = ({ size = 32, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="10" y="2" width="4" height="2" />
      <rect x="8" y="4" width="8" height="2" />
      <rect x="6" y="6" width="12" height="2" />
      <rect x="4" y="8" width="16" height="8" fill={ACCENT} />
      <rect x="6" y="10" width="2" height="2" />
      <rect x="10" y="10" width="2" height="2" />
      <rect x="14" y="10" width="2" height="2" />
      <rect x="2" y="16" width="20" height="2" />
      <rect x="4" y="18" width="16" height="2" />
      <rect x="11" y="20" width="2" height="2" />
    </>
  );

// Pixel gear (loading) — animated via parent
export const PixelGear = ({ size = 64, className }: IconProps) =>
  wrap(
    size,
    className,
    <>
      <rect x="10" y="0" width="4" height="2" />
      <rect x="10" y="22" width="4" height="2" />
      <rect x="0" y="10" width="2" height="4" />
      <rect x="22" y="10" width="2" height="4" />
      <rect x="3" y="3" width="3" height="3" />
      <rect x="18" y="3" width="3" height="3" />
      <rect x="3" y="18" width="3" height="3" />
      <rect x="18" y="18" width="3" height="3" />
      <rect x="6" y="6" width="12" height="12" fill={ACCENT} />
      <rect x="9" y="9" width="6" height="6" fill="hsl(var(--background))" />
    </>
  );
