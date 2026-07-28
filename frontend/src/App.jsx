import { Navigate, Routes, Route } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import DashboardLayout from "./layouts/DashboardLayout"
import LearnerLayout from "./layouts/learner-layout.jsx"
import EnterpriseLayout from "./layouts/enterprise-layout.jsx"
import { roleHomePath, useAuth } from "./context/auth-context.jsx"
import LoginPage from "./pages/auth/login-page.jsx"
import RegisterPage from "./pages/auth/register-page.jsx"
import VerifyEmailPage from "./pages/auth/verify-email-page.jsx"
import ForgotPasswordPage from "./pages/auth/forgot-password-page.jsx"
import SetNewPasswordPage from "@/pages/auth/set-new-password-page.jsx"

<<<<<<< Updated upstream
import Certifications from "./pages/admin/Certifications"
import Challenges from "./pages/admin/Challenges"
import QuestionBank from "./pages/admin/QuestionBank"
import Analytics from "./pages/admin/Analytics"
import Learners from "./pages/admin/Learners"
import Organizations from "./pages/admin/Organizations"
import ViewCertificationAdmin from "./pages/admin/ViewCertificationAdmin"
import AdminDashboard from "./pages/admin/AdminDashboard"
import PartnershipRequests from "./pages/admin/PartnershipRequests"
import AcceptEnterpriseInvitationPage from "./pages/admin/AcceptEnterpriseInvitationPage"
=======
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"))
const LearnerLayout = lazy(() => import("./layouts/learner-layout.jsx"))
const LearnerDashboardPage = lazy(() => import("./pages/learner/dashboard/learner-dashboard-page.jsx"))
const EnterpriseLayout = lazy(() => import("./layouts/enterprise-layout.jsx"))
const LoginPage = lazy(() => import("./pages/auth/login-page.jsx"))
const RegisterPage = lazy(() => import("./pages/auth/register-page.jsx"))
const VerifyEmailPage = lazy(() => import("./pages/auth/verify-email-page.jsx"))
const ForgotPasswordPage = lazy(() => import("./pages/auth/forgot-password-page.jsx"))
const SetNewPasswordPage = lazy(() => import("@/pages/auth/set-new-password-page.jsx"))
const Certifications = lazy(() => import("./pages/admin/certifications-page.jsx"))
const Challenges = lazy(() => import("./pages/admin/challenges-page.jsx"))
const QuestionBank = lazy(() => import("./pages/admin/question-bank-page.jsx"))
const Learners = lazy(() => import("./pages/admin/learners-page.jsx"))
const Organizations = lazy(() => import("./pages/admin/organizations-page.jsx"))
const AdminOrganizationDetail = lazy(() => import("./pages/admin/admin-organization-detail-page.jsx"))
const ViewCertificationAdmin = lazy(() => import("./pages/admin/view-certification-admin-page.jsx"))
const AdminDashboard = lazy(() => import("./pages/admin/admin-dashboard-page.jsx"))
const PartnershipRequests = lazy(() => import("./pages/admin/partnership-requests-page.jsx"))
const CommunityModeration = lazy(() => import("./pages/admin/community-moderation-page.jsx"))
const BktDeliveryStatus = lazy(() => import("./pages/admin/bkt-delivery-status-page.jsx"))
const GenerationWorkspace = lazy(() => import("./pages/admin/generation-workspace-page.jsx"))
const GamificationSettings = lazy(() => import("./pages/admin/gamification-settings-page.jsx"))
const AcceptEnterpriseInvitationPage = lazy(() => import("./pages/admin/accept-enterprise-invitation-page.jsx"))
const LandingPage = lazy(() => import("./pages/public/landing-page.jsx"))
const CreateLessons = lazy(() => import("./pages/admin/create-lessons-page.jsx"))
const LearnerProgressPage = lazy(() => import("./pages/learner/dashboard/learner-progress-page.jsx"))
const LearnerStudyPlanCalendarPage = lazy(() => import("./components/learner/learner-study-plan-modal.jsx"))
const LearnerLearningPage = lazy(() => import("./pages/learner/learning/learner-learning-page.jsx"))
const LearnerDiagnosticGatePage = lazy(() => import("./pages/learner/assessments/learner-diagnostic-page.jsx"))
const LearnerLessonPage = lazy(() => import("./pages/learner/learning/learner-lesson-page.jsx"))
const LearnerSubscriptionPage = lazy(() => import("./pages/learner/subscription/learner-subscription-page.jsx"))
const SubscriptionCheckoutResultPage = lazy(() => import("./pages/learner/subscription/subscription-checkout-result-page.jsx"))
const LearnerCertificationDetailPage = lazy(() => import("./pages/learner/learning/learner-certification-detail-page.jsx"))
const LearnerCertificationsPage = lazy(() => import("./pages/learner/learning/learner-certifications-page.jsx"))
const LearnerChallengesPage = lazy(() => import("./pages/learner/learning/learner-challenges-page.jsx"))
const LearnerFilesPage = lazy(() => import("./pages/learner/files/learner-files-page.jsx"))
const LearnerAccountPage = lazy(() => import("./pages/learner/dashboard/learner-account-page.jsx"))
const LearnerAssessmentAttemptPage = lazy(() => import("./pages/learner/assessments/learner-assessment-attempt-page.jsx"))
const LearnerAssessmentResultPage = lazy(() => import("./pages/learner/assessments/learner-assessment-result-page.jsx"))
const LearnerAssessmentHistoryPage = lazy(() => import("./pages/learner/assessments/learner-assessment-history-page.jsx"))
const LearnerPracticeAttemptPage = lazy(() => import("./pages/learner/practice/learner-practice-attempt-page.jsx"))
const LearnerPracticeHistoryPage = lazy(() => import("./pages/learner/practice/learner-practice-history-page.jsx"))
const LearnerPracticeReviewPage = lazy(() => import("./pages/learner/practice/learner-practice-review-page.jsx"))
const LearnerRankingsPage = lazy(() => import("./pages/learner/practice/learner-rankings-page.jsx"))
const MistakesBank = lazy(() => import("./pages/learner/practice/learner-mistakes-bank.jsx"))
const Community = lazy(() => import("./pages/learner/community/learner-community-qa.jsx"))
const EnterpriseDashboardPage = lazy(() => import("./pages/enterprise/dashboard/enterprise-dashboard-page.jsx"))
const EnterpriseMemberDashboardPage = lazy(() => import("./pages/enterprise/dashboard/enterprise-member-dashboard-page.jsx"))
const EnterpriseGroupWorkspacePage = lazy(() => import("./pages/enterprise/groups/enterprise-group-workspace-page.jsx"))
const EnterpriseGroupLearnerPage = lazy(() => import("./pages/enterprise/groups/enterprise-group-learner-page.jsx"))
const EnterpriseLearnersPage = lazy(() => import("./pages/enterprise/groups/enterprise-learners-page.jsx"))
const EnterpriseLearnerDetailPage = lazy(() => import("./pages/enterprise/groups/enterprise-learner-detail-page.jsx"))
const EnterpriseCertificationsPage = lazy(() => import("./pages/enterprise/certifications/enterprise-certifications-page.jsx"))
const EnterpriseCertificationDetailPage = lazy(() => import("./pages/enterprise/certifications/enterprise-certification-detail-page.jsx"))
const EnterpriseCertificationViewerPage = lazy(() => import("./pages/enterprise/certifications/enterprise-certification-viewer-page.jsx"))
const EnterpriseAssessmentBuilderPage = lazy(() => import("./pages/enterprise/certifications/enterprise-assessment-builder-page.jsx"))
const EnterpriseGroupsPage = lazy(() => import("./pages/enterprise/groups/enterprise-groups-page.jsx"))
const EnterpriseLicensePage = lazy(() => import("./pages/enterprise/account/enterprise-license-page.jsx"))
const EnterpriseAnalyticsPage = lazy(() => import("./pages/enterprise/dashboard/enterprise-analytics-page.jsx"))
const EnterprisePartnershipPage = lazy(() => import("./pages/enterprise/account/enterprise-partnership-page.jsx"))
const EnterpriseBillingPage = lazy(() => import("./pages/enterprise/account/enterprise-billing-page.jsx"))
const EnterpriseFilesPage = lazy(() => import("./pages/enterprise/account/enterprise-files-page.jsx"))
const EnterpriseOrganizationPage = lazy(() => import("./pages/enterprise/account/enterprise-organization-page.jsx"))
const EnterpriseQuestionBankPage = lazy(() => import("./pages/enterprise/certifications/enterprise-question-bank-page.jsx"))
const EnterpriseRequestAccessPage = lazy(() => import("./pages/public/enterprise-request-access-page.jsx"))
const CompilerArea = lazy(() => import("./pages/challenges/compiler-area-page.jsx"))
const CodeStrikePage = lazy(() => import("./pages/learner/challenges/codestrike-page.jsx"))
const BlueprintArenaPage = lazy(() => import("./pages/learner/challenges/blueprint-arena-page.jsx"))
const WorldCupPage = lazy(() => import("./pages/learner/challenges/world-cup-page.jsx"))
const ArenaConfig = lazy(() => import("./pages/admin/arena-config-page.jsx"))
const NotificationsPage = lazy(() => import("./pages/notifications-page.jsx"))
const NotFoundPage = lazy(() => import("./pages/public/not-found-page.jsx"))
const ForbiddenPage = lazy(() => import("./pages/public/forbidden-page.jsx"))
>>>>>>> Stashed changes


