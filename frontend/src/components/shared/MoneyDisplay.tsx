interface MoneyDisplayProps {
  amount: string
  className?: string
}

export default function MoneyDisplay({ amount, className }: MoneyDisplayProps) {
  const [intPart, decPart = '00'] = amount.split('.')
  const formatted = `${intPart}.${decPart.padEnd(2, '0').slice(0, 2)}`
  return (
    <span className={className}>{`€${formatted}`}</span>
  )
}
