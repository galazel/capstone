# PHASE 6: Post-Launch Essentials (First Month)

**Goal:** Critical features needed within first month of launch based on user feedback.
**Effort:** 15-20 hours
**Timeline:** 2-3 weeks post-launch
**Status:** High priority after launch

## Overview

PHASE 6 adds features that users will immediately request based on PHASE 1-5 foundation. These are "must-haves" but not launch blockers.

---

## Tasks (5 total)

### Task 1: Real-Time Notifications System (3 hrs)
**Priority:** P1 - HIGH

**Current:** Polling every 30 seconds
**New:** WebSocket + Server-Sent Events

**Architecture:**
```
User Action (e.g., comment) 
  → Backend stores event
  → Broadcasts via WebSocket
  → Real-time update on listener's page
```

**Implementation:**
```java
// NotificationWebSocketHandler.java
@Component
public class NotificationWebSocketHandler {
  private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

  @Override
  public void afterConnectionEstablished(WebSocketSession session) throws Exception {
    Long userId = extractUserId(session);
    sessions.put(userId.toString(), session);
  }

  public void broadcastNotification(Long learnerId, NotificationEvent event) {
    WebSocketSession session = sessions.get(learnerId.toString());
    if (session != null && session.isOpen()) {
      session.sendMessage(new TextMessage(toJson(event)));
    }
  }
}

// Frontend
useEffect(() => {
  const ws = new WebSocket('wss://api.rebyu.com/api/ws/notifications')
  ws.onmessage = (event) => {
    const notification = JSON.parse(event.data)
    setNotifications(prev => [notification, ...prev])
  }
  return () => ws.close()
}, [])
```

**Deliverables:**
- ✅ WebSocket handler (Java)
- ✅ Frontend WebSocket client hook
- ✅ Notification event types
- ✅ Connection management
- ✅ Fallback to polling if WS unavailable

**Done When:** Comments appear instantly without page refresh

---

### Task 2: File Upload & S3 Integration (2.5 hrs)
**Priority:** P1 - HIGH

**Current:** Stubbed in team workspace
**New:** Full S3 upload with virus scanning

**Implementation:**
```java
// FileUploadService.java
@Service
public class FileUploadService {
  @Autowired private AmazonS3 s3Client;
  @Autowired private ClamAVClient clamav;

  @Transactional
  public String uploadFile(MultipartFile file, Long orgId) throws IOException {
    // Virus scan
    byte[] bytes = file.getBytes();
    if (clamav.isMalicious(bytes)) {
      throw new SecurityException("File failed virus scan");
    }

    // Upload to S3
    String key = "orgs/" + orgId + "/" + UUID.randomUUID() + "/" + file.getOriginalFilename();
    s3Client.putObject(BUCKET, key, bytes);

    // Return signed URL (valid 1 hour)
    return s3Client.generatePresignedUrl(BUCKET, key, new Date()).toExternalForm();
  }

  public void deleteFile(String key) {
    s3Client.deleteObject(BUCKET, key);
  }
}

// Frontend
export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const upload = async (file) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/api/files/upload', formData, {
        onUploadProgress: (e) => setProgress(Math.round((e.loaded / e.total) * 100))
      })
      return res.data.url
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, progress }
}
```

**Deliverables:**
- ✅ FileUploadService with S3 integration
- ✅ ClamAV virus scanning
- ✅ Signed URLs for secure access
- ✅ File deletion
- ✅ Upload progress tracking
- ✅ useFileUpload React hook

**Done When:** Users can upload files to team workspace

---

### Task 3: Email Notifications (2 hrs)
**Priority:** P1 - HIGH

**Types:**
1. Daily learning reminder (configurable time)
2. Streak expiration warning (24 hrs before reset)
3. Achievement earned (new badge, certification)
4. Comment on your post (team member comment)
5. Weekly digest (top learners, activities)

**Implementation:**
```java
// EmailNotificationService.java
@Service
public class EmailNotificationService {
  @Autowired private EmailService emailService;
  @Autowired private NotificationPreferenceRepository prefRepository;
  @Autowired private LearnerRepository learnerRepository;

  @Scheduled(cron = "0 9 * * *")  // Daily at 9 AM
  public void sendDailyReminders() {
    List<NotificationPreference> prefs = prefRepository.findByDailyReminderTrue();
    for (NotificationPreference pref : prefs) {
      Learner learner = pref.getLearner();
      emailService.sendDailyReminder(learner.getEmail(), learner.getFirstName());
    }
  }

  @Scheduled(cron = "0 12 * * *")  // Daily at noon
  public void checkStreakExpiration() {
    List<Streak> expiring = streakRepository.findStreaksExpiringToday();
    for (Streak streak : expiring) {
      emailService.sendStreakWarning(streak.getLearner().getEmail());
    }
  }
}
```

