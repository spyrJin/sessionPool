"use client";

export function MatchWaiting() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-blue-500/40" />
        <div className="absolute inset-4 rounded-full bg-blue-500" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">Finding your match...</h3>
        <p className="mt-1 text-sm text-gray-400">
          Hang tight — we&apos;re pairing you with the right people.
        </p>
      </div>
    </div>
  );
}
