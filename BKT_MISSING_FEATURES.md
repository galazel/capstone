# BKT Implementation - Missing Features & Gaps

## Executive Summary

The BKT infrastructure is **80% complete** with most backend plumbing in place, but the **frontend integration is incomplete**. Assessment events are enqueued correctly, but learners aren't seeing their mastery/priority data on dashboards and progress pages.

---

## ✅ What's Already Done

### Backend (Java/Spring)
- ✅ `BktOutboxService` - Enqueues events into outbox table on assessment submit
- ✅ `BktEventDispatcher` - Polls outbox every 10s and sends to FastAPI
- ✅ `BktClient` - HTTP client to call FastAPI endpoints
- ✅ `BKTService` - Facade delegating to BktClient
- ✅ `BKTController` - REST endpoints for individual learner mastery queries
- ✅ `LearnerAnalyticsController` - Proxies mastery/priorities/confidence to frontend
- ✅ `LearnerMasteryService` - Handles BktClient calls with graceful degradation
- ✅ `AssessmentAttemptService` - Calls BktOutboxService on submission

### Backend DTOs & Models
- ✅ `BktMasteryEvent` - Event payload structure
- ✅ `LearnerMasteryView` - Mastery response model
- ✅ `ConfidenceView` - Confidence summary model
- ✅ `LessonPriorityView` - Lesson priority model
- ✅ Event outbox table for transactional guarantee

### Frontend (React)
- ✅ `learnerAnalyticsService.js` - API functions to call backend:
  - `getLearnerMastery(learnerId, lessonIds)`
  - `getCertificationPriorities(learnerId, certificationId)`
  - `getCertificationConfidence(learnerId, certificationId)`
  - `getReadiness(payload)`
- ✅ `MasteryIndicator.jsx` - Visual component for 0-4 mastery levels
- ✅ `PRIORITY_META` - Priority tag labels and styling

### Python Backend (FastAPI)
- ✅ Complete BKT calculation engine with PyBKT
- ✅ Event processing with idempotency
- ✅ Mastery updates (weak/developing/good/mastered)
- ✅ Priority computation and aggregation
- ✅ REST API endpoints for all queries

---

## ❌ What's Missing

### 1. **Dashboard Not Showing Mastery** 🎯
**File:** `learner-dashboard-page.jsx`  
**Issue:** Dashboard doesn't fetch or display:
- Current mastery levels for each enrolled certification
- Study recommendations (priority lessons)
- Recent mastery changes
- Confidence scores

**What needs to be added:**
```javascript
// Missing hooks/code:
const { data: priorities } = useQuery({
  queryKey: ['priorities', certificationId],
  queryFn: () => getCertificationPriorities(learnerId, certificationId),
})

const { data: confidence } = useQuery({
  queryKey: ['confidence', certificationId],
  queryFn: () => getCertificationConfidence(learnerId, certificationId),
})

// Display recommendations in dashboard UI
```

---

### 2. **Progress Page Doesn't Show Calculated Mastery** 📊
**File:** `learner-progress-page.jsx`  
**Issue:** 
- Uses stub data or calculates mastery from exam results locally
- Doesn't fetch real BKT mastery from backend
- No priority recommendations displayed
- No mastery trends over time

**What needs to be added:**
```javascript
// Missing queries:
const { data: masteryHistory } = useQuery({
  queryKey: ['masteryHistory', certificationId],
  queryFn: () => base(`/api/bkt/me/history/${certificationId}`),
})

const { data: lessonMasteries } = useQuery({
  queryKey: ['lessons', certificationId],
  queryFn: () => getCertificationPriorities(learnerId, certificationId),
})

// Render actual BKT levels instead of derived percentages
```

---

### 3. **No Mastery Display on Lesson/Topic Cards** 📚
**Issue:** When browsing lessons, learners don't see:
- Current mastery level (weak/developing/good/mastered)
- Priority tag (CRITICAL/HIGH/MEDIUM/LOW/STRONG)
- Recommended action ("Review lesson then quiz")
- Confidence score (%)

