import { Button } from "@/components/ui/button"
import { Routes, Route } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute"
import DashboardLayout from "./layouts/DashboardLayout"
import Certifications from "./pages/admin/Certifications"
import Challenges from "./pages/admin/Challenges"
import QuestionBank from "./pages/admin/QuestionBank"
import Analytics from "./pages/admin/Analytics"
import Learners from "./pages/admin/Learners"
import Organizations from "./pages/admin/Organizations"

export function App() {
  localStorage.setItem("admin", "token")
  return (
    <Routes>
      {/* <Route element={<ProtectedRoute/>}></Route> */}
      <Route path="/" element={<DashboardLayout />}>
        <Route index element={<Certifications />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="question-bank" element={<QuestionBank />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="learners" element={<Learners />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  )
}

export default App
