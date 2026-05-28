import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import i18n from '../../src/i18n'
import BalancesPage from '../../src/pages/BalancesPage'

const BASE_URL = 'http://localhost:8000'

function renderBalances() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BalancesPage />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('BalancesPage', () => {
  it('shows empty state when no balances', async () => {
    renderBalances()
    await waitFor(() => expect(screen.getByText(/no outstanding balances/i)).toBeInTheDocument())
  })

  it('renders balance rows with €X.XX format', async () => {
    server.use(
      http.get(`${BASE_URL}/balances`, () =>
        HttpResponse.json({
          balances: [
            { debtor: { id: 'member-1', name: 'Alice' }, creditor: { id: 'member-2', name: 'Bob' }, amount: '20.00' },
          ],
          as_of: '2026-01-01T00:00:00Z',
        }),
      ),
    )
    renderBalances()
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
    expect(screen.getByText('€20.00')).toBeInTheDocument()
  })

  it('MoneyDisplay shows correct euro format', async () => {
    server.use(
      http.get(`${BASE_URL}/balances`, () =>
        HttpResponse.json({
          balances: [
            { debtor: { id: 'm1', name: 'X' }, creditor: { id: 'm2', name: 'Y' }, amount: '7.50' },
          ],
          as_of: '2026-01-01T00:00:00Z',
        }),
      ),
    )
    renderBalances()
    await waitFor(() => expect(screen.getByText('€7.50')).toBeInTheDocument())
  })
})
