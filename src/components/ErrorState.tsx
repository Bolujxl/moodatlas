type Props = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <p className="text-on-background text-base">Couldn't load images.</p>
      <p className="text-on-surface-variant text-sm">{message}</p>
      <button
        className="mt-2 px-5 py-2 rounded-md bg-tertiary text-on-tertiary text-sm font-medium hover:bg-tertiary/90 transition-colors"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}