**Where this should appear:**
- `/pages/learner/lesson-browse-page.jsx` - Lesson catalog
- `/components/learner/lesson-card.jsx` - Individual lesson preview
- `/pages/learner/learner-assessment-attempt-page.jsx` - After completing assessment

**Example missing component:**
```javascript
// MasteryBadge.jsx - NEW COMPONENT NEEDED
export function MasteryBadge({ lesson, mastery, priority }) {
  return (
    <div>
      <MasteryIndicator level={mastery.level} />
      <span className="priority-tag">{priority.tag}</span>
      <p className="recommendation">{priority.recommendedAction}</p>
    </div>
  )
}
```

---

### 4. **No Assessment Result Mastery Update Display** ✅➡️📈
**File:** `learner-assessment-result-page.jsx`  
**Issue:** After learner submits assessment:
- Shows pass/fail and score ✅
- Doesn't show:
  - How mastery changed (0.55 → 0.72)
  - New mastery level (developing → good)
  - Next recommended action based on new priorities
  - Progress towards certification readiness

**What needs to be added:**
```javascript
// After assessment submit, fetch updated mastery:
const { data: newMastery } = useQuery({
  queryKey: ['mastery', certificationId, Date.now()],
  queryFn: () => getLearnerMastery(learnerId, null),
  // Show: "Mastery improved: 55% → 72% ✨"
})
```

---

### 5. **No "Next Steps" Recommendations Component** 🎯
**Issue:** No component showing priority-based study recommendations
- Where to add: Dashboard, Progress page, After assessment results
- Should show:
  - Top 3 critical/high priority lessons
  - Why they're recommended
  - Suggested activity (Interactive Lesson, Quiz, etc.)

**Example missing component:**
```javascript
// StudyRecommendations.jsx - NEW COMPONENT NEEDED
export function StudyRecommendations({ certificationId, learnerId }) {
  const { data: priorities } = useQuery({
    queryFn: () => getCertificationPriorities(learnerId, certificationId),
  })

  return (
    <div className="recommendations">
      {priorities?.map(lesson => (
        <div key={lesson.lessonId} className="rec-card">
          <p>{lesson.lessonTitle}</p>
          <span className="priority-tag">{lesson.priorityTag}</span>
          <p className="reason">{lesson.primaryReason}</p>
          <Button>Start {lesson.recommendedActivity}</Button>
        </div>
      ))}
    </div>
  )
}
```

---

### 6. **Certification Readiness Not Shown** 📊
**File:** Dashboard, Certification detail page  
**Issue:** Learners don't see:
- Overall certification confidence (%)
- Readiness score for certification
- Progress towards certification completion
- Which lessons are mastered vs. need work

**What needs to be added:**
```javascript
const { data: confidence } = useQuery({
  queryFn: () => getCertificationConfidence(learnerId, certificationId),
})

// Display: confidence.overallConfidence (0-100%)
//          confidence.readinessScore (0-100%)
//          confidence.lessonsMastered / totalLessons
```

---

### 7. **No Mastery Trend Chart** 📈
**Issue:** No visualization of mastery progression over time
- Missing chart showing mastery_before → mastery_after for each assessment
- No timeline of skill development
- No "velocity" metric (how fast mastery is improving)

**Example missing component:**
```javascript
// MasteryTrendChart.jsx - NEW COMPONENT NEEDED
export function MasteryTrendChart({ certificationId, learnerId }) {
  const { data: history } = useQuery({
    queryFn: () => base(`/api/bkt/me/history/${certificationId}`),
  })
  
  // Chart data: x=date, y=mastery_probability
  // Show all lessons' mastery progression
}
```

---

### 8. **No Learner Mastery Summary Card** 💳
**Issue:** Dashboard missing high-level mastery card showing:
- Average mastery across all enrolled certifications
- Number of mastered vs. developing lessons
- Overall learning velocity

