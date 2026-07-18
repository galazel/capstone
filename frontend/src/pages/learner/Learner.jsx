import { Navigate } from 'react-router-dom'

/**
 * Redirect to learner dashboard
 */
function Learner() {
  return <Navigate to="/learner/dashboard" replace />
}

export default Learner