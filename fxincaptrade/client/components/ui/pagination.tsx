import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
    return <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
    return <ul className={cn("flex flex-row items-center gap-2", className)} {...props} />;
}

function PaginationItem(props: React.ComponentProps<"li">) {
    return <li {...props} />;
}

type PaginationLinkProps = {
    isActive?: boolean;
} & React.ComponentProps<"button">;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
    return (
        <button
            aria-current={isActive ? "page" : undefined}
            className={cn(
                buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }),
                "min-w-9 border-white/15 bg-transparent text-gray-200 hover:bg-white/10",
                className
            )}
            {...props}
        />
    );
}

function PaginationPrevious(props: React.ComponentProps<typeof Button>) {
    return (
        <Button variant="outline" size="sm" className="gap-1 border-white/15 text-gray-200 hover:bg-white/10" {...props}>
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
        </Button>
    );
}

function PaginationNext(props: React.ComponentProps<typeof Button>) {
    return (
        <Button variant="outline" size="sm" className="gap-1 border-white/15 text-gray-200 hover:bg-white/10" {...props}>
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
        </Button>
    );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center text-gray-400", className)} {...props}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More pages</span>
        </span>
    );
}

export {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis,
};