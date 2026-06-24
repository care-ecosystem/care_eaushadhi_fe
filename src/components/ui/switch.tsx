import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        onClick={() => onCheckedChange?.(!checked)}
        style={{ width: '44px', minWidth: '44px' }}
        className={cn(
          "peer inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 p-0.5",
          checked ? "bg-green-600" : "bg-gray-200",
          className
        )}
        {...props}
      >
        <span
          className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform"
          style={{
            transform: checked ? "translateX(20px)" : "translateX(0px)",
          }}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
