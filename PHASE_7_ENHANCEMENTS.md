# PHASE 7: Enhancement Features (Months 2-3)

**Goal:** Advanced features that differentiate REBYU from competitors.
**Effort:** 20-25 hours
**Timeline:** 4-6 weeks
**Status:** Post-launch enhancement

## Overview

PHASE 7 adds power-user features and competitive differentiation based on post-launch metrics and user feedback.

---

## Tasks (6 total)

### Task 1: AI Study Plan Enhancement (3 hrs)
**Priority:** P2

**Current:** Stubbed (returns mock schedule)
**New:** Full LangChain4j integration with GPT-4 backend

**Implementation:**
```java
// StudyPlanAIService.java
@Service
public class StudyPlanAIService {
  @Autowired private LangChain4jChatModel chatModel;

  public StudyPlanSchedule generatePlan(String goal, String background, int durationWeeks) {
    String prompt = """
      Create a detailed %d-week study plan for: %s
      Learner background: %s
      
      Output format:
      Week 1: [activities]
      Week 2: [activities]
      ...
      
      Include:
      - Daily study time recommendations
      - Resource suggestions
      - Milestone checkpoints
      - Difficulty progression
      """.formatted(durationWeeks, goal, background);

    String response = chatModel.generate(prompt);
    return parseSchedule(response);
  }

  public void personalizeBasedOnProgress(StudyPlan plan, Learner learner) {
    // Adjust based on learner's pace
    // Skip already-mastered topics
    // Add remedial sections for weak areas
  }
}
```

**Deliverables:**
- ✅ LangChain4j integration with GPT-4
- ✅ Smart schedule generation
- ✅ Personalization based on learner history
- ✅ Weekly plan adjustments
- ✅ Difficulty scaling

**Done When:** AI generates personalized study plans

---

### Task 2: Third-Party Integrations (4 hrs)
**Priority:** P2

**Integrations:**
1. **Canvas LMS** - Import courses + sync grades
2. **Google Classroom** - Sync classroom + assignments
3. **Slack** - Course notifications + daily reminders
4. **Salesforce** - Sync enterprise learner data
5. **Azure AD/Okta** - SSO + user provisioning

**Implementation:**
```java
// CanvasIntegrationService.java
@Service
public class CanvasIntegrationService {
  @Autowired private CanvasClient canvasClient;

  @Transactional
  public void syncCourseFromCanvas(String canvasInstanceUrl, String apiToken) {
    // 1. Fetch courses from Canvas API
    List<CanvasCourse> courses = canvasClient.getCourses(apiToken);

    // 2. Create in REBYU
    for (CanvasCourse canvas : courses) {
      Certification cert = new Certification();
      cert.setName(canvas.getName());
      cert.setDescription(canvas.getDescription());
      cert.setExternalId("canvas_" + canvas.getId());
      certificationRepository.save(cert);
    }

    // 3. Sync enrollments
    // 4. Sync grades
  }
}

// Google Classroom
// Slack notifications
// SSO via Spring Security + SAML
```

**Deliverables:**
- ✅ Canvas API integration
- ✅ Google Classroom sync
- ✅ Slack notification channel
- ✅ SSO setup (Okta/Azure AD)
- ✅ User provisioning

**Done When:** Enterprise clients can connect external systems

---

### Task 3: Gamification Advanced Features (3 hrs)
**Priority:** P2

**Features:**
1. **Badges System** - Earn badges for achievements
2. **Leaderboard Tiers** - Bronze/Silver/Gold ranks
3. **Team Challenges** - Compete by department
4. **Reward Redemption** - Spend coins on perks
5. **Achievements** - Hidden unlocks

**Implementation:**
```java
// BadgeService.java
@Service
public class BadgeService {
  public enum BadgeType {
    FIRST_ASSESSMENT, CERTIFICATION_EARNED, STREAK_7, STREAK_30,
    TOP_10_LEARNER, HELPFUL_COMMENT, COURSE_MASTER
  }

  @Transactional
  public void awardBadge(Long learnerId, BadgeType type) {
    LearnerBadge badge = new LearnerBadge();
    badge.setLearner(learnerRepository.findById(learnerId).orElseThrow());
    badge.setType(type);
    badge.setAwardedAt(LocalDateTime.now());
    badgeRepository.save(badge);

    // Notify learner
    notificationService.sendBadgeNotification(learnerId, type);
  }

  @Scheduled(cron = "0 0 * * *")  // Daily
  public void checkAndAwardBadges() {
    // Award FIRST_ASSESSMENT
    // Award CERTIFICATION badges
    // Award STREAK badges
    // Award TOP_10_LEARNER badges
  }
}

// RewardRedemptionService
@Service
public class RewardRedemptionService {
  public void redeemReward(Long learnerId, Reward reward) {
    Learner learner = learnerRepository.findById(learnerId).orElseThrow();
    if (learner.getCoinBalance() < reward.getCostInCoins()) {
      throw new InsufficientCoinsException();
    }

    learner.setCoinBalance(learner.getCoinBalance() - reward.getCostInCoins());
    // Apply reward (e.g., unlock premium content)
  }
}
```

**Deliverables:**
- ✅ Badge system with 10+ badge types
- ✅ Leaderboard ranking tiers
- ✅ Team challenge feature
- ✅ Reward catalog + redemption
- ✅ Achievement tracking
- ✅ Badge notification emails

**Done When:** Users can earn and redeem badges

---

### Task 4: Mobile App - React Native (5 hrs)
**Priority:** P2 (Major feature)

**Platforms:** iOS + Android

**Screens:**
1. Auth (login, signup, password reset)
2. Dashboard (learner stats, quick actions)
3. Assessments (take quiz offline, sync on reconnect)
4. Study Plans (view + track progress)
5. Leaderboard (view rankings)
6. Profile (settings, preferences)
7. Notifications (push + in-app)

