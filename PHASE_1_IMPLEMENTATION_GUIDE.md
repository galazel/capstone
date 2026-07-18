# PHASE 1 Implementation Guide - Remaining Tasks

**Status:** 2/7 Done (Dashboard, Profile Management)  
**Remaining:** 5 tasks  
**Estimated Total Time:** ~14 hours for all 7 tasks

---

## ✅ COMPLETED

### Task 1: Dashboard ✅
- **Files:** `learner-dashboard-page.jsx`
- **Status:** Ready to test at `/learner/dashboard`
- **Data:** Pulls from `/api/learners/me/portal`

### Task 2: Profile Management ✅
- **Backend:** `LearnerProfileService`, `LearnerProfileController`
- **Frontend:** `profileService.js` (service methods created)
- **Endpoints:**
  - `PUT /api/learners/me` - Update profile
  - `POST /api/learners/me/change-password` - Change password
  - `DELETE /api/learners/me` - Delete account
- **Next:** Wire forms in `learner-account-page.jsx`

---

## 🔲 READY TO IMPLEMENT

### Task 3: Assessment Attempt - Full Flow (4 hours)

**What to do:**
1. **Enhance backend** `AssessmentAttemptService`:
   - ✅ Already exists, verify endpoints:
     ```
     POST /api/exams/{id}/attempt (start)
     GET /api/exams/{id}/attempt/{attemptNo} (get current)
     POST /api/exams/{id}/attempt/{attemptNo}/submit (submit answers)
     GET /api/exam-results/{learnerId}/{examId}/{attemptNo} (get results)
     ```

2. **Frontend** `learner-assessment-attempt-page.jsx`:
   ```javascript
   // On load: Fetch attempt, start timer
   const attempt = await api.get(`/exams/${examId}/attempt/${attemptNo}`)
   
   // On submit: POST answers
   await api.post(`/exams/${examId}/attempt/${attemptNo}/submit`, {
     answers: [{ questionId, answer, timeSpent }]
   })
   
   // Show results
   const results = await api.get(`/exam-results/...`)
   // Display: score, correct/incorrect, explanations, retry button
   ```

3. **Key features:**
   - Timer countdown (disable submit until answered)
   - Submit button handler
   - Results page with score and feedback
   - "Retry" and "Review lesson" buttons

**Files to update:**
- `backend-java/src/main/java/com/capstone/rebyu/assessment/service/AssessmentAttemptService.java`
- `frontend/src/pages/learner/learner-assessment-attempt-page.jsx`
- `frontend/src/pages/learner/learner-assessment-result-page.jsx`

---

### Task 4: Lesson Completion - Progress Update (2 hours)

**What to do:**
1. **Verify backend** `LessonService`:
   ```
   POST /api/lessons/{lessonId}/complete
   - Marks lesson completed
   - Calculates progress
   - Fires BKT event if needed
   - Returns updated progress
   ```

2. **Frontend** - Add completion callback:
   ```javascript
   // When lesson complete button clicked:
   await api.post(`/lessons/${lessonId}/complete`)
   // Show checkmark, progress animation
   toast.success('Lesson completed! +10 XP')
   // Refetch dashboard
   ```

3. **Key features:**
   - "Mark Complete" button on lesson page
   - Success toast with XP gain
   - Progress bar animation on dashboard
   - BKT event fires automatically

**Files:**
- `backend-java/src/main/java/com/capstone/rebyu/certification/service/LessonService.java`
- `frontend/src/pages/learner/learner-lesson-page.jsx`

---

### Task 5: BKT Frontend - Mastery Visualization (4 hours)

**What to do:**
1. **Backend** - Update `LearnerPortalService` to return real BKT data:
   ```java
   // In portal() method:
   Map<Long, Integer> masteryByCertification = new HashMap<>();
   for (LearnerCertification cert : certs) {
       Integer mastery = bktService.getMasteryLevel(learnerId, cert.getCertificationId());
       masteryByCertification.put(cert.getCertificationId(), mastery);
   }
   // Include in DTO
   ```

2. **Frontend** - Display mastery on dashboard:
   ```javascript
   // In certification card:
   const mastery = portalData?.masteryByMasteryByCertification[cert.certificationId]
   const levels = ['Not Started', 'Familiarity', 'Beginning', 'Intermediate', 'Mastery']
   const colors = ['gray', 'yellow', 'orange', 'blue', 'green']
   
   <div className={`bg-${colors[mastery]}-500 px-2 py-1 rounded`}>
     {levels[mastery]}
   </div>
   ```

3. **Key features:**
   - Color-coded mastery levels (0-4)
   - Progress indicators on each cert
   - Show on dashboard, cert detail, lesson pages
   - Update after quiz completion

**Files:**
- `backend-java/src/main/java/com/capstone/rebyu/user/service/LearnerPortalService.java`
- `frontend/src/pages/learner/learner-dashboard-page.jsx`

---

### Task 6: Notifications - Read/Unread (2 hours)

**What to do:**
1. **Backend** - Endpoints already exist, verify:
   ```
   GET /api/community/notifications (fetch)
   PUT /api/community/notifications/{id}/read (mark read)
   ```

