import { lazy, Suspense, useEffect, useRef } from "react"
import { Navigate, Routes, Route, useLocation } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import { LoadingScreen } from "./components/loading-screen.jsx"
import { roleHomePath, useAuth } from "./context/auth-context.jsx"

const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"))
const LearnerLayout = lazy(() => import("./layouts/learner-layout.jsx"))
const EnterpriseLayout = lazy(() => import("./layouts/enterprise-layout.jsx"))
const LoginPage = lazy(() => import("./pages/auth/login-page.jsx"))
const RegisterPage = lazy(() => import("./pages/auth/register-page.jsx"))
const VerifyEmailPage = lazy(() => import("./pages/auth/verify-email-page.jsx"))
const ForgotPasswordPage = lazy(() => import("./pages/auth/forgot-password-page.jsx"))
const SetNewPasswordPage = lazy(() => import("@/pages/auth/set-new-password-page.jsx"))
const Certifications = lazy(() => import("./pages/admin/certifications-page.jsx"))
const Challenges = lazy(() => import("./pages/admin/challenges-page.jsx"))
const Learners = lazy(() => import("./pages/admin/learners-page.jsx"))
const Organizations = lazy(() => import("./pages/admin/organizations-page.jsx"))
const AdminOrganizationDetail = lazy(() => import("./pages/admin/admin-organization-detail-page.jsx"))
const ViewCertificationAdmin = lazy(() => import("./pages/admin/view-certification-admin-page.jsx"))
const AdminDashboard = lazy(() => import("./pages/admin/admin-dashboard-page.jsx"))
const PartnershipRequests = lazy(() => import("./pages/admin/partnership-requests-page.jsx"))
const BktDeliveryStatus = lazy(() => import("./pages/admin/bkt-delivery-status-page.jsx"))
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
// Dev-only screenshot harness for the landing hero. Never routed in a
// production build (see the guarded <Route> below), so this chunk is only ever
// requested by a developer opening the preview URL.
const AttemptPreviewPage = lazy(() => import("./pages/dev/attempt-preview-page.jsx"))
const LearnerAssessmentResultPage = lazy(() => import("./pages/learner/assessments/learner-assessment-result-page.jsx"))
const LearnerAssessmentHistoryPage = lazy(() => import("./pages/learner/assessments/learner-assessment-history-page.jsx"))
const LearnerPracticeAttemptPage = lazy(() => import("./pages/learner/practice/learner-practice-attempt-page.jsx"))
const LearnerPracticeHistoryPage = lazy(() => import("./pages/learner/practice/learner-practice-history-page.jsx"))
const LearnerPracticeReviewPage = lazy(() => import("./pages/learner/practice/learner-practice-review-page.jsx"))
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
const LearnerCertificationCurriculumPage = lazy(() =>
    import("./pages/learner/learning/learner-certification-curriculum-page.jsx")
)
const LearnerTopicPage = lazy(() => import("./pages/learner/learning/learner-topic-page.jsx"))
const ArenaConfig = lazy(() => import("./pages/admin/arena-config-page.jsx"))
const ArenaDetail = lazy(() => import("./pages/admin/arena-detail-page.jsx"))
const NotificationsPage = lazy(() => import("./pages/notifications-page.jsx"))
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

/**
 * Route transition.
 *
 * A CSS animation, not a motion component, even though the rest of the app
 * animates with framer. This element wraps *every page*, and a JS-driven
 * entrance means the whole app sits at `opacity: 0` until an animation frame
 * runs. Anything that stops frames arriving — a throttled background tab, a
 * paused renderer, framer failing to start — leaves a blank window rather than
 * an unanimated one. A CSS keyframe cannot fail that way: it either runs or the
 * declaration is ignored and the page is simply visible.
 *
 * Deliberately enter-only: exiting means holding the old page mounted while the
 * new one loads, which fights `Suspense` on lazily-loaded routes and delays
 * every navigation by the length of the exit.
 *
 * Keyed on `pathname` only, not `search` — restarting the animation when a
 * query param changes would flash the page on every filter change.
 */
function RouteTransition({ children }) {
    const { pathname } = useLocation()
    const ref = useRef(null)

    // Restart the animation by removing and re-adding the class, rather than by
    // keying this element on `pathname`. A changing key would remount the whole
    // subtree on every navigation — including the shared portal layouts, which
    // hold search state, open sheets, and the portal data query — so moving
    // between two pages of the same layout would tear down and rebuild the
    // layout around them. Reading `offsetWidth` between the two is what forces
    // the reflow that makes the browser treat it as a new animation.
    useEffect(() => {
        const node = ref.current
        if (!node) return

        node.classList.remove("rb-route-enter")
        void node.offsetWidth
        node.classList.add("rb-route-enter")
    }, [pathname])

    return (
        <div ref={ref} className="rb-route-enter">
            {children}
        </div>
    )
}

