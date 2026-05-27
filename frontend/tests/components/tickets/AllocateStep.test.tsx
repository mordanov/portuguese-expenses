import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../../src/i18n'
import AllocateStep, { type AllocationMap } from '../../../src/components/tickets/AllocateStep'

const items = [
  { name: 'Wine', price: '10.00' },
  { name: 'Cheese', price: '5.00' },
]

function renderAllocate(allocations: AllocationMap = {}, onChange = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AllocateStep items={items} allocations={allocations} onChange={onChange} />
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('AllocateStep', () => {
  it('renders an item card per item', async () => {
    renderAllocate()
    expect(await screen.findByText('Wine')).toBeInTheDocument()
    expect(screen.getByText('Cheese')).toBeInTheDocument()
  })

  it('shows "select at least one member" warning when no members selected', async () => {
    renderAllocate()
    await screen.findByText('Wine')
    const warnings = screen.getAllByText(/select at least one member/i)
    expect(warnings).toHaveLength(2)
  })

  it('clicking Alice on Wine calls onChange with member-1 for index 0', async () => {
    const onChange = vi.fn()
    renderAllocate({}, onChange)
    const aliceChips = await screen.findAllByRole('button', { name: /alice/i })
    await userEvent.click(aliceChips[0])
    expect(onChange).toHaveBeenCalledWith({ 0: ['member-1'] })
  })

  it('shows per-member cost when 2 members selected on €10 item', async () => {
    renderAllocate({ 0: ['member-1', 'member-2'] })
    await screen.findByText('Wine')
    const wineHeading = screen.getByText('Wine')
    const wineCard = wineHeading.closest('.border')!
    await waitFor(() => expect(within(wineCard as HTMLElement).getByText('€5.00')).toBeInTheDocument())
  })

  it('select all button selects all active members', async () => {
    const onChange = vi.fn()
    renderAllocate({}, onChange)
    const selectAllButtons = await screen.findAllByRole('button', { name: /select all/i })
    await userEvent.click(selectAllButtons[0])
    expect(onChange).toHaveBeenCalledWith({ 0: ['member-1', 'member-2'] })
  })
})