import LandingPage from "./pages/public/LandingPage"
import CreateLessons from "./pages/admin/CreateLessons"
import LearnerProgressPage from "./pages/learner/learner-progress-page.jsx"
import LearnerLearningPage from "./pages/learner/learner-learning-page.jsx"
import LearnerDiagnosticGatePage from "./pages/learner/learner-diagnostic-page.jsx"
import LearnerLessonPage from "./pages/learner/learner-lesson-page.jsx"
import LearnerSubscriptionPage from "./pages/learner/learner-subscription-page.jsx"
import LearnerCertificationDetailPage from "./pages/learner/learner-certification-detail-page.jsx"
import LearnerCertificationsPage from "./pages/learner/learner-certifications-page.jsx"
import LearnerChallengesPage from "./pages/learner/learner-challenges-page.jsx"
import LearnerFilesPage from "./pages/learner/learner-files-page.jsx"
import LearnerAccountPage from "./pages/learner/learner-account-page.jsx"
import LearnerAssessmentAttemptPage from "./pages/learner/learner-assessment-attempt-page.jsx"
import LearnerAssessmentResultPage from "./pages/learner/learner-assessment-result-page.jsx"
import LearningStudyPlan from "./pages/learner/learner-study-plan.jsx"
import MistakesBank from "./pages/learner/learner-mistakes-bank.jsx"
import Community from "./pages/learner/learner-community-qa.jsx"


