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
        HttpResponse.json([
          { debtor_id: 'member-1', debtor_name: 'Alice', creditor_id: 'member-2', creditor_name: 'Bob', amount: '20.00' },
        ]),
      ),
    )
    renderBalances()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('€20.00')).toBeInTheDocument()
  })

  it('MoneyDisplay shows correct euro format', async () => {
    server.use(
      http.get(`${BASE_URL}/balances`, () =>
        HttpResponse.json([
          { debtor_id: 'm1', debtor_name: 'X', creditor_id: 'm2', creditor_name: 'Y', amount: '7.50' },
        ]),
      ),
    )
    renderBalances()
    await waitFor(() => expect(screen.getByText('€7.50')).toBeInTheDocument())
  })
})