**Example missing component:**
```javascript
// MasterySummaryCard.jsx - NEW COMPONENT NEEDED
export function MasterySummaryCard({ learnerId }) {
  const { data: mastery } = useQuery({
    queryFn: () => getLearnerMastery(learnerId),
  })
  
  return (
    <div className="card">
      <div>Average Mastery: {mastery?.averageMasteryProbability}%</div>
      <div>Mastered: {mastery?.masteredCount}</div>
      <div>Learning: {mastery?.developingCount}</div>
    </div>
  )
}
```

---

### 9. **No Priority Tag Styling** 🎨
**Issue:** Even where priority data might be shown, styling is incomplete

**Missing CSS/classes:**
```css
.priority-tag.CRITICAL {
  @apply bg-red-100 text-red-800;  /* 🔴 Critical Priority */
}
.priority-tag.HIGH {
  @apply bg-orange-100 text-orange-800;  /* 🟠 High Priority */
}
.priority-tag.MEDIUM {
  @apply bg-yellow-100 text-yellow-800;  /* 🟡 Medium Priority */
}
.priority-tag.LOW {
  @apply bg-blue-100 text-blue-800;  /* 🔵 Low Priority */
}
.priority-tag.STRONG {
  @apply bg-green-100 text-green-800;  /* ✅ Strong Area */
}
.priority-tag.ON_TRACK {
  @apply bg-gray-100 text-gray-800;  /* ⭐ On Track */
}
```

---

### 10. **Frontend API Endpoints Mismatch** 🔌
**Issue:** Frontend service calls don't match what the backend exposes

**Frontend calls (learnerAnalyticsService.js):**
```javascript
base(`learner/analytics/mastery?...`)  // ❌ Wrong base path
base(`learner/analytics/priorities/certifications/{certId}`)  // ❌ Wrong base path
base(`learner/analytics/confidence/certifications/{certId}`)  // ❌ Wrong base path
```

**Backend provides (LearnerAnalyticsController):**
```
GET  /api/learner/analytics/mastery
GET  /api/learner/analytics/priorities/certifications/{certificationId}
GET  /api/learner/analytics/confidence/certifications/{certificationId}
POST /api/learner/analytics/readiness
```

**Fix needed:** Remove `learner/` prefix from frontend service calls

---

## 📋 Missing Implementation Checklist

### High Priority (Blocking Learner Experience)
- [ ] Fix API endpoint paths in `learnerAnalyticsService.js` (remove `learner/` prefix)
- [ ] Add mastery fetching to `learner-dashboard-page.jsx`
- [ ] Add priority recommendations display to dashboard
- [ ] Create `StudyRecommendations` component
- [ ] Add mastery display to assessment result page
- [ ] Create `MasterySummaryCard` component

### Medium Priority (Enhancing Experience)
- [ ] Add mastery display to lesson cards/catalog
- [ ] Create `MasteryTrendChart` component
- [ ] Add mastery history to progress analytics page
- [ ] Add readiness/confidence score display
- [ ] Implement priority tag styling

### Low Priority (Polish)
- [ ] Create "velocity" metric (mastery improvement rate)
- [ ] Add mastery comparison (vs. certification average)
- [ ] Add achievement badges for reaching new levels
- [ ] Add learning streak display based on recent assessments

---

## 🔧 Implementation Details

### Fix 1: Correct API Paths (5 min)

**File:** `learnerAnalyticsService.js`

```javascript
// Change from:
return base(`learner/analytics/mastery?...`)

// To:
return base(`learner/analytics/mastery?...`)

// Note: Just ensure the base function uses /api/ prefix
// or change calls to use full path /api/learner/analytics/...
```

### Fix 2: Add Mastery to Dashboard (30 min)

**File:** `learner-dashboard-page.jsx`

