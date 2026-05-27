import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBalances, type BalanceRow } from '../api/balances'
import { useMembers, type Member } from '../api/members'
import BalanceRow_ from '../components/balances/BalanceRow'
import DateRangePicker from '../components/shared/DateRangePicker'

interface OffsetRule {
  absorberId: string  // Joe — takes the incoming debts
  absorbedId: string  // Helena — her credits are redirected to Joe
}

function applyOffsets(balances: BalanceRow[], rules: OffsetRule[], members: Member[]): BalanceRow[] {
  // Build a ledger: `${debtorId}|${creditorId}` → cents
  const ledger = new Map<string, number>()
  for (const b of balances) {
    const key = `${b.debtor_id}|${b.creditor_id}`
    ledger.set(key, (ledger.get(key) ?? 0) + Math.round(parseFloat(b.amount) * 100))
  }

  // Apply each rule: re-target all credits owed to absorbedId → absorberId
  for (const rule of rules) {
    if (!rule.absorberId || !rule.absorbedId || rule.absorberId === rule.absorbedId) continue
    const toMove: [string, number][] = []
    for (const [key, amount] of ledger) {
      const [, creditorId] = key.split('|')
      if (creditorId === rule.absorbedId) {
        toMove.push([key, amount])
      }
    }
    for (const [key, amount] of toMove) {
      const [debtorId] = key.split('|')
      ledger.delete(key)
      const newKey = `${debtorId}|${rule.absorberId}`
      ledger.set(newKey, (ledger.get(newKey) ?? 0) + amount)
    }
  }

  // Net out reverse pairs: A owes B €10, B owes A €6 → A owes B €4
  const seen = new Set<string>()
  for (const [key] of Array.from(ledger)) {
    if (seen.has(key)) continue
    const [a, b] = key.split('|')
    const reverseKey = `${b}|${a}`
    if (ledger.has(reverseKey)) {
      const fwd = ledger.get(key)!
      const rev = ledger.get(reverseKey)!
      if (fwd > rev) {
        ledger.set(key, fwd - rev)
        ledger.delete(reverseKey)
      } else if (rev > fwd) {
        ledger.set(reverseKey, rev - fwd)
        ledger.delete(key)
      } else {
        ledger.delete(key)
        ledger.delete(reverseKey)
      }
      seen.add(key)
      seen.add(reverseKey)
    }
  }

  const memberName = new Map(members.map((m) => [m.id, m.name]))
  const result: BalanceRow[] = []
  for (const [key, cents] of ledger) {
    if (cents <= 0) continue
    const [debtorId, creditorId] = key.split('|')
    if (debtorId === creditorId) continue
    result.push({
      debtor_id: debtorId,
      debtor_name: memberName.get(debtorId) ?? debtorId,
      creditor_id: creditorId,
      creditor_name: memberName.get(creditorId) ?? creditorId,
      amount: (cents / 100).toFixed(2),
    })
  }
  return result.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
}

export default function BalancesPage() {
  const { t } = useTranslation()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [debtorId, setDebtorId] = useState('')
  const [creditorId, setCreditorId] = useState('')
  const [offsetRules, setOffsetRules] = useState<OffsetRule[]>([])

  const { data: balances, isLoading } = useBalances({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })
  const { data: membersData } = useMembers()
  const members = membersData?.items ?? []

  function addRule() {
    setOffsetRules((r) => [...r, { absorberId: '', absorbedId: '' }])
  }

  function updateRule(idx: number, field: keyof OffsetRule, value: string) {
    setOffsetRules((r) => r.map((rule, i) => i === idx ? { ...rule, [field]: value } : rule))
  }

  function removeRule(idx: number) {
    setOffsetRules((r) => r.filter((_, i) => i !== idx))
  }

  const activeRules = offsetRules.filter((r) => r.absorberId && r.absorbedId && r.absorberId !== r.absorbedId)
  const computed = activeRules.length > 0 ? applyOffsets(balances ?? [], activeRules, members) : (balances ?? [])

  const filtered = computed.filter((b) => {
    if (debtorId && b.debtor_id !== debtorId) return false
    if (creditorId && b.creditor_id !== creditorId) return false
    return true
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('balances.title')}</h1>

      {/* Date + member filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm space-y-4">
        <div>
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
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-gray-500 mb-1">Who owes</label>
            <select
              value={debtorId}
              onChange={(e) => setDebtorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            >
              <option value="">— Anyone —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-gray-500 mb-1">Who do they owe</label>
            <select
              value={creditorId}
              onChange={(e) => setCreditorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            >
              <option value="">— Anyone —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {(debtorId || creditorId) && (
            <div className="flex items-end">
              <button onClick={() => { setDebtorId(''); setCreditorId('') }} className="text-xs text-gray-400 hover:text-gray-600 underline pb-2">
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Offsetting rules */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Offsetting</p>
            <p className="text-xs text-gray-400">Redirect someone's credits to another person — view only, nothing is saved</p>
          </div>
          <button
            onClick={addRule}
            className="text-xs text-pt-green hover:text-green-800 font-medium border border-pt-green rounded px-2 py-1 transition-colors"
          >
            + Add rule
          </button>
        </div>

        {offsetRules.length === 0 && (
          <p className="text-xs text-gray-400 italic">No rules yet.</p>
        )}

        <div className="space-y-2">
          {offsetRules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-wrap">
              <select
                value={rule.absorberId}
                onChange={(e) => updateRule(idx, 'absorberId', e.target.value)}
                className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              >
                <option value="">— person —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <span className="text-xs text-gray-500 shrink-0">takes debts owed to</span>
              <select
                value={rule.absorbedId}
                onChange={(e) => updateRule(idx, 'absorbedId', e.target.value)}
                className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
              >
                <option value="">— person —</option>
                {members
                  .filter((m) => m.id !== rule.absorberId)
                  .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button
                onClick={() => removeRule(idx)}
                className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                aria-label="Remove rule"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {activeRules.length > 0 && (
          <p className="text-xs text-pt-green mt-3 font-medium">
            {activeRules.length} rule{activeRules.length > 1 ? 's' : ''} applied
          </p>
        )}
      </div>

      {isLoading && <p className="text-gray-500">{t('common.loading')}</p>}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-gray-500">{t('balances.empty')}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((balance, idx) => (
          <BalanceRow_ key={idx} balance={balance} />
        ))}
      </div>
    </div>
  )
}
