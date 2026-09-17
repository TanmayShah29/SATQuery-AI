/**
 * Loading skeleton components — Agent C (C-7)
 */
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-800 rounded ${className}`}
      aria-busy="true"
      aria-label="Loading..."
      role="status"
    />
  );
}

export function QuerySkeleton() {
  return (
    <div className="space-y-3 p-4" aria-label="Loading query results" role="status">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 border border-gray-800 rounded-lg space-y-2" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
