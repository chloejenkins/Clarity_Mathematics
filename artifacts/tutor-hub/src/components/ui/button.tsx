import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Focus: a 2px ring with an offset, visible on every surface (was 1px, 2.5:1).
  // Hover: a colour change per variant instead of movement.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
" hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
           // @replit: no hover, and add primary border
           "bg-primary text-primary-foreground border border-transparent hover:bg-primary/90 font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground border border-transparent hover:bg-destructive/90 font-semibold",
        outline:
          // @replit Shows the background color of whatever card / sidebar / accent background it is inside of.
          // Inherits the current text color. Uses shadow-xs. no shadow on active
          // No hover state
          "border border-transparent bg-secondary text-brand hover:bg-secondary/70 ",
        secondary:
          // @replit border, no hover, no shadow, secondary border.
          "border border-transparent bg-brand-soft text-brand hover:bg-brand-soft/70 ",
        // @replit no hover, transparent border
        ghost: "border border-transparent hover:bg-accent",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        // @replit changed sizes
        default: "min-h-9 px-4 py-2 pointer-coarse:min-h-11",
        sm: "min-h-8 rounded-lg px-3 text-[13px] pointer-coarse:min-h-10",
        lg: "min-h-11 rounded-xl px-6 text-[17px] pointer-coarse:min-h-12",
        icon: "h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
