package com.capstone.rebyu.bkt.service;

import com.capstone.rebyu.bkt.client.BktClient;
import com.capstone.rebyu.bkt.client.BktServiceException;
import com.capstone.rebyu.bkt.config.BktProperties;
import com.capstone.rebyu.bkt.dto.BktMasteryEvent;
import com.capstone.rebyu.bkt.dto.BktMasteryEventBatch;
import com.capstone.rebyu.bkt.entity.BktEventOutbox;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Polls the BKT outbox and forwards claimed batches to the FastAPI service.
 *
 * <p>Runs outside any submission transaction, so an unavailable BKT service can
 * never roll back a completed assessment. Claiming uses SKIP LOCKED, so multiple
 * backend instances cooperate safely. Delivery failures back off exponentially
 * and eventually dead-letter.
 */
@Slf4j
@Component
public class BktEventDispatcher {

    private final BktOutboxService outboxService;
    private final BktClient bktClient;
    private final BktProperties properties;
    private final ObjectMapper objectMapper;
    private final String workerId;

    public BktEventDispatcher(BktOutboxService outboxService,
                              BktClient bktClient,
                              BktProperties properties,
                              ObjectMapper objectMapper) {
        this.outboxService = outboxService;
        this.bktClient = bktClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.workerId = resolveWorkerId();
    }

    @Scheduled(
            fixedDelayString = "${bkt.dispatch-interval-ms:10000}",
            initialDelayString = "${bkt.dispatch-initial-delay-ms:15000}")
    public void dispatchPending() {
        if (!properties.isEnabled()) {
            return;
        }

        List<BktEventOutbox> claimed;
        try {
            claimed = outboxService.claimBatch(properties.getDispatchBatchSize(), workerId);
        } catch (Exception e) {
            log.warn("BKT outbox claim failed: {}", e.getMessage());
            return;
        }
        if (claimed.isEmpty()) {
            return;
        }

        List<Long> ids = new ArrayList<>(claimed.size());
        List<BktMasteryEvent> events = new ArrayList<>(claimed.size());
        List<Long> undeserializable = new ArrayList<>();
        for (BktEventOutbox row : claimed) {
            ids.add(row.getId());
            try {
                events.add(objectMapper.readValue(row.getPayloadJson(), BktMasteryEvent.class));
            } catch (Exception e) {
                undeserializable.add(row.getId());
            }
        }

        // A corrupt payload can never succeed; dead-letter it directly instead
        // of burning through the normal retry/backoff cycle for a failure
        // that retrying can never fix.
        if (!undeserializable.isEmpty()) {
            outboxService.markDeadLetter(undeserializable, "Unparseable outbox payload");
            ids.removeAll(undeserializable);
            events = deserializeRemaining(claimed, undeserializable);
        }
        if (events.isEmpty()) {
            return;
        }

        try {
            bktClient.sendBatch(new BktMasteryEventBatch(events));
            outboxService.markProcessed(ids);
            log.info("BKT dispatch: {} event(s) processed by worker {}", ids.size(), workerId);
        } catch (BktServiceException e) {
            outboxService.markRetry(ids, e.getMessage());
            log.warn("BKT dispatch failed for {} event(s), will retry: {}",
                    ids.size(), e.getMessage());
        }
    }

    private List<BktMasteryEvent> deserializeRemaining(
            List<BktEventOutbox> claimed, List<Long> excludedIds) {
        List<BktMasteryEvent> events = new ArrayList<>();
        for (BktEventOutbox row : claimed) {
            if (excludedIds.contains(row.getId())) {
                continue;
            }
            try {
                events.add(objectMapper.readValue(row.getPayloadJson(), BktMasteryEvent.class));
            } catch (Exception ignored) {
                // already dead-lettered above
            }
        }
        return events;
    }

    private static String resolveWorkerId() {
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            host = "unknown-host";
        }
        return host + ":" + UUID.randomUUID().toString().substring(0, 8);
    }
}