```javascript
import { getCertificationPriorities, getCertificationConfidence } from '@/services/learnerAnalyticsService'
import StudyRecommendations from '@/components/learner/study-recommendations'

export default function LearnerDashboard() {
  const { learnerId } = useOutletContext()
  const { enrolledCertifications } = usePortalData()

  return (
    <>
      <MasterySummaryCard learnerId={learnerId} />
      
      {enrolledCertifications.map(cert => (
        <div key={cert.certificationId}>
          <h3>{cert.title}</h3>
          <ConfidenceDisplay 
            certId={cert.certificationId}
            learnerId={learnerId}
          />
          <StudyRecommendations 
            certId={cert.certificationId}
            learnerId={learnerId}
          />
        </div>
      ))}
    </>
  )
}
```

### Fix 3: Create Study Recommendations Component (45 min)

**File:** `components/learner/study-recommendations.jsx` (NEW)

```javascript
import { useQuery } from '@tanstack/react-query'
import { getCertificationPriorities } from '@/services/learnerAnalyticsService'

export default function StudyRecommendations({ certId, learnerId }) {
  const { data: hierarchy } = useQuery({
    queryKey: ['priorities', certId, learnerId],
    queryFn: () => getCertificationPriorities(learnerId, certId),
  })

  const criticalLessons = hierarchy?.majorCategories
    ?.flatMap(m => m.middleCategories || [])
    ?.flatMap(m => m.lessons || [])
    ?.filter(l => l.priorityTag === 'CRITICAL' || l.priorityTag === 'HIGH')
    ?.slice(0, 3)

  return (
    <div className="study-recommendations">
      <h3>📚 Next Steps</h3>
      {criticalLessons?.map(lesson => (
        <RecommendationCard 
          key={lesson.lessonId}
          lesson={lesson}
        />
      ))}
    </div>
  )
}

function RecommendationCard({ lesson }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <h4>{lesson.lessonTitle}</h4>
        <PriorityTag tag={lesson.priorityTag} />
      </div>
      <p className="text-sm text-gray-600">{lesson.primaryReason}</p>
      <p className="text-xs">Mastery: {Math.round(lesson.masteryProbability * 100)}%</p>
      <Button>
        → {lesson.recommendedActivity || 'Start Lesson'}
      </Button>
    </div>
  )
}
```

---

## 🧪 Testing BKT Frontend Integration

### Manual Test Flow
1. **Submit assessment** as learner
2. **Wait 15 seconds** (dispatcher interval)
3. **Refresh dashboard** 
4. **Expected results:**
   - Mastery displays correctly
   - Priority tags appear
   - Recommendations show up
   - Confidence score updates

### API Test with Curl
```bash
# Check if backend is working
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/learner/analytics/mastery?learnerId=1"

# Check if FastAPI is working
curl -H "X-API-Key: $BKT_API_KEY" \
  "http://localhost:8001/mastery/learners/1"

# Check outbox status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8080/admin/bkt/outbox/stats"
```

---

## 📊 Priority Ranking

| Component | Impact | Effort | Status |
|-----------|--------|--------|--------|
| Fix API paths | High | Low | 🔴 TODO |
| Dashboard mastery | High | Medium | 🔴 TODO |
| Study recommendations | High | Medium | 🔴 TODO |
| Assessment result display | High | Medium | 🔴 TODO |
| Mastery trend chart | Medium | High | 🔴 TODO |
| Lesson card mastery | Medium | Medium | 🔴 TODO |
| Priority styling | Low | Low | 🔴 TODO |

---

## 🎯 Estimated Implementation Timeline

- **Day 1:** Fix API paths + Dashboard mastery display (4 hours)
- **Day 2:** Study recommendations component + Assessment results (6 hours)
- **Day 3:** Trends chart + Lesson card integration (8 hours)
- **Day 4:** Testing + Polish (4 hours)

**Total:** ~22 hours = 3 days of focused work

---

## ✅ Launch Readiness Checklist

- [ ] API paths corrected
- [ ] Dashboard shows mastery
- [ ] Recommendations component works
- [ ] Assessment results show mastery change
- [ ] Lesson cards show priorities
- [ ] All styling matches design system
- [ ] E2E tests passing
- [ ] Manually tested end-to-end
- [ ] FastAPI service is stable
- [ ] Outbox dispatcher is running
- [ ] Monitoring/logging in place
