import type { ReactNode } from "react";

export type PixelIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

function PixelIcon({
  size = 20,
  className,
  children,
}: PixelIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      shapeRendering="crispEdges"
      viewBox="0 0 16 16"
      width={size}
    >
      {children}
    </svg>
  );
}

export function ArrowDown(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path d="M7 2H9V8H11V9H13V11H11V13H9V14H7V13H5V11H3V9H5V8H7Z" />
    </PixelIcon>
  );
}

export function ArrowRight(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path d="M2 7H8V5H10V3H11V5H13V7H14V9H13V11H11V13H10V11H8V9H2Z" />
    </PixelIcon>
  );
}

export function ArrowUpRight(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="3" y="11" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="7" y="3" width="6" height="2" />
      <rect x="11" y="3" width="2" height="6" />
    </PixelIcon>
  );
}

export function Check(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="2" y="7" width="2" height="3" />
      <rect x="4" y="9" width="2" height="2" />
      <rect x="6" y="11" width="3" height="2" />
      <rect x="8" y="9" width="2" height="2" />
      <rect x="10" y="7" width="2" height="2" />
      <rect x="12" y="5" width="2" height="2" />
    </PixelIcon>
  );
}

export function ChevronRight(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="4" y="3" width="2" height="2" />
      <rect x="6" y="5" width="2" height="2" />
      <rect x="8" y="7" width="2" height="2" />
      <rect x="6" y="9" width="2" height="2" />
      <rect x="4" y="11" width="2" height="2" />
    </PixelIcon>
  );
}

export function Coins(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="4" y="2" width="8" height="2" />
      <rect x="2" y="4" width="2" height="3" />
      <rect x="12" y="4" width="2" height="3" />
      <rect x="4" y="6" width="8" height="2" />
      <rect x="3" y="8" width="10" height="2" />
      <rect x="2" y="10" width="2" height="2" />
      <rect x="12" y="10" width="2" height="2" />
      <rect x="4" y="12" width="8" height="2" />
      <rect x="5" y="4" width="2" height="2" />
      <rect x="9" y="10" width="2" height="2" />
    </PixelIcon>
  );
}

export function Gamepad2(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path
        fillRule="evenodd"
        d="M4 3H12V4H13V6H14V11H12V13H10V12H6V13H4V11H2V6H3V4H4ZM5 6H7V7H8V9H7V10H5V9H4V7H5ZM10 7H11V8H10ZM12 8H13V9H12Z"
      />
    </PixelIcon>
  );
}

export function HelpCircle(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="5" y="1" width="6" height="2" />
      <rect x="3" y="3" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="2" y="5" width="2" height="6" />
      <rect x="12" y="5" width="2" height="6" />
      <rect x="3" y="11" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
      <rect x="5" y="13" width="6" height="2" />
      <rect x="6" y="5" width="4" height="2" />
      <rect x="9" y="7" width="2" height="2" />
      <rect x="7" y="8" width="2" height="3" />
      <rect x="7" y="12" width="2" height="1" />
    </PixelIcon>
  );
}

export function Package(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="3" y="3" width="10" height="2" />
      <rect x="2" y="5" width="12" height="2" />
      <rect x="2" y="7" width="2" height="6" />
      <rect x="12" y="7" width="2" height="6" />
      <rect x="4" y="13" width="8" height="2" />
      <rect x="7" y="5" width="2" height="10" />
      <rect x="4" y="7" width="3" height="1" />
      <rect x="9" y="7" width="3" height="1" />
    </PixelIcon>
  );
}

export function RotateCcw(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="2" y="2" width="2" height="5" />
      <rect x="3" y="2" width="4" height="2" />
      <rect x="2" y="6" width="4" height="2" />
      <rect x="6" y="3" width="5" height="2" />
      <rect x="11" y="5" width="2" height="2" />
      <rect x="12" y="7" width="2" height="4" />
      <rect x="10" y="11" width="3" height="2" />
      <rect x="5" y="12" width="5" height="2" />
      <rect x="3" y="10" width="2" height="3" />
    </PixelIcon>
  );
}

export function ShieldCheck(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path
        fillRule="evenodd"
        d="M4 2H12V4H13V7H12V10H11V12H10V13H9V14H7V13H6V12H5V10H4V8H3V4H4ZM5 7H6V9H7V10H8V9H9V8H11V9H10V10H9V11H7V12H6V11H5Z"
      />
    </PixelIcon>
  );
}

export function Truck(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path
        fillRule="evenodd"
        d="M1 4H10V6H13V8H14V12H13V14H10V13H6V14H3V12H1ZM11 7H12V9H10V7ZM3 12H5V14H3ZM10 12H12V14H10Z"
      />
    </PixelIcon>
  );
}

export function Volume2(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="2" y="6" width="3" height="4" />
      <rect x="5" y="4" width="2" height="8" />
      <rect x="7" y="3" width="2" height="10" />
      <rect x="10" y="5" width="2" height="2" />
      <rect x="12" y="7" width="2" height="2" />
      <rect x="10" y="9" width="2" height="2" />
    </PixelIcon>
  );
}

export function VolumeX(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="2" y="6" width="3" height="4" />
      <rect x="5" y="4" width="2" height="8" />
      <rect x="7" y="3" width="2" height="10" />
      <rect x="11" y="4" width="2" height="2" />
      <rect x="9" y="6" width="2" height="2" />
      <rect x="9" y="8" width="2" height="2" />
      <rect x="11" y="10" width="2" height="2" />
    </PixelIcon>
  );
}

export function Wallet(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <path
        fillRule="evenodd"
        d="M2 2H11V4H13V6H14V12H12V14H2V13H1V4H2ZM3 5H11V6H12V7H13V11H11V12H3ZM11 8H12V9H11Z"
      />
    </PixelIcon>
  );
}

export function X(props: PixelIconProps = {}) {
  return (
    <PixelIcon {...props}>
      <rect x="3" y="3" width="2" height="2" />
      <rect x="11" y="3" width="2" height="2" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="3" y="11" width="2" height="2" />
      <rect x="11" y="11" width="2" height="2" />
    </PixelIcon>
  );
}
