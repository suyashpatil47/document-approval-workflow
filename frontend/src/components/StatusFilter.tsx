import type { DocumentStatus } from '../api/types';

export type StatusFilterValue = DocumentStatus | 'all';

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface Props {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export function StatusFilter({ value, onChange }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Filter by status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const toStatusParam = (value: StatusFilterValue): DocumentStatus | undefined =>
  value === 'all' ? undefined : value;
