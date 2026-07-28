package com.capstone.rebyu.assessment.config;

import com.capstone.rebyu.assessment.entity.ExamType;
import com.capstone.rebyu.assessment.repository.ExamTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Guarantees the assessment types the application cannot function without.
 *
 * <p>These were seeded only by Flyway migrations (V8, V16). That is fine when
 * Flyway runs — but this database has no {@code flyway_schema_history} table
 * at all, so it never did: the schema came from Hibernate {@code ddl-auto:
 * update}, which creates tables from entities and knows nothing about the
 * INSERTs in a migration file. The result was an {@code exam_types} table that
 * existed and was empty, and a certification generation that produced seven
 * assessments and saved none of them:
 *
 * <pre>
 *   exam_type 'LESSON_QUIZ' is not seeded; 'Introduction to ... Quiz' was not saved.
 * </pre>
 *
 * <p>Reference data an application depends on to store its own output should
 * not be contingent on which schema tool happened to run, so it is asserted at
 * startup instead. Idempotent: only missing rows are inserted, so this is a
 * no-op on a database where the migrations did run.
 *
 * <p>Deliberately additive. Nothing is renamed or deleted — {@code QUIZ} and
 * {@code MODULE_EXAM} from V8 predate the major/middle/lesson scopes and may
 * still be attached to existing exams.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamTypeSeeder implements ApplicationRunner {

    /**
     * The scopes the generation pipeline emits, from
     * {@code app.domain.persistence.exam_type_for_scope} in the Python
     * service. Every one of these must resolve to a row or that assessment is
     * silently dropped.
     */
    private static final List<String> REQUIRED_TYPES = List.of(
            "DIAGNOSTIC",
            "MOCK_EXAM",
            "MAJOR_EXAM",
            "MIDDLE_EXAM",
            "LESSON_QUIZ");

    private final ExamTypeRepository examTypeRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Set<String> existing = examTypeRepository.findAll().stream()
                .map(ExamType::getExamTypeText)
                .collect(Collectors.toCollection(HashSet::new));

        List<ExamType> missing = REQUIRED_TYPES.stream()
                .filter(type -> !existing.contains(type))
                .map(type -> ExamType.builder().examTypeText(type).build())
                .toList();

        if (missing.isEmpty()) {
            return;
        }

        examTypeRepository.saveAll(missing);
        log.info("Seeded {} missing exam type(s): {}", missing.size(),
                missing.stream().map(ExamType::getExamTypeText).toList());
    }
}
