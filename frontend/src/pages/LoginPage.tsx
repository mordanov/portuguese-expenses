import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { login } from '../api/auth'
import { isAxiosError } from 'axios'

const loginSchema = z.object({
  username: z.string().min(1, 'required'),
  password: z.string().min(1, 'required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setServerError(null)
    try {
      await login(data.username, data.password)
      navigate('/', { replace: true })
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setServerError(t('auth.invalidCredentials'))
      } else {
        setServerError(t('common.error'))
      }
    }
  }

  return (
    <div className="min-h-screen bg-pt-green flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🇵🇹</div>
          <h1 className="text-2xl font-bold text-pt-green">{t('auth.loginSubtitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('auth.loginTitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.username')}
            </label>
            <input
              id="username"
              {...register('username')}
              type="text"
              autoComplete="username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
            />
            {errors.username && (
              <p className="text-red-600 text-xs mt-1">{t('auth.required')}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pt-green"
            />
            {errors.password && (
              <p className="text-red-600 text-xs mt-1">{t('auth.required')}</p>
            )}
          </div>

          {serverError && (
            <p className="text-red-600 text-sm text-center bg-red-50 border border-red-200 rounded-lg p-3">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-pt-green text-white font-semibold py-2.5 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
          >
            {isSubmitting ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <div className="mt-6 flex justify-center gap-2 text-lg">
          <span>🇵🇹</span>
          <span className="text-pt-red font-bold">|</span>
          <span>🇬🇧</span>
          <span className="text-pt-red font-bold">|</span>
          <span>🇷🇺</span>
        </div>
      </div>
    </div>
  )
}
