import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBalances } from '../api/balances'
import BalanceRow from '../components/balances/BalanceRow'
import DateRangePicker from '../components/shared/DateRangePicker'

export default function BalancesPage() {
  const { t } = useTranslation()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { data: balances, isLoading } = useBalances({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('balances.title')}</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <p className="text-sm text-gray-500 mb-3">{t('balances.filterByDate')}</p>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          fromLabel={t('balances.from')}
          toLabel={t('balances.to')}
        />
      </div>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      {!isLoading && (balances?.length === 0 || !balances) && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-gray-500">{t('balances.empty')}</p>
        </div>
      )}

      <div className="space-y-3">
        {(balances ?? []).map((balance, idx) => (
          <BalanceRow key={idx} balance={balance} />
        ))}
      </div>
    </div>
  )
}
