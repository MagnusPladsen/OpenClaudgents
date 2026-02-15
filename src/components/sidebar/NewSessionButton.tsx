interface NewSessionButtonProps {
  onClick?: () => void;
}

export function NewSessionButton({ onClick }: NewSessionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-secondary transition-all duration-200 hover:border-accent/40 hover:text-text hover:shadow-md hover:shadow-accent/5"
    >
      {/* Plus icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      New Session
    </button>
  );
}
