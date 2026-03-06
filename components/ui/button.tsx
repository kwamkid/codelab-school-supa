import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline active:opacity-70",
      },
      size: {
        default: "px-5 py-2.5 has-[>svg]:px-4",
        sm: "rounded-md gap-1.5 px-3.5 py-2.5 has-[>svg]:px-3",
        lg: "rounded-md px-7 py-2.5 has-[>svg]:px-5",
        icon: "size-11 p-2.5",
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
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading: controlledLoading, disabled, children, onClick, type = "button", ...props }, ref) => {
    const [isLoading, setIsLoading] = React.useState(false)
    
    const showLoading = controlledLoading || isLoading
    
    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!onClick || showLoading || disabled) return
      
      const result = onClick(e)
      
      if (result instanceof Promise) {
        setIsLoading(true)
        try {
          await result
        } finally {
          setIsLoading(false)
        }
      }
    }
    
    const Comp = asChild ? Slot : "button"
    
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          "relative",
          showLoading && "cursor-wait"
        )}
        ref={ref}
        disabled={disabled || showLoading}
        onClick={handleClick}
        type={type}
        aria-busy={showLoading}
        {...props}
      >
        {showLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="invisible">
              {children}
            </span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }