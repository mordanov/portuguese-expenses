import type { BalanceRow } from '../api/balances'
import type { Member } from '../api/members'
import type { OffsetRuleRecord } from '../api/offsetRules'

type RuleType = 'absorb' | 'transfer'
interface Rule { type: RuleType; personA: string; personB: string }

export function applyOffsets(
  balances: BalanceRow[],
  rules: Rule[],
  members: Member[],
): BalanceRow[] {
  const ledger = new Map<string, number>()
  for (const b of balances) {
    const key = `${b.debtor_id}|${b.creditor_id}`
    ledger.set(key, (ledger.get(key) ?? 0) + Math.round(parseFloat(b.amount) * 100))
  }

  for (const rule of rules) {
    if (!rule.personA || !rule.personB || rule.personA === rule.personB) continue
    const toMove: [string, number][] = []
    const { type, personA, personB } = rule

    if (type === 'absorb') {
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

export function rulesFromRecords(records: OffsetRuleRecord[]): Rule[] {
  return records.map((r) => ({ type: r.type, personA: r.person_a_id, personB: r.person_b_id }))
}