export function App() {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <RouteTransition>
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

            {/* Dev-only: renders the real attempt page against fixture data so
                the landing hero can be re-shot from the actual product. Stripped
                from production builds. */}
            {import.meta.env.DEV ? (
                <Route path="/__preview/attempt/:examId" element={<AttemptPreviewPage />} />
            ) : null}

            {/* Dev-only: the boot screen, held on screen. It normally shows for
                a few hundred milliseconds during Suspense, which is not long
                enough to review it. Stripped from production builds. */}
            {import.meta.env.DEV ? (
                <Route path="/__preview/loading" element={<LoadingScreen />} />
            ) : null}

            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
                <Route path="/admin" element={<DashboardLayout />}>
                    <Route index element={<Certifications />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="challenges" element={<Challenges />} />
                    <Route path="arenas" element={<ArenaConfig />} />
                    {/* Each arena authors its own problems: three builders on
                        one page was three screens of editors in a column. */}
                    <Route path="arenas/:arenaId" element={<ArenaDetail />} />
                    {/* No standalone /admin/question-bank. Questions only mean
                        something against a certification's own curriculum, and
                        the same builder is embedded in that certification's
                        Question Bank tab -- a global list made you pick the
                        certification again after arriving. */}
                    <Route path="organizations" element={<Organizations />} />
                    <Route
                        path="organizations/:id"
                        element={<AdminOrganizationDetail />}
                    />
                    <Route path="partnership-requests" element={<PartnershipRequests />} />
                    {/* Community moderation is withdrawn from the admin portal.
                        The page and its service still exist -- re-register this
                        route to bring it back. */}
                    <Route path="bkt-delivery" element={<BktDeliveryStatus />} />
                    {/* No standalone generation workspace. A run is watched in
                        the modal that started it -- the InlineGenerationMonitor
                        renders the same transcript, review checkpoints and
                        recovery panel without leaving the certification. */}
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
                    <Route index element={<Navigate to="analytics" replace />} />
                    <Route path="dashboard" element={<Navigate to="/learner/analytics" replace />} />
                    <Route path="analytics" element={<LearnerProgressPage />} />
                    <Route path="progress" element={<LearnerProgressPage />} />
                    <Route path="learning" element={<LearnerLearningPage />} />

                    {/* Diagnostic gate. This must match the path used in learner-learning-page.jsx. */}
                    <Route
                        path="learning/:certificationId/diagnostic"
                        element={<LearnerDiagnosticGatePage />}
                    />

                    {/* Opening an enrolled certification from My Learning lands
                        on its curriculum: units as bands, opening to topics,
                        opening to the lessons/quizzes/assessments inside them.
                        This path used to render the My Learning *list* again,
                        so clicking a certification showed the same page back. */}
                    <Route
                        path="learning/:certificationId"
                        element={<LearnerCertificationCurriculumPage />}
                    />

                    {/* One middle category, start to finish: outline, lesson
                        content, AI tutor. */}
                    <Route
                        path="learning/:certificationId/topics/:middleCategoryId"
                        element={<LearnerTopicPage />}
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
                    {/* Community Q&A is withdrawn from the learner portal. The
                        page, hooks and services are kept -- re-register this
                        route to bring it back. */}
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

            <Route element={<ProtectedRoute allowedRoles={["ENTERPRISE", "ENTERPRISE_MEMBER"]} />}>
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
                    <Route
                        path="groups/:groupId/learners/:learnerId"
                        element={<EnterpriseGroupLearnerPage />}
                    />
                    {/* Full-page assessment builder (details + question builder),
                        replacing the old modal. Edit reuses the same page. */}
                    <Route
                        path="groups/:groupId/assessments/new"
                        element={<EnterpriseAssessmentBuilderPage />}
                    />
                    <Route
                        path="groups/:groupId/assessments/:examId/edit"
                        element={<EnterpriseAssessmentBuilderPage />}
                    />
                    {/* Read-only Cisco-style two-pane content reader (outline +
                        lesson body). ?groupId= mixes in the group's own content. */}
                    <Route
                        path="certifications/:certificationId/view"
                        element={<EnterpriseCertificationViewerPage />}
                    />
                    <Route path="question-bank" element={<EnterpriseQuestionBankPage />} />
                    <Route path="license" element={<EnterpriseLicensePage />} />
                    <Route path="analytics" element={<EnterpriseAnalyticsPage />} />
                    <Route path="partnership" element={<EnterprisePartnershipPage />} />
                    <Route path="billing" element={<EnterpriseBillingPage />} />
                    <Route path="files" element={<EnterpriseFilesPage />} />
                    <Route path="organization" element={<EnterpriseOrganizationPage />} />
                </Route>
            </Route>

            {/* The notification feed is per-user, not per-portal, so admin,
                enterprise, and learner all share this one page. */}
            <Route
                element={
                    <ProtectedRoute
                        allowedRoles={["ADMIN", "ENTERPRISE", "ENTERPRISE_MEMBER", "LEARNER"]}
                    />
                }
            >
                <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </RouteTransition>
      </Suspense>
    )
}

export default App
