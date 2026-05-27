import { useTranslation } from 'react-i18next'
import MoneyDisplay from '../shared/MoneyDisplay'
import type { BalanceRow as BalanceRowData } from '../../api/balances'

interface BalanceRowProps {
  balance: BalanceRowData
}

export default function BalanceRow({ balance }: BalanceRowProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <p className="text-sm text-gray-800">
        <span className="font-semibold">{balance.debtor_name}</span>
        {' '}<span className="text-gray-500">{t('balances.owes')}</span>{' '}
        <span className="font-semibold">{balance.creditor_name}</span>
      </p>
      <MoneyDisplay amount={balance.amount} className="font-bold text-pt-red" />
    </div>
  )
}
