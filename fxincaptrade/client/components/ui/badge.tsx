import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition",
    {
        variants: {
            variant: {
                default: "border-white/20 bg-white/10 text-white",
                success: "border-emerald-400/40 bg-emerald-500/20 text-emerald-300",
                warning: "border-amber-400/40 bg-amber-500/20 text-amber-300",
                neutral: "border-slate-400/30 bg-slate-500/15 text-slate-300",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