**Tech Stack:**
- React Native (shared code iOS/Android)
- Expo (dev setup)
- Redux (state management)
- React Navigation (routing)
- AsyncStorage (offline data)
- React Native Push Notifications

**Implementation:**
```javascript
// App.js
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Assessment" component={AssessmentScreen} />
        <Stack.Screen name="StudyPlans" component={StudyPlansScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

// Offline sync
const useOfflineSync = () => {
  const [queued, setQueued] = useState([])

  const queueAction = async (action) => {
    const stored = await AsyncStorage.getItem('queue')
    const queue = stored ? JSON.parse(stored) : []
    queue.push(action)
    await AsyncStorage.setItem('queue', JSON.stringify(queue))
  }

  const syncWhenOnline = async () => {
    const queue = await AsyncStorage.getItem('queue')
    if (!queue) return

    for (const action of JSON.parse(queue)) {
      try {
        await api.post('/sync', action)
      } catch (e) {
        console.error('Sync failed:', e)
        break
      }
    }
    await AsyncStorage.removeItem('queue')
  }

  return { queueAction, syncWhenOnline }
}
```

**Deliverables:**
- ✅ React Native app (shared code)
- ✅ Offline-first architecture
- ✅ Push notifications
- ✅ iOS build + submission
- ✅ Android build + submission
- ✅ App Store + Google Play deployment

**Done When:** App published on both stores

---

### Task 5: Team Collaboration - Full Chat (3 hrs)
**Priority:** P2

**Features:**
1. **Direct Messages** - One-on-one conversations
2. **Channels** - Workspace discussion channels
3. **Threads** - Reply to specific messages
4. **File Sharing** - Send files in chat
5. **Mentions** - @username notifications
6. **Reactions** - Emoji responses
7. **Search** - Find messages by keyword
8. **Read Receipts** - See who's read messages

**Implementation:**
```java
// ChatService.java
@Service
public class ChatService {
  @Autowired private ChatMessageRepository messageRepository;
  @Autowired private ChatChannelRepository channelRepository;

  @Transactional
  public ChatMessage sendMessage(Long senderId, Long recipientId, String content) {
    ChatMessage msg = new ChatMessage();
    msg.setSender(learnerRepository.findById(senderId).orElseThrow());
    msg.setRecipient(learnerRepository.findById(recipientId).orElseThrow());
    msg.setContent(content);
    msg.setTimestamp(LocalDateTime.now());
    return messageRepository.save(msg);
  }

  public void broadcastMessage(ChatMessage msg) {
    // Broadcast via WebSocket to recipient(s)
  }
}

// Frontend
export function useChatChannel(channelId) {
  const [messages, setMessages] = useState([])
  const [ws, setWs] = useState(null)

  useEffect(() => {
    const socket = new WebSocket(`wss://api.rebyu.com/api/ws/chat/${channelId}`)
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      setMessages(prev => [...prev, msg])
    }
    setWs(socket)
    return () => socket.close()
  }, [channelId])

  return { messages, ws }
}
```

**Deliverables:**
- ✅ ChatMessage entity + repository
- ✅ Direct messaging service
- ✅ Channel messaging service
- ✅ WebSocket integration
- ✅ Message search
- ✅ Read receipt tracking
- ✅ Chat UI components

**Done When:** Users can chat in real-time

---

### Task 6: Compliance Features (2 hrs)
**Priority:** P2

**Features:**
1. **Data Export** - User can download all their data (GDPR)
2. **Data Deletion** - User can request deletion (GDPR right to be forgotten)
3. **Consent Management** - Track user consents
4. **Privacy Policy** - Interactive version control
5. **Terms Updates** - Force accept on login if changed
6. **Audit Report** - Generate SOC2 audit report

**Implementation:**
```java
// GDPRService.java
@Service
public class GDPRService {
  @Transactional
  public byte[] exportUserData(Long learnerId) throws IOException {
    Learner learner = learnerRepository.findById(learnerId).orElseThrow();

    // Collect all data
    Map<String, Object> data = new HashMap<>();
    data.put("profile", learner);
    data.put("assessments", learner.getAssessments());
    data.put("certifications", learner.getCertifications());
    data.put("notifications", notificationRepository.findByLearnerId(learnerId));
    data.put("audit_log", auditLogRepository.findByUserId(learnerId));

    // Export as JSON
    String json = objectMapper.writeValueAsString(data);
    return json.getBytes(StandardCharsets.UTF_8);
  }

  @Transactional
  public void deleteUserData(Long learnerId, String reason) {
    Learner learner = learnerRepository.findById(learnerId).orElseThrow();

    // Log deletion request
    auditLogRepository.save(new AuditLog(learnerId, "DATA_DELETION_REQUESTED", reason));

    // Hard delete user and related data (not soft delete)
    learnerRepository.hardDelete(learnerId);

    // 30-day retention before permanent delete
  }
}
```

**Deliverables:**
- ✅ Data export (GDPR)
- ✅ Data deletion (GDPR)
- ✅ Consent management
- ✅ Privacy policy versioning
- ✅ Audit report generation
- ✅ Compliance documentation

**Done When:** GDPR compliance verified

---

## Success Criteria

✅ AI generates smart study plans
✅ Third-party integrations working
✅ Advanced gamification features live
✅ Mobile app published
✅ Real-time team chat
✅ GDPR compliance verified

---

## Timeline

**Week 1-2:** Tasks 1-2 (AI + integrations)
**Week 3:** Task 3 (gamification)
**Week 4-5:** Task 4 (mobile app)
**Week 6:** Tasks 5-6 (chat + compliance)

---

**PHASE 7 = Competitive differentiation**