import EnterpriseDashboardPage from "./pages/enterprise/enterprise-dashboard-page.jsx"
import EnterpriseLearnersPage from "./pages/enterprise/enterprise-learners-page.jsx"
import EnterpriseLearnerDetailPage from "./pages/enterprise/enterprise-learner-detail-page.jsx"
import EnterpriseInvitationsPage from "./pages/enterprise/enterprise-invitations-page.jsx"
import EnterpriseCertificationsPage from "./pages/enterprise/enterprise-certifications-page.jsx"
import EnterpriseGroupsPage from "./pages/enterprise/enterprise-groups-page.jsx"
import EnterpriseLicensePage from "./pages/enterprise/enterprise-license-page.jsx"
import EnterpriseAnalyticsPage from "./pages/enterprise/enterprise-analytics-page.jsx"
import EnterprisePartnershipPage from "./pages/enterprise/enterprise-partnership-page.jsx"
import EnterpriseBillingPage from "./pages/enterprise/enterprise-billing-page.jsx"
import EnterpriseFilesPage from "./pages/enterprise/enterprise-files-page.jsx"
import EnterpriseOrganizationPage from "./pages/enterprise/enterprise-organization-page.jsx"
import EnterpriseSettingsPage from "./pages/enterprise/enterprise-settings-page.jsx"
import EnterpriseRequestAccessPage from "./pages/public/enterprise-request-access-page.jsx"

