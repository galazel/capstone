import { useNotificationPreferences } from '@/hooks/useNotificationPreferences'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell } from 'lucide-react'

export default function NotificationPreferencesPage() {
  const { prefs, loading, updatePreferences } = useNotificationPreferences()

  if (loading) return <div className="p-8">Loading preferences...</div>
  if (!prefs) return <div className="p-8">No preferences found</div>

  const handleToggle = async (field) => {
    const updated = { ...prefs, [field]: !prefs[field] }
    await updatePreferences(updated)
  }

  const handleTimeChange = async (time) => {
    await updatePreferences({ ...prefs, dailyReminderTime: time })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Bell className="w-8 h-8 text-blue-500" />
          <h1 className="text-4xl font-bold">Notification Preferences</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Reminder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-medium">Enable daily reminders</label>
                <input
                  type="checkbox"
                  checked={prefs.dailyReminder}
                  onChange={() => handleToggle('dailyReminder')}
                  className="w-5 h-5"
                />
              </div>
              {prefs.dailyReminder && (
                <div>
                  <label className="block text-sm text-slate-600 mb-2">Reminder time</label>
                  <input
                    type="time"
                    value={prefs.dailyReminderTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Streak Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <label className="font-medium">Notify when streak is about to reset</label>
                <input
                  type="checkbox"
                  checked={prefs.streakReminder}
                  onChange={() => handleToggle('streakReminder')}
                  className="w-5 h-5"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="font-medium">New comments on my posts</label>
                <input
                  type="checkbox"
                  checked={prefs.socialNotifications}
                  onChange={() => handleToggle('socialNotifications')}
                  className="w-5 h-5"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <label className="font-medium">Badge achievements earned</label>
                <input
                  type="checkbox"
                  checked={prefs.achievementNotifications}
                  onChange={() => handleToggle('achievementNotifications')}
                  className="w-5 h-5"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
