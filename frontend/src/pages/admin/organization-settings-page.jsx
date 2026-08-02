import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building, Users, Mail, Settings } from "@/components/icons"

export default function OrganizationSettingsPage() {
  const { id } = useParams()
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')

  useEffect(() => {
    fetchOrgData()
  }, [id])

  const fetchOrgData = async () => {
    try {
      const [orgRes, membersRes] = await Promise.all([
        api.get(`/organizations/${id}`),
        api.get(`/organizations/${id}/members`),
      ])
      setOrg(orgRes.data)
      setMembers(membersRes.data)
    } catch (err) {
      console.error('Failed to load org', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    try {
      await api.post(`/organizations/${id}/invite`, {
        email: inviteEmail,
        role: inviteRole,
      })
      setInviteEmail('')
      fetchOrgData()
    } catch (err) {
      console.error('Failed to invite member', err)
    }
  }

  if (loading) return <div className="p-8">Loading organization...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Building className="w-8 h-8 text-blue-600" />
          <h1 className="text-4xl font-bold">Organization Settings</h1>
        </div>

        {/* Org Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <p className="text-lg font-semibold">{org?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Domain</label>
              <p className="text-lg">{org?.domain}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Plan</label>
              <p className="text-lg font-semibold text-blue-600">{org?.billingPlan}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Seats</label>
              <p className="text-lg">{org?.seatCount} users</p>
            </div>
          </CardContent>
        </Card>

        {/* Invite Member */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              <CardTitle>Invite Team Member</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MEMBER">Member</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Send Invite
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Team Members ({members.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.teamMemberId} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{member.learnerName}</p>
                    <p className="text-sm text-slate-600">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      member.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                      member.role === 'MANAGER' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {member.role}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      member.inviteStatus === 'ACCEPTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {member.inviteStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