import CompilerArea from "./components/challenges/compiler-area.jsx"


function RoleHomeRedirect() {
    const { user, status } = useAuth()

    if (status === "loading") {
        return null
    }

    if (status === "authenticated") {
        return <Navigate to={roleHomePath(user?.role)} replace />
    }

    return <Navigate to="/login" replace />
}

export function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/set-new-password" element={<SetNewPasswordPage />} />

            {/* Public: organization representatives request Enterprise access with no account. */}
            <Route
                path="/enterprise/request-access"
                element={<EnterpriseRequestAccessPage />}
            />

            <Route
                path="/invitations/accept"
                element={<AcceptEnterpriseInvitationPage />}
            />

            {/* ---------------------------------------------------------------
                TEMPORARY UI PREVIEW ROUTES — move these three back inside the
                LEARNER ProtectedRoute block before shipping.

                Public purely so the new arena designs can be opened without
                signing in. They are full-screen surfaces (like the attempt
                page) that render local mock data and call no API, so nothing
                is exposed by leaving them open during review.
                --------------------------------------------------------------- */}
            <Route path="/learner/challenges/codestrike" element={<CodeStrikePage />} />
            <Route path="/learner/challenges/blueprint-arena" element={<BlueprintArenaPage />} />
            <Route path="/learner/challenges/world-cup" element={<WorldCupPage />} />

            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/admin" element={<DashboardLayout />}>
                    <Route index element={<Certifications />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="challenges" element={<Challenges />} />
                    <Route path="arenas" element={<ArenaConfig />} />
                    <Route path="question-bank" element={<QuestionBank />} />
                    <Route path="organizations" element={<Organizations />} />
                    <Route path="partnership-requests" element={<PartnershipRequests />} />
                    <Route path="learners" element={<Learners />} />
                    <Route path="analytics" element={<Analytics />} />
                    <Route
                        path="certification/:id"
                        element={<ViewCertificationAdmin />}
                    />
                    <Route path="lessons/:name/create" element={<CreateLessons />} />
                </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["LEARNER"]} />}>
                <Route path="/learner" element={<LearnerLayout />}>
                    <Route index element={<Navigate to="progress" replace />} />
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
                    <Route path="plan" element={<LearningStudyPlan />} />
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
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["ENTERPRISE"]} />}>
                <Route path="/enterprise" element={<EnterpriseLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<EnterpriseDashboardPage />} />
                    <Route path="learners" element={<EnterpriseLearnersPage />} />
                    <Route
                        path="learners/:learnerId"
                        element={<EnterpriseLearnerDetailPage />}
                    />
                    <Route path="invitations" element={<EnterpriseInvitationsPage />} />
                    <Route
                        path="certifications"
                        element={<EnterpriseCertificationsPage />}
                    />
                    <Route path="groups" element={<EnterpriseGroupsPage />} />
                    <Route path="license" element={<EnterpriseLicensePage />} />
                    <Route path="analytics" element={<EnterpriseAnalyticsPage />} />
                    <Route path="partnership" element={<EnterprisePartnershipPage />} />
                    <Route path="billing" element={<EnterpriseBillingPage />} />
                    <Route path="files" element={<EnterpriseFilesPage />} />
                    <Route path="organization" element={<EnterpriseOrganizationPage />} />
                    <Route path="settings" element={<EnterpriseSettingsPage />} />
                </Route>
            </Route>

            <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
    )
}

export default App
