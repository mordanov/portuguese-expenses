import { useTranslation } from 'react-i18next'
import MoneyDisplay from '../shared/MoneyDisplay'
import type { BalanceRow as BalanceRowData } from '../../api/balances'

interface BalanceRowProps {
  balance: BalanceRowData
  onRecordPayment?: (balance: BalanceRowData) => void
}

export default function BalanceRow({ balance, onRecordPayment }: BalanceRowProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm gap-3">
      <p className="text-sm text-gray-800 flex-1">
        <span className="font-semibold">{balance.debtor_name}</span>
        {' '}<span className="text-gray-500">{t('balances.owes')}</span>{' '}
        <span className="font-semibold">{balance.creditor_name}</span>
      </p>
      <MoneyDisplay amount={balance.amount} className="font-bold text-pt-red shrink-0" />
      {onRecordPayment && (
        <button
          onClick={() => onRecordPayment(balance)}
          className="text-xs font-medium text-pt-green border border-pt-green rounded px-2 py-1 hover:bg-green-50 transition-colors shrink-0"
        >
          {t('balances.payment.recordButton')}
        </button>
      )}
    </div>
  )
}
