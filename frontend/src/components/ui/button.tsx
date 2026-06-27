import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-sm leading-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "text-link hover:text-link-hover underline underline-offset-2 decoration-from-font",
        primary: "bg-foreground text-background hover:bg-foreground/90 px-3 py-1.5 no-underline",
        secondary: "border border-border text-foreground hover:bg-overlay px-3 py-1.5 no-underline",
        ghost: "text-muted hover:text-foreground hover:bg-overlay px-2 py-1.5 no-underline",
        destructive: "text-destructive hover:text-destructive/80 no-underline",
      },
      size: {
        sm: "text-xs px-2 py-1",
        default: "px-3 py-1.5",
        lg: "px-4 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
