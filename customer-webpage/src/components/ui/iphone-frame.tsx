import { cn } from "@/lib/utils";

interface IPhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function IPhoneFrame({ children, className }: IPhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative inline-block rounded-[3rem] border-[8px] border-gray-900 dark:border-gray-700 bg-gray-900 dark:bg-gray-700 shadow-xl",
        className
      )}
    >
      {/* Notch / Dynamic Island */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
        <div className="w-[90px] h-[26px] bg-gray-900 dark:bg-gray-700 rounded-b-2xl" />
      </div>
      {/* Screen */}
      <div className="relative overflow-hidden rounded-[2.2rem] bg-black">
        {children}
      </div>
      {/* Home Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] rounded-full bg-gray-600 dark:bg-gray-500 z-20" />
    </div>
  );
}
