import { lazy, Suspense } from "react"
import { Navigate, Routes, Route } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import { LoadingScreen } from "./components/loading-screen.jsx"
import { roleHomePath, useAuth } from "./context/auth-context.jsx"

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"))
const LearnerLayout = lazy(() => import("./layouts/learner-layout.jsx"))
const LearnerDashboardPage = lazy(() => import("./pages/learner/learner-dashboard-page.jsx"))
const EnterpriseLayout = lazy(() => import("./layouts/enterprise-layout.jsx"))
const LoginPage = lazy(() => import("./pages/auth/login-page.jsx"))
const RegisterPage = lazy(() => import("./pages/auth/register-page.jsx"))
const VerifyEmailPage = lazy(() => import("./pages/auth/verify-email-page.jsx"))
const ForgotPasswordPage = lazy(() => import("./pages/auth/forgot-password-page.jsx"))
const SetNewPasswordPage = lazy(() => import("@/pages/auth/set-new-password-page.jsx"))
const Certifications = lazy(() => import("./pages/admin/Certifications"))
const Challenges = lazy(() => import("./pages/admin/Challenges"))
const QuestionBank = lazy(() => import("./pages/admin/QuestionBank"))
const Learners = lazy(() => import("./pages/admin/Learners"))
const Organizations = lazy(() => import("./pages/admin/Organizations"))
const AdminOrganizationDetail = lazy(() => import("./pages/admin/AdminOrganizationDetail"))
const ViewCertificationAdmin = lazy(() => import("./pages/admin/ViewCertificationAdmin"))
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"))
const PartnershipRequests = lazy(() => import("./pages/admin/PartnershipRequests"))
const CommunityModeration = lazy(() => import("./pages/admin/CommunityModeration.jsx"))
const BktDeliveryStatus = lazy(() => import("./pages/admin/BktDeliveryStatus.jsx"))
const GamificationSettings = lazy(() => import("./pages/admin/GamificationSettings.jsx"))
const AcceptEnterpriseInvitationPage = lazy(() => import("./pages/admin/AcceptEnterpriseInvitationPage"))
const LandingPage = lazy(() => import("./pages/public/LandingPage"))
const CreateLessons = lazy(() => import("./pages/admin/CreateLessons"))
const LearnerProgressPage = lazy(() => import("./pages/learner/learner-progress-page.jsx"))
const LearnerStudyPlanCalendarPage = lazy(() => import("./components/learner/learner-study-plan-modal.jsx"))
const LearnerLearningPage = lazy(() => import("./pages/learner/learner-learning-page.jsx"))
const LearnerDiagnosticGatePage = lazy(() => import("./pages/learner/learner-diagnostic-page.jsx"))
const LearnerLessonPage = lazy(() => import("./pages/learner/learner-lesson-page.jsx"))
const LearnerSubscriptionPage = lazy(() => import("./pages/learner/learner-subscription-page.jsx"))
const SubscriptionCheckoutResultPage = lazy(() => import("./pages/learner/subscription-checkout-result-page.jsx"))
const LearnerCertificationDetailPage = lazy(() => import("./pages/learner/learner-certification-detail-page.jsx"))
const LearnerCertificationsPage = lazy(() => import("./pages/learner/learner-certifications-page.jsx"))
const LearnerChallengesPage = lazy(() => import("./pages/learner/learner-challenges-page.jsx"))
const LearnerFilesPage = lazy(() => import("./pages/learner/learner-files-page.jsx"))
const LearnerAccountPage = lazy(() => import("./pages/learner/learner-account-page.jsx"))
const LearnerAssessmentAttemptPage = lazy(() => import("./pages/learner/learner-assessment-attempt-page.jsx"))
const LearnerAssessmentResultPage = lazy(() => import("./pages/learner/learner-assessment-result-page.jsx"))
const LearnerAssessmentHistoryPage = lazy(() => import("./pages/learner/learner-assessment-history-page.jsx"))
const LearnerPracticeAttemptPage = lazy(() => import("./pages/learner/learner-practice-attempt-page.jsx"))
const LearnerPracticeHistoryPage = lazy(() => import("./pages/learner/learner-practice-history-page.jsx"))
const LearnerPracticeReviewPage = lazy(() => import("./pages/learner/learner-practice-review-page.jsx"))
const LearnerRankingsPage = lazy(() => import("./pages/learner/learner-rankings-page.jsx"))
const MistakesBank = lazy(() => import("./pages/learner/learner-mistakes-bank.jsx"))
const Community = lazy(() => import("./pages/learner/learner-community-qa.jsx"))
const EnterpriseDashboardPage = lazy(() => import("./pages/enterprise/enterprise-dashboard-page.jsx"))
const EnterpriseMemberDashboardPage = lazy(() => import("./pages/enterprise/enterprise-member-dashboard-page.jsx"))
const EnterpriseGroupWorkspacePage = lazy(() => import("./pages/enterprise/enterprise-group-workspace-page.jsx"))
const EnterpriseLearnersPage = lazy(() => import("./pages/enterprise/enterprise-learners-page.jsx"))
const EnterpriseLearnerDetailPage = lazy(() => import("./pages/enterprise/enterprise-learner-detail-page.jsx"))
const EnterpriseCertificationsPage = lazy(() => import("./pages/enterprise/enterprise-certifications-page.jsx"))
const EnterpriseCertificationDetailPage = lazy(() => import("./pages/enterprise/enterprise-certification-detail-page.jsx"))
const EnterpriseGroupsPage = lazy(() => import("./pages/enterprise/enterprise-groups-page.jsx"))
const EnterpriseLicensePage = lazy(() => import("./pages/enterprise/enterprise-license-page.jsx"))
const EnterpriseAnalyticsPage = lazy(() => import("./pages/enterprise/enterprise-analytics-page.jsx"))
const EnterprisePartnershipPage = lazy(() => import("./pages/enterprise/enterprise-partnership-page.jsx"))
const EnterpriseBillingPage = lazy(() => import("./pages/enterprise/enterprise-billing-page.jsx"))
const EnterpriseFilesPage = lazy(() => import("./pages/enterprise/enterprise-files-page.jsx"))
const EnterpriseOrganizationPage = lazy(() => import("./pages/enterprise/enterprise-organization-page.jsx"))
const EnterpriseQuestionBankPage = lazy(() => import("./pages/enterprise/enterprise-question-bank-page.jsx"))
const EnterpriseRequestAccessPage = lazy(() => import("./pages/public/enterprise-request-access-page.jsx"))
const CompilerArea = lazy(() => import("./components/challenges/compiler-area.jsx"))
const NotFoundPage = lazy(() => import("./pages/public/not-found-page.jsx"))
const ForbiddenPage = lazy(() => import("./pages/public/forbidden-page.jsx"))

