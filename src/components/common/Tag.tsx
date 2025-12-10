import clsx from 'clsx';

interface Props {
  label: string;
  color?: 'blue' | 'gray';
}

export function Tag({ label, color = 'blue' }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        color === 'blue' ? 'bg-[#e6f1ff] text-[#3f7df0]' : 'bg-gray-200 text-gray-700',
      )}
    >
      {label}
    </span>
  );
}
