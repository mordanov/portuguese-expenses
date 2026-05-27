import { useTranslation } from 'react-i18next'
import { useNavigate, NavLink } from 'react-router-dom'
import { logout } from '../../api/auth'

const LOCALES = [
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'pt', label: 'PT', flag: '🇵🇹' },
]

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  function handleLocaleChange(locale: string) {
    i18n.changeLanguage(locale)
    localStorage.setItem('i18nextLng', locale)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="bg-pt-green text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-pt-gold font-bold text-lg tracking-tight whitespace-nowrap">
              🇵🇹 {t('nav.title')}
            </NavLink>
            <div className="hidden md:flex items-center gap-4">
              {([
                { to: '/', label: t('nav.dashboard') },
                { to: '/tickets', label: t('nav.tickets') },
                { to: '/members', label: t('nav.members') },
                { to: '/categories', label: t('nav.categories') },
                { to: '/balances', label: t('nav.balances') },
                { to: '/reports', label: t('nav.reports') },
              ] as const).map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `text-sm font-medium px-3 py-1 rounded transition-colors ${
                      isActive
                        ? 'bg-pt-gold text-pt-green'
                        : 'text-white hover:bg-white/20'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {LOCALES.map(({ code, label, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLocaleChange(code)}
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    i18n.language.startsWith(code)
                      ? 'bg-pt-gold text-pt-green font-bold'
                      : 'text-white hover:bg-white/20'
                  }`}
                  aria-label={`Switch to ${label}`}
                >
                  {flag} {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-white hover:bg-white/20 px-3 py-1 rounded transition-colors"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
