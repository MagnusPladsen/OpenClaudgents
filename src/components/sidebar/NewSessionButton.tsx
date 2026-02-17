interface NewSessionButtonProps {
  onClick?: () => void;
}

export function NewSessionButton({ onClick }: NewSessionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg px-4 py-3 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-solid hover:border-accent/40 hover:bg-accent/5 hover:text-text hover:shadow-md hover:shadow-accent/5"
    >
      {/* Plus icon — rotates on hover */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-300 group-hover:rotate-90"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      New Session
    </button>
  );
}
