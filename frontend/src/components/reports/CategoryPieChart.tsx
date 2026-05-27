import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import MoneyDisplay from '../shared/MoneyDisplay'
import type { CategoryRow } from '../../api/reports'

const FALLBACK_COLORS = ['#006600', '#FF0000', '#FFD700', '#2196F3', '#E91E63', '#FF9800', '#9E9E9E']

interface CategoryPieChartProps {
  rows: CategoryRow[]
}

export default function CategoryPieChart({ rows }: CategoryPieChartProps) {
  const { t } = useTranslation()

  if (rows.length === 0) return <p className="text-gray-500 text-center py-8">{t('reports.categories.empty')}</p>

  const pieData = rows.map((r) => ({ name: r.category_name || t('reports.categories.uncategorized'), value: Math.round(parseFloat(r.total) * 100) / 100 }))

  return (
    <div className="space-y-6">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name }) => name}>
            {rows.map((row, idx) => (
              <Cell key={row.category_id ?? 'none'} fill={row.category_id ? FALLBACK_COLORS[idx % FALLBACK_COLORS.length] : '#9E9E9E'} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `€${value.toFixed(2)}`} />
        </PieChart>
      </ResponsiveContainer>

      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">{t('reports.categories.category')}</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('reports.categories.total')}</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">{t('reports.categories.percentage')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.category_id ?? 'none'} className="border-t border-gray-100 bg-white">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length] }}
                    />
                    {row.category_name || t('reports.categories.uncategorized')}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <MoneyDisplay amount={row.total} className="font-medium" />
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {Number(row.percentage).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
