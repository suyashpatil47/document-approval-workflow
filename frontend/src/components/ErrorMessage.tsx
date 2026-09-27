interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="alert alert--error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
