package com.capstone.rebyu.admin.repository;

import com.capstone.rebyu.admin.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
  List<AuditLog> findByTimestampAfterOrderByTimestampDesc(LocalDateTime since);
  List<AuditLog> findByUserIdOrderByTimestampDesc(Long userId);
  List<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(String entityType, Long entityId);
}
