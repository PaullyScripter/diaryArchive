import { Suspense } from "react";
import { ExplorePageContent } from "@/components/explore/explore-page-content";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="mb-6">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-3 border-b border-border last:border-b-0">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <ExplorePageContent />
    </Suspense>
  );
}
