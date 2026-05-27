import { useTranslation } from 'react-i18next'

interface DateRangePickerProps {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  fromLabel?: string
  toLabel?: string
}

export default function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel,
  toLabel,
}: DateRangePickerProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 whitespace-nowrap">
          {fromLabel ?? t('common.from', 'From')}
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 whitespace-nowrap">
          {toLabel ?? t('common.to', 'To')}
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
        />
      </div>
    </div>
  )
}
