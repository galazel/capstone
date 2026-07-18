package com.capstone.rebyu.admin.service;

import com.capstone.rebyu.admin.entity.AuditLog;
import com.capstone.rebyu.admin.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuditService {

  @Autowired private AuditLogRepository auditLogRepository;

  @Transactional
  public void logAction(Long userId, String action, String entityType, Long entityId, String details) {
    AuditLog log = new AuditLog();
    log.setUserId(userId);
    log.setAction(action);
    log.setEntityType(entityType);
    log.setEntityId(entityId);
    log.setDetails(details);
    log.setTimestamp(LocalDateTime.now());
    log.setIpAddress("unknown"); // Would extract from request context in real impl
    auditLogRepository.save(log);
  }

  public List<AuditLog> getAuditLog(int days) {
    LocalDateTime since = LocalDateTime.now().minusDays(days);
    return auditLogRepository.findByTimestampAfterOrderByTimestampDesc(since);
  }
}
