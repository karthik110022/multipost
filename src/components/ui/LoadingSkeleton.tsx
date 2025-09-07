interface LoadingSkeletonProps {
  className?: string;
  variant?: 'card' | 'text' | 'avatar' | 'button' | 'form';
  lines?: number;
}

export default function LoadingSkeleton({ 
  className = '', 
  variant = 'text',
  lines = 1 
}: LoadingSkeletonProps) {
  const baseClasses = "bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-shimmer rounded";
  
  if (variant === 'card') {
    return (
      <div className={`border border-gray-200 rounded-lg p-6 space-y-4 animate-fade-in ${className}`}>
        <div className={`h-6 ${baseClasses} mb-4`}></div>
        <div className={`h-4 ${baseClasses} w-3/4`}></div>
        <div className={`h-4 ${baseClasses} w-1/2`}></div>
        <div className={`h-10 ${baseClasses} w-32 mt-6`}></div>
      </div>
    );
  }
  
  if (variant === 'avatar') {
    return <div className={`w-10 h-10 ${baseClasses} rounded-full ${className}`}></div>;
  }
  
  if (variant === 'button') {
    return <div className={`h-10 w-24 ${baseClasses} ${className}`}></div>;
  }
  
  if (variant === 'form') {
    return (
      <div className={`space-y-4 animate-fade-in ${className}`}>
        <div className={`h-4 ${baseClasses} w-24`}></div>
        <div className={`h-10 ${baseClasses} w-full`}></div>
        <div className={`h-4 ${baseClasses} w-24`}></div>
        <div className={`h-32 ${baseClasses} w-full`}></div>
        <div className={`h-10 ${baseClasses} w-32`}></div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 animate-fade-in ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div 
          key={i} 
          className={`h-4 ${baseClasses} ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        ></div>
      ))}
    </div>
  );
}

// Specific skeleton components for common use cases
export function PostCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`border border-gray-200 rounded-lg p-4 space-y-3 animate-fade-in ${className}`}>
      <div className="flex items-center space-x-3">
        <LoadingSkeleton variant="avatar" />
        <div className="flex-1">
          <LoadingSkeleton className="h-4 w-32" />
          <LoadingSkeleton className="h-3 w-24 mt-1" />
        </div>
      </div>
      <LoadingSkeleton lines={3} />
      <div className="flex justify-between items-center pt-2">
        <LoadingSkeleton variant="button" className="h-8 w-20" />
        <LoadingSkeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      <LoadingSkeleton className="h-8 w-64 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <LoadingSkeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  );
}