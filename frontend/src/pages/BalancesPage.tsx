import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useBalances, type BalanceRow } from '../api/balances'
import { useMembers, type Member } from '../api/members'
import { useOffsetRules, useCreateOffsetRule, useDeleteOffsetRule, type OffsetRuleRecord } from '../api/offsetRules'
import { useRecordPayment } from '../api/payments'
import BalanceRow_ from '../components/balances/BalanceRow'
import DateRangePicker from '../components/shared/DateRangePicker'
import { isAdmin } from '../api/auth'

type RuleType = 'absorb' | 'transfer'

// A draft rule being edited in the UI (not yet saved to DB — missing an ID)
interface DraftRule {
  id: null
  type: RuleType
  personA: string
  personB: string
}

// A saved rule loaded from (or confirmed saved to) DB
interface SavedRule {
  id: string
  type: RuleType
  personA: string
  personB: string
}

type UiRule = DraftRule | SavedRule

function toApplyRule(r: UiRule): { type: RuleType; personA: string; personB: string } {
  return { type: r.type, personA: r.personA, personB: r.personB }
}

function applyOffsets(balances: BalanceRow[], rules: UiRule[], members: Member[]): BalanceRow[] {
  const ledger = new Map<string, number>()
  for (const b of balances) {
    const key = `${b.debtor_id}|${b.creditor_id}`
    ledger.set(key, (ledger.get(key) ?? 0) + Math.round(parseFloat(b.amount) * 100))
  }

  for (const rule of rules) {
    if (!rule.personA || !rule.personB || rule.personA === rule.personB) continue
    const toMove: [string, number][] = []
    const { type, personA, personB } = toApplyRule(rule)

    if (type === 'absorb') {
      // Re-target creditor: everyone who owed personA now owes personB
      for (const [key, amount] of ledger) {
        const [, creditorId] = key.split('|')
        if (creditorId === personA) toMove.push([key, amount])
      }
      for (const [key, amount] of toMove) {
        const [debtorId] = key.split('|')
        ledger.delete(key)
        const newKey = `${debtorId}|${personB}`
        ledger.set(newKey, (ledger.get(newKey) ?? 0) + amount)
      }
    } else {
      // Re-target debtor: personA's debts are taken over by personB
      for (const [key, amount] of ledger) {
        const [debtorId] = key.split('|')
        if (debtorId === personA) toMove.push([key, amount])
      }
      for (const [key, amount] of toMove) {
        const [, creditorId] = key.split('|')
        ledger.delete(key)
        const newKey = `${personB}|${creditorId}`
        ledger.set(newKey, (ledger.get(newKey) ?? 0) + amount)
      }
    }
  }

  // Net out reverse pairs
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
  const admin = isAdmin()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [debtorId, setDebtorId] = useState('')
  const [creditorId, setCreditorId] = useState('')

  // Draft rules being built in the UI (not yet saved — id is null)
  const [drafts, setDrafts] = useState<DraftRule[]>([])

  // Payment modal state
  const [paymentTarget, setPaymentTarget] = useState<BalanceRow | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const recordPayment = useRecordPayment()
  const amountInputRef = useRef<HTMLInputElement>(null)

  const { data: balances, isLoading } = useBalances({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })
  const { data: membersResponse } = useMembers()
  const membersData = membersResponse?.items ?? []

  const { data: savedRules = [] } = useOffsetRules()
  const createRule = useCreateOffsetRule()
  const deleteRule = useDeleteOffsetRule()

  // Merge saved rules (from DB) with drafts (unsaved UI state) into one list for display
  const savedUiRules: SavedRule[] = savedRules.map((r: OffsetRuleRecord) => ({
    id: r.id,
    type: r.type,
    personA: r.person_a_id,
    personB: r.person_b_id,
  }))
  const allRules: UiRule[] = [...savedUiRules, ...drafts]

  function addDraft(type: RuleType) {
    setDrafts((d) => [...d, { id: null, type, personA: '', personB: '' }])
  }

  function updateDraft(idx: number, field: 'personA' | 'personB', value: string) {
    const updated = drafts.map((d, i) => i === idx ? { ...d, [field]: value } : d)
    const draft = updated[idx]
    if (draft.personA && draft.personB && draft.personA !== draft.personB) {
      // Both persons chosen — persist to DB and drop the draft
      createRule.mutate({ type: draft.type, person_a_id: draft.personA, person_b_id: draft.personB })
      setDrafts(updated.filter((_, i) => i !== idx))
    } else {
      setDrafts(updated)
    }
  }

  function removeDraft(idx: number) {
    setDrafts((d) => d.filter((_, i) => i !== idx))
  }

  function removeSaved(id: string) {
    deleteRule.mutate(id)
  }

  function openPaymentModal(balance: BalanceRow) {
    setPaymentTarget(balance)
    setPaymentAmount(balance.amount)
    setPaymentNote('')
    setPaymentError('')
    setTimeout(() => amountInputRef.current?.select(), 50)
  }

  function closePaymentModal() {
    setPaymentTarget(null)
    setPaymentAmount('')
    setPaymentNote('')
    setPaymentError('')
  }

  function submitPayment() {
    if (!paymentTarget) return
    const amt = parseFloat(paymentAmount)
    if (!paymentAmount || isNaN(amt) || amt <= 0) {
      setPaymentError(t('balances.payment.amountPositive'))
      return
    }
    recordPayment.mutate(
      {
        payer_id: paymentTarget.debtor_id,
        payee_id: paymentTarget.creditor_id,
        amount: amt.toFixed(2),
        note: paymentNote || undefined,
      },
      { onSuccess: closePaymentModal },
    )
  }

  const activeRules = allRules.filter((r) => r.personA && r.personB && r.personA !== r.personB)
  const computed = activeRules.length > 0
    ? applyOffsets(balances ?? [], activeRules, membersData)
    : (balances ?? [])

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
            <label className="block text-xs text-gray-500 mb-1">{t('balances.whoOwes')}</label>
            <select
              value={debtorId}
              onChange={(e) => setDebtorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            >
              <option value="">{t('balances.anyone')}</option>
              {membersData.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-36">
            <label className="block text-xs text-gray-500 mb-1">{t('balances.whoDoTheyOwe')}</label>
            <select
              value={creditorId}
              onChange={(e) => setCreditorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
            >
              <option value="">{t('balances.anyone')}</option>
              {membersData.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {(debtorId || creditorId) && (
            <div className="flex items-end">
              <button onClick={() => { setDebtorId(''); setCreditorId('') }} className="text-xs text-gray-400 hover:text-gray-600 underline pb-2">
                {t('balances.clear')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Offsetting rules */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('balances.offsetting.title')}</p>
            <p className="text-xs text-gray-400">{t('balances.offsetting.description')}</p>
          </div>
          {admin && (
            <div className="flex gap-2">
              <button
                onClick={() => addDraft('absorb')}
                className="text-xs text-pt-green hover:text-green-800 font-medium border border-pt-green rounded px-2 py-1 transition-colors"
              >
                {t('balances.offsetting.addAbsorb')}
              </button>
              <button
                onClick={() => addDraft('transfer')}
                className="text-xs text-pt-green hover:text-green-800 font-medium border border-pt-green rounded px-2 py-1 transition-colors"
              >
                {t('balances.offsetting.addTransfer')}
              </button>
            </div>
          )}
        </div>

        {allRules.length === 0 && (
          <p className="text-xs text-gray-400 italic">{t('balances.offsetting.noRules')}</p>
        )}

        <div className="space-y-2">
          {/* Saved rules */}
          {savedUiRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2 flex-wrap">
              {rule.type === 'absorb' ? (
                <>
                  <span className="flex-1 min-w-28 text-sm text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                    {membersData.find((m) => m.id === rule.personB)?.name ?? rule.personB}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{t('balances.offsetting.takesDebtsOwedTo')}</span>
                  <span className="flex-1 min-w-28 text-sm text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                    {membersData.find((m) => m.id === rule.personA)?.name ?? rule.personA}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-28 text-sm text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                    {membersData.find((m) => m.id === rule.personA)?.name ?? rule.personA}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{t('balances.offsetting.transfersDebtsTo')}</span>
                  <span className="flex-1 min-w-28 text-sm text-gray-700 px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50">
                    {membersData.find((m) => m.id === rule.personB)?.name ?? rule.personB}
                  </span>
                </>
              )}
              {admin && (
                <button
                  onClick={() => removeSaved(rule.id)}
                  className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                  aria-label={t('balances.offsetting.removeRule')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Draft rules (being built) */}
          {drafts.map((rule, idx) => (
            <div key={`draft-${idx}`} className="flex items-center gap-2 flex-wrap">
              {rule.type === 'absorb' ? (
                <>
                  <select
                    value={rule.personB}
                    onChange={(e) => updateDraft(idx, 'personB', e.target.value)}
                    className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  >
                    <option value="">{t('balances.offsetting.person')}</option>
                    {membersData.filter((m) => m.id !== rule.personA).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 shrink-0">{t('balances.offsetting.takesDebtsOwedTo')}</span>
                  <select
                    value={rule.personA}
                    onChange={(e) => updateDraft(idx, 'personA', e.target.value)}
                    className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  >
                    <option value="">{t('balances.offsetting.person')}</option>
                    {membersData.filter((m) => m.id !== rule.personB).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <select
                    value={rule.personA}
                    onChange={(e) => updateDraft(idx, 'personA', e.target.value)}
                    className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  >
                    <option value="">{t('balances.offsetting.person')}</option>
                    {membersData.filter((m) => m.id !== rule.personB).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 shrink-0">{t('balances.offsetting.transfersDebtsTo')}</span>
                  <select
                    value={rule.personB}
                    onChange={(e) => updateDraft(idx, 'personB', e.target.value)}
                    className="flex-1 min-w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                  >
                    <option value="">{t('balances.offsetting.person')}</option>
                    {membersData.filter((m) => m.id !== rule.personA).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </>
              )}
              {admin && (
                <button
                  onClick={() => removeDraft(idx)}
                  className="text-gray-400 hover:text-red-500 text-sm shrink-0"
                  aria-label={t('balances.offsetting.removeRule')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {activeRules.length > 0 && (
          <p className="text-xs text-pt-green mt-3 font-medium">
            {t('balances.offsetting.rulesApplied', { count: activeRules.length })}
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
          <BalanceRow_ key={idx} balance={balance} onRecordPayment={admin ? openPaymentModal : undefined} />
        ))}
      </div>

      {/* Payment modal */}
      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">{t('balances.payment.modalTitle')}</h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-semibold">{paymentTarget.debtor_name}</span>
              {' → '}
              <span className="font-semibold">{paymentTarget.creditor_name}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('balances.payment.amountLabel')}</label>
                <input
                  ref={amountInputRef}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => { setPaymentAmount(e.target.value); setPaymentError('') }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                />
                {paymentError && <p className="text-xs text-red-500 mt-1">{paymentError}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('balances.payment.noteLabel')}</label>
                <input
                  type="text"
                  placeholder={t('balances.payment.notePlaceholder')}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pt-green"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closePaymentModal}
                className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                {t('balances.payment.cancel')}
              </button>
              <button
                onClick={submitPayment}
                disabled={recordPayment.isPending}
                className="flex-1 bg-pt-green text-white rounded-lg py-2 text-sm font-medium hover:bg-green-800 transition-colors disabled:opacity-60"
              >
                {recordPayment.isPending ? t('balances.payment.submitting') : t('balances.payment.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
