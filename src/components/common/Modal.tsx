interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
      <div className="min-w-[320px] max-w-5xl flex-1 rounded-lg bg-white shadow-xl">
        <div className="flex justify-end p-4">
          <button
            aria-label="close"
            className="text-2xl leading-none text-gray-600 hover:text-gray-900"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
