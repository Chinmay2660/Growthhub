import { PageHeaderSkeleton, Skeleton } from "@/components/ui/StateViews";

/** Shown by Next while a route segment is loading, so navigation never shows a blank page. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
