import { useEffect, useState } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { Lock, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/**
 * ProOnly wrapper - Shows paywall if user is not subscribed
 * Usage: <ProOnly feature="UNLIMITED_AI"><FeatureComponent /></ProOnly>
 */
export function ProOnly({ children, feature = 'PRO_FEATURE' }) {
  const { getSubscriptionStatus, loading } = useSubscription()
  const [isPro, setIsPro] = useState(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    const status = await getSubscriptionStatus()
    setIsPro(status?.isPro || status?.status === 'ACTIVE')
  }

  if (loading || isPro === null) {
    return <div className="p-8 text-center">Loading...</div>
  }

  if (!isPro) {
    return (
      <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="pt-12 pb-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Pro Feature</h3>
            <p className="text-slate-600 mb-6">
              This feature is available to Pro subscribers only. Upgrade now to unlock unlimited
              access!
            </p>
            <a
              href="/subscription"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Upgrade to Pro
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