// Owners land on the institution dashboard; Enterprise Members (group leaders)
// land on their own "My Groups" workspace list -- they never see the
// institution-wide dashboard.
function EnterpriseHome() {
    const { user } = useAuth()
    const target = user?.enterpriseMemberRole === "owner" ? "dashboard" : "member"
    return <Navigate to={target} replace />
}

function GuestOnlyRoute({ children }) {
    const { user, status } = useAuth()

    if (status === "loading") {
        return <LoadingScreen />
    }

    if (status === "authenticated") {
        return <Navigate to={roleHomePath(user?.role)} replace />
    }

    return children
}

function EnterpriseDashboardEntry() {
    const { user } = useAuth()
    return user?.enterpriseMemberRole === "owner"
        ? <EnterpriseDashboardPage />
        : <EnterpriseMemberDashboardPage />
}

export function App() {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
            <Route path="/" element={<GuestOnlyRoute><LandingPage /></GuestOnlyRoute>} />
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
            <Route path="/register" element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
            <Route path="/verify-email" element={<GuestOnlyRoute><VerifyEmailPage /></GuestOnlyRoute>} />
            <Route path="/forgot-password" element={<GuestOnlyRoute><ForgotPasswordPage /></GuestOnlyRoute>} />
            <Route path="/set-new-password" element={<GuestOnlyRoute><SetNewPasswordPage /></GuestOnlyRoute>} />

            {/* Public: organization representatives request Enterprise access with no account. */}
            <Route
                path="/enterprise/request-access"
                element={<EnterpriseRequestAccessPage />}
            />

            <Route
                path="/invitations/accept"
                element={<AcceptEnterpriseInvitationPage />}
            />

            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/admin" element={<DashboardLayout />}>
                    <Route index element={<Certifications />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="challenges" element={<Challenges />} />
                    <Route path="question-bank" element={<QuestionBank />} />
                    <Route path="organizations" element={<Organizations />} />
                    <Route
                        path="organizations/:id"
                        element={<AdminOrganizationDetail />}
                    />
                    <Route path="partnership-requests" element={<PartnershipRequests />} />
                    <Route path="community-moderation" element={<CommunityModeration />} />
                    <Route path="bkt-delivery" element={<BktDeliveryStatus />} />
                    <Route path="gamification-settings" element={<GamificationSettings />} />
                    <Route path="learners" element={<Learners />} />
                    <Route
                        path="certification/:id"
                        element={<ViewCertificationAdmin />}
                    />
                    <Route path="lessons/:name/create" element={<CreateLessons />} />
                </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["LEARNER"]} />}>
                <Route path="/learner" element={<LearnerLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<LearnerDashboardPage />} />
                    <Route path="analytics" element={<LearnerProgressPage />} />
                    <Route path="progress" element={<LearnerProgressPage />} />
                    <Route path="learning" element={<LearnerLearningPage />} />

                    {/* Diagnostic gate. This must match the path used in learner-learning-page.jsx. */}
                    <Route
                        path="learning/:certificationId/diagnostic"
                        element={<LearnerDiagnosticGatePage />}
                    />

                    <Route
                        path="learning/:certificationId"
                        element={<LearnerLearningPage />}
                    />
                    <Route path="lessons/:lessonId" element={<LearnerLessonPage />} />
                    <Route path="plan" element={<LearnerStudyPlanCalendarPage />} />
                    <Route
                        path="certifications"
                        element={<LearnerCertificationsPage />}
                    />
                    <Route
                        path="certifications/:certificationId"
                        element={<LearnerCertificationDetailPage />}
                    />
                    <Route path="challenges" element={<LearnerChallengesPage />} />
                    <Route path="subscription" element={<LearnerSubscriptionPage />} />
                    <Route path="library" element={<LearnerFilesPage />} />
                    <Route path="mistakes" element={<MistakesBank />} />
                    <Route path="community" element={<Community />} />
                    <Route path="rankings" element={<LearnerRankingsPage />} />
                    <Route path="account" element={<LearnerAccountPage />} />
                </Route>


                <Route
                    path="/learner/assessments/:examId"
                    element={<LearnerAssessmentAttemptPage />}
                />
                <Route
                    path="/learner/results/:examResultId"
                    element={<LearnerAssessmentResultPage />}
                />
                <Route
                    path="/learner/assessments/:examId/history"
                    element={<LearnerAssessmentHistoryPage />}
                />
                <Route path="/learner/practice/:studySetId" element={<LearnerPracticeAttemptPage />} />
                <Route path="/learner/practice-history" element={<LearnerPracticeHistoryPage />} />
                <Route path="/learner/practice-review/:attemptId" element={<LearnerPracticeReviewPage />} />

                {/* Sprint Challenge destination — the standalone compiler
                    playground the challenges carousel links to. */}
                <Route path="/challenges" element={<CompilerArea />} />

                {/* PayMongo hosted-checkout redirect targets (success_url/cancel_url
                    built server-side in PayMongoClient). The success page is what
                    actually activates the subscription via /subscription/verify. */}
                <Route path="/subscription/success" element={<SubscriptionCheckoutResultPage />} />
                <Route
                    path="/subscription/cancel"
                    element={<SubscriptionCheckoutResultPage canceled />}
                />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["ENTERPRISE"]} />}>
                <Route path="/enterprise" element={<EnterpriseLayout />}>
                    <Route index element={<EnterpriseHome />} />
                    <Route path="dashboard" element={<EnterpriseDashboardEntry />} />
                    {/* Enterprise Member (group leader) home; the per-group
                        workspace route is defined alongside the groups routes below. */}
                    <Route path="member" element={<EnterpriseMemberDashboardPage />} />
                    <Route path="learners" element={<EnterpriseLearnersPage />} />
                    <Route
                        path="learners/:learnerId"
                        element={<EnterpriseLearnerDetailPage />}
                    />
                    <Route
                        path="certifications"
                        element={<EnterpriseCertificationsPage />}
                    />
                    {/* Curriculum, groups, and invitations for one certification
                        allocation -- content, group creation, and invitations all
                        live within the certification they belong to. */}
                    <Route
                        path="certifications/:orgCertId"
                        element={<EnterpriseCertificationDetailPage />}
                    />
                    {/* Deep-linked from a specific certification on the
                        Certifications page (?orgCertId=...) -- groups are
                        always created/viewed in the context of one
                        certification allocation. */}
                    <Route path="groups" element={<EnterpriseGroupsPage />} />
                    <Route path="groups/:groupId" element={<EnterpriseGroupWorkspacePage />} />
                    {/* Reuses the admin lesson editor -- it reads lesson id/context
                        from navigation state, not from the route prefix, and the
                        underlying save/load endpoints already authorize group-owned
                        content for Enterprise Members. */}
                    <Route path="lessons/:name/create" element={<CreateLessons />} />
                    <Route path="question-bank" element={<EnterpriseQuestionBankPage />} />
                    <Route path="license" element={<EnterpriseLicensePage />} />
                    <Route path="analytics" element={<EnterpriseAnalyticsPage />} />
                    <Route path="partnership" element={<EnterprisePartnershipPage />} />
                    <Route path="billing" element={<EnterpriseBillingPage />} />
                    <Route path="files" element={<EnterpriseFilesPage />} />
                    <Route path="organization" element={<EnterpriseOrganizationPage />} />
                </Route>
            </Route>

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    )
}

export default App
