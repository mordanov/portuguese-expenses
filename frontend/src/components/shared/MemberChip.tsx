interface MemberChipProps {
  name: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

export default function MemberChip({ name, selected, onClick, disabled }: MemberChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium
        border-2 transition-all duration-150
        ${selected
          ? 'bg-pt-green border-pt-green text-white'
          : 'bg-white border-gray-300 text-gray-700 hover:border-pt-green hover:text-pt-green'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-pressed={selected}
    >
      {selected && (
        <span className="mr-1 text-xs">✓</span>
      )}
      {name}
    </button>
  )
}