2. **Frontend** - Create notifications panel:
   ```javascript
   // src/components/notifications-panel.jsx
   const [notifications, setNotifications] = useState([])
   
   useEffect(() => {
       api.get('/community/notifications')
           .then(r => setNotifications(r.data))
   }, [])
   
   const markAsRead = async (id) => {
       await api.put(`/community/notifications/${id}/read`)
       setNotifications(prev => prev.map(n => 
           n.id === id ? {...n, read: true} : n
       ))
   }
   ```

3. **Key features:**
   - Toast/sidebar for notifications
   - Unread badge count
   - Click to mark read
   - Filter: All vs. Unread
   - Real-time updates (optional)

**Files:**
- `frontend/src/components/notifications-panel.jsx`
- `frontend/src/services/notificationService.js`
- `frontend/src/layouts/learner-layout.jsx` (add panel)

---

### Task 7: Community - Edit & Delete Posts (2 hours)

**What to do:**
1. **Backend** - Add endpoints to `CommunityController`:
   ```
   PUT /api/community/posts/{id} (edit)
   DELETE /api/community/posts/{id} (delete)
   
   // Validate: only post author can edit/delete
   ```

2. **Frontend** - Add buttons to posts:
   ```javascript
   // On community feed, for own posts:
   {post.ownedByMe && (
       <>
           <Button onClick={() => setEditingPost(post)}>Edit</Button>
           <Button onClick={() => deletePost(post.id)}>Delete</Button>
       </>
   )}
   
   // Edit modal
   <Modal open={editingPost}>
       <Input value={editingPost.title} onChange={...} />
       <textarea value={editingPost.body} onChange={...} />
       <Button onClick={saveEdit}>Save</Button>
   </Modal>
   
   // Delete confirmation
   <Dialog>Delete post?
       <Button onClick={confirmDelete}>Confirm</Button>
   </Dialog>
   ```

3. **Key features:**
   - Edit button (only for own posts)
   - Delete button with confirmation
   - Update feed after edit/delete
   - Validation: own posts only

**Files:**
- `backend-java/src/main/java/com/capstone/rebyu/community/CommunityService.java`
- `frontend/src/pages/learner/learner-community-qa.jsx`

---

## 📋 Implementation Checklist

### Backend Tasks
- [ ] Task 3: Verify assessment endpoints exist
- [ ] Task 4: Add lesson completion endpoint
- [ ] Task 5: Get BKT mastery levels in portal
- [ ] Task 6: Notification endpoints (should exist)
- [ ] Task 7: Add edit/delete post endpoints

### Frontend Tasks
- [ ] Task 2: Wire profile forms to `profileService.js`
- [ ] Task 3: Complete assessment flow UI
- [ ] Task 4: Add lesson complete button
- [ ] Task 5: Display mastery levels
- [ ] Task 6: Create notifications panel
- [ ] Task 7: Add edit/delete UI to posts

### Testing Checklist
- [ ] Dashboard loads with real data
- [ ] Profile updates save correctly
- [ ] Can complete a quiz end-to-end
- [ ] Lesson completion updates progress
- [ ] BKT mastery shows on dashboard
- [ ] Notifications appear and mark as read
- [ ] Can edit own posts
- [ ] Can delete own posts

---

## 🚀 Quick Start for Each Task

**Task 3 (Assessment):**
```bash
# Test endpoint
curl -X POST http://localhost:8080/api/exams/1/attempt/1/submit \
  -H "Authorization: Bearer <token>" \
  -d '{"answers": [{"questionId": 1, "answer": "A"}]}'
```

**Task 4 (Lesson):**
```bash
# Test endpoint
curl -X POST http://localhost:8080/api/lessons/1/complete \
  -H "Authorization: Bearer <token>"
```

**Task 5 (BKT):**
Check `/api/learners/me/portal` response - should include `masteryByMasteryByCertification`

**Task 6 (Notifications):**
```bash
# Test endpoint
curl http://localhost:8080/api/community/notifications \
  -H "Authorization: Bearer <token>"
```

**Task 7 (Community):**
```bash
# Test endpoint
curl -X PUT http://localhost:8080/api/community/posts/1 \
  -d '{"title": "Updated", "body": "New content"}' \
  -H "Authorization: Bearer <token>"
```

---

## 📊 Effort Remaining

| Task | Backend | Frontend | Total | Status |
|------|---------|----------|-------|--------|
| Assessment | 1 hr | 3 hrs | 4 hrs | 🔲 |
| Lesson | 1 hr | 1 hr | 2 hrs | 🔲 |
| BKT | 1 hr | 3 hrs | 4 hrs | 🔲 |
| Notifications | 0.5 hr | 1.5 hrs | 2 hrs | 🔲 |
| Community Edit | 1 hr | 1 hr | 2 hrs | 🔲 |
| **TOTAL** | **~4.5 hrs** | **~9.5 hrs** | **~14 hrs** | |

Plus 2 hours for Task 2 (profile) frontend wiring = **16 hours total for all 7 tasks**

---

## 🎯 Next Steps

1. Wire Task 2 (Profile) frontend forms
2. Implement Task 3 (Assessment) - highest complexity
3. Quick wins: Task 4, 6, 7
4. Final: Task 5 (BKT) visualization

All backend and frontend scaffolding is in place. Each task is ready for implementation!
