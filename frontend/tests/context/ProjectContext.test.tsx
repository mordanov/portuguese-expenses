import { render, act, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProjectProvider, useProject, ActiveProject } from '../../src/context/ProjectContext'

function CssVarReader() {
  const { setActiveProject } = useProject()
  return (
    <button
      onClick={() =>
        setActiveProject({
          id: 'proj-2',
          name: 'France-2026',
          bg_color: '#003189',
          text_color: '#FFFFFF',
          accent_color: '#ED2939',
          status: 'open',
        } as ActiveProject)
      }
    >
      Switch to France
    </button>
  )
}

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ProjectProvider>{ui}</ProjectProvider>
    </QueryClientProvider>,
  )
}

describe('ProjectContext', () => {
  beforeEach(() => {
    // Reset CSS vars
    document.documentElement.style.removeProperty('--project-bg')
    document.documentElement.style.removeProperty('--project-text')
    document.documentElement.style.removeProperty('--project-accent')
    localStorage.clear()
  })

  it('applies CSS vars when setActiveProject is called', async () => {
    wrap(<CssVarReader />)

    await act(async () => {
      screen.getByRole('button').click()
    })

    expect(document.documentElement.style.getPropertyValue('--project-bg')).toBe('#003189')
    expect(document.documentElement.style.getPropertyValue('--project-text')).toBe('#FFFFFF')
    expect(document.documentElement.style.getPropertyValue('--project-accent')).toBe('#ED2939')
  })

  it('persists active project to localStorage', async () => {
    wrap(<CssVarReader />)

    await act(async () => {
      screen.getByRole('button').click()
    })

    const stored = JSON.parse(localStorage.getItem('active_project') ?? 'null')
    expect(stored?.id).toBe('proj-2')
    expect(stored?.name).toBe('France-2026')
  })
})
