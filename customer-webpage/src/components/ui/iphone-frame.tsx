import { cn } from "@/lib/utils";

interface IPhoneFrameProps {
  children: React.ReactNode;
  className?: string;
  /** Compact mode uses a smaller Dynamic Island and hides status bar text - for small displays */
  compact?: boolean;
}

export function IPhoneFrame({ children, className, compact = false }: IPhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative inline-block",
        className
      )}
    >
      {/* Outer titanium shell */}
      <div
        className="relative rounded-[3rem] p-[2px]"
        style={{
          background: "linear-gradient(145deg, #e8e8ec, #a8a8b0, #c8c8d0, #b0b0b8)",
        }}
      >
        {/* Inner bezel */}
        <div
          className="relative rounded-[2.85rem] p-[6px]"
          style={{
            background: "linear-gradient(180deg, #2c2c2e, #1c1c1e, #2a2a2c)",
          }}
        >
          {/* Screen */}
          <div className="relative overflow-hidden rounded-[2.4rem] bg-black">
            {/* Status bar + Dynamic Island - absolute overlay */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 pt-3 pb-2"
              style={{
                background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)",
              }}
            >
              {/* Time */}
              <span className={cn(
                "text-white font-semibold min-w-[36px]",
                compact ? "text-[9px] invisible" : "text-[12px]"
              )}>
                9:41
              </span>

              {/* Dynamic Island pill */}
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    "bg-black rounded-full relative",
                    compact ? "w-[68px] h-[20px]" : "w-[96px] h-[26px]"
                  )}
                  style={{
                    boxShadow: "0 0 0 0.5px rgba(255,255,255,0.05)",
                  }}
                >
                  {/* Camera */}
                  <div className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded-full",
                    compact
                      ? "left-[14px] w-[7px] h-[7px]"
                      : "left-[18px] w-[9px] h-[9px]"
                  )}>
                    <div className="absolute inset-0 rounded-full bg-[#0c0c14] border border-[#222230]" />
                    <div className="absolute inset-[1.5px] rounded-full bg-[#08081a]" />
                    <div className="absolute top-[2px] left-[2px] w-[2px] h-[2px] rounded-full bg-[#1a1a3a] opacity-50" />
                  </div>
                </div>
              </div>

              {/* Status icons */}
              <div className={cn(
                "flex items-center gap-1 min-w-[36px] justify-end",
                compact && "invisible"
              )}>
                {/* Signal */}
                <svg width="14" height="10" viewBox="0 0 14 10" className="text-white">
                  <rect x="0" y="7" width="2.2" height="3" rx="0.5" fill="currentColor" />
                  <rect x="3.2" y="5" width="2.2" height="5" rx="0.5" fill="currentColor" />
                  <rect x="6.4" y="2.5" width="2.2" height="7.5" rx="0.5" fill="currentColor" />
                  <rect x="9.6" y="0" width="2.2" height="10" rx="0.5" fill="currentColor" />
                </svg>
                {/* WiFi */}
                <svg width="12" height="10" viewBox="0 0 12 10" className="text-white">
                  <circle cx="6" cy="9" r="1" fill="currentColor" />
                  <path d="M3.5 7a3.8 3.8 0 015 0" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                  <path d="M1.2 4.5a7 7 0 019.6 0" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                </svg>
                {/* Battery */}
                <svg width="20" height="9" viewBox="0 0 20 9" className="text-white">
                  <rect x="0.5" y="0.5" width="17" height="8" rx="1.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
                  <rect x="2" y="2" width="14" height="5" rx="0.5" fill="currentColor" />
                  <path d="M18.5 3v3a1.2 1.2 0 000-3z" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
            </div>

            {/* Status bar spacer - pushes content below the absolute status bar */}
            <div className={compact ? "h-[28px]" : "h-[36px]"} />

            {/* Content */}
            {children}
          </div>
        </div>
      </div>

      {/* Side button - right (power) */}
      <div
        className="absolute -right-[1.5px] top-[26%] w-[3px] h-[9%] rounded-r-[2px]"
        style={{ background: "linear-gradient(90deg, #888, #aaa, #888)" }}
      />

      {/* Side buttons - left (volume up, volume down, action button) */}
      <div
        className="absolute -left-[1.5px] top-[18%] w-[3px] h-[5%] rounded-l-[2px]"
        style={{ background: "linear-gradient(270deg, #888, #aaa, #888)" }}
      />
      <div
        className="absolute -left-[1.5px] top-[26%] w-[3px] h-[7%] rounded-l-[2px]"
        style={{ background: "linear-gradient(270deg, #888, #aaa, #888)" }}
      />
      <div
        className="absolute -left-[1.5px] top-[35%] w-[3px] h-[7%] rounded-l-[2px]"
        style={{ background: "linear-gradient(270deg, #888, #aaa, #888)" }}
      />

      {/* Home Indicator */}
      <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2 w-[28%] h-[4px] rounded-full bg-[#333] z-20" />
    </div>
  );
}