**Deliverables:**
- ✅ EmailNotificationService with scheduled jobs
- ✅ Email templates (5 types)
- ✅ Preference-aware sending (respects opt-outs)
- ✅ Digest generation
- ✅ Scheduler configuration

**Done When:** Users receive daily reminder emails

---

### Task 4: Advanced Analytics & Reports (3 hrs)
**Priority:** P1 - HIGH

**Analytics to Build:**
- Custom date range reporting
- Cohort analysis (by org, team, certification)
- Skills gap analysis (what skills are weak)
- Time-to-competency metrics
- ROI calculation (hours invested vs. certs earned)
- Export to CSV/PDF with charts

**Implementation:**
```java
// AnalyticsService.java
@Service
public class AnalyticsService {
  public class CohortMetrics {
    public int totalLearners;
    public double completionRate;
    public double averageScore;
    public double averageTimeToCompletion;
  }

  public CohortMetrics analyzeCohort(Long orgId, LocalDate startDate, LocalDate endDate) {
    List<Learner> cohort = learnerRepository.findByOrg(orgId)
        .filter(l -> l.getCreatedAt().toLocalDate().isBetween(startDate, endDate))
        .collect(toList());

    int totalLearners = cohort.size();
    double completionRate = calculateCompletionRate(cohort);
    double averageScore = calculateAverageScore(cohort);
    double timeToCompletion = calculateTimeToCompletion(cohort);

    return new CohortMetrics(totalLearners, completionRate, averageScore, timeToCompletion);
  }

  public void exportReport(Long orgId, LocalDate start, LocalDate end, String format) {
    // Format: CSV or PDF
    // Generate charts, tables, summary
  }
}
```

**Deliverables:**
- ✅ AnalyticsService with cohort analysis
- ✅ Report generator (CSV, PDF)
- ✅ Chart generation (Recharts)
- ✅ Advanced filter UI
- ✅ Custom report builder

**Done When:** Orgs can generate custom analytics reports

---

### Task 5: Bulk Email Campaigns (2.5 hrs)
**Priority:** P1 - HIGH

**Features:**
- Send email to all org members
- Targeted by role (admin, manager, member)
- Filtered by activity (inactive users only)
- Template selection + personalization
- Track opens + clicks
- Schedule for future send

**Implementation:**
```java
// EmailCampaignService.java
@Service
public class EmailCampaignService {
  @Transactional
  public void createCampaign(EmailCampaign campaign) {
    // Save campaign
    Long campaignId = campaignRepository.save(campaign).getId();

    // Find recipients
    List<Learner> recipients = learnerRepository.findByFilters(
      campaign.getOrgId(),
      campaign.getTargetRoles(),
      campaign.getActivityFilter()
    );

    // Queue emails (async)
    for (Learner learner : recipients) {
      emailQueueService.enqueue(new EmailJob(campaignId, learner.getEmail()));
    }
  }

  @Scheduled(fixedRate = 60000)  // Every minute
  public void processEmailQueue() {
    List<EmailJob> jobs = emailQueueRepository.findPending(1000);
    for (EmailJob job : jobs) {
      try {
        emailService.send(job);
        job.setStatus("SENT");
      } catch (Exception e) {
        job.setRetries(job.getRetries() + 1);
        if (job.getRetries() > 3) {
          job.setStatus("FAILED");
        }
      }
      emailQueueRepository.save(job);
    }
  }
}
```

**Deliverables:**
- ✅ EmailCampaignService
- ✅ Campaign creation UI
- ✅ Template selection
- ✅ Recipient filtering
- ✅ Email queue + retry logic
- ✅ Campaign analytics (opens, clicks)

**Done When:** Admins can send bulk emails to org members

---

## Success Criteria

✅ Notifications appear instantly (WebSocket)
✅ Users can upload files to workspace
✅ Daily reminder emails sent
✅ Analytics reports generated
✅ Bulk campaigns working
✅ User retention improved (based on emails/notifications)

---

## Timeline

**Week 1 Post-Launch:**
- Task 1: WebSocket notifications
- Task 3: Email reminders start

**Week 2:**
- Task 2: File upload
- Task 4: Analytics reports

**Week 3:**
- Task 5: Bulk campaigns
- Polish + refinement

---

**PHASE 6 = User satisfaction & engagement boosts**
