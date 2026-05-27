import { useTranslation } from 'react-i18next'
import MoneyDisplay from '../shared/MoneyDisplay'
import type { SummaryRow } from '../../api/reports'

interface SummaryTableProps {
  rows: SummaryRow[]
}

export default function SummaryTable({ rows }: SummaryTableProps) {
  const { t } = useTranslation()

  if (rows.length === 0) return <p className="text-gray-500 text-center py-8">{t('reports.summary.empty')}</p>

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('reports.summary.member')}</th>
            <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('reports.summary.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.member_id} className="border-t border-gray-100 bg-white">
              <td className="px-4 py-3 font-medium text-gray-800">{row.member_name}</td>
              <td className="px-4 py-3 text-right">
                <MoneyDisplay amount={row.total} className="font-bold text-pt-green" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
