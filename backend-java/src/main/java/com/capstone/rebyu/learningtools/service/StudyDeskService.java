package com.capstone.rebyu.learningtools.service;

import com.capstone.rebyu.learningtools.entity.LearnerDashboardLayout;
import com.capstone.rebyu.learningtools.entity.LearnerNote;
import com.capstone.rebyu.learningtools.repository.LearnerDashboardLayoutRepository;
import com.capstone.rebyu.learningtools.repository.LearnerNoteRepository;
import com.capstone.rebyu.user.entity.Learner;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * The learner's own working surface beside their analytics: the checklist they
 * keep while revising one certification, scoped to the learner resolved from
 * the token.
 *
 * The exam countdown beside it needs nothing here -- it counts to the target
 * exam date on the study plan, so that date has one home rather than two that
 * can disagree.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class StudyDeskService {

    private static final int MAX_NOTE_LENGTH = 500;
    /** The analytics board is six columns wide; a tile runs at most five rows tall. */
    private static final int MAX_COL = 6;
    private static final int MAX_ROW = 5;

    private final LearnerNoteRepository noteRepository;
    private final LearnerDashboardLayoutRepository layoutRepository;
    private final ObjectMapper mapper;
    private final EntityManager entityManager;

    public record NoteDto(Long noteId, String body, boolean done, OffsetDateTime createdAt) {}

    // ------------------------------------------------------------------ notes

    @Transactional(readOnly = true)
    public List<NoteDto> notes(Long learnerId, Long certificationId) {
        return noteRepository
                .findByLearner_LearnerIdAndCertificationIdOrderByCreatedAtAsc(learnerId, certificationId)
                .stream().map(StudyDeskService::toDto).toList();
    }

    public NoteDto addNote(Long learnerId, Long certificationId, String body) {
        String text = requireBody(body);
        LearnerNote note = noteRepository.save(LearnerNote.builder()
                .learner(entityManager.getReference(Learner.class, learnerId))
                .certificationId(certificationId)
                .body(text)
                .done(false)
                .build());
        return toDto(note);
    }

    /** Ticks/unticks a note, or edits its text. Null fields are left as they are. */
    public NoteDto updateNote(Long learnerId, Long noteId, Boolean done, String body) {
        LearnerNote note = requireOwned(learnerId, noteId);
        if (body != null) {
            note.setBody(requireBody(body));
        }
        if (done != null && done != note.isDone()) {
            note.setDone(done);
            note.setCompletedAt(done ? OffsetDateTime.now() : null);
        }
        return toDto(noteRepository.save(note));
    }

    public void deleteNote(Long learnerId, Long noteId) {
        noteRepository.delete(requireOwned(learnerId, noteId));
    }

    /** @param completedOnly clear just the ticked notes rather than the whole list */
    public int clearNotes(Long learnerId, Long certificationId, boolean completedOnly) {
        return completedOnly
                ? noteRepository.deleteCompletedForLearnerAndCertification(learnerId, certificationId)
                : noteRepository.deleteAllForLearnerAndCertification(learnerId, certificationId);
    }

    // ------------------------------------------------------- dashboard layout

    /**
     * One tile's place on the board: its column/row origin and how many columns
     * and rows it covers. Coordinates rather than a position in a sequence,
     * because the learner drops a tile in a chosen spot and it has to stay
     * there -- an order alone cannot express a deliberate gap.
     */
    public record TilePlacement(String id, Integer x, Integer y, Integer w, Integer h) {}

    /**
     * The learner's saved board, or an empty list when they have never
     * rearranged anything -- which tells the page to use its own defaults
     * rather than treating "no layout" as "no tiles".
     */
    @Transactional(readOnly = true)
    public List<TilePlacement> dashboardLayout(Long learnerId) {
        return layoutRepository.findByLearner_LearnerId(learnerId)
                .map(row -> readLayout(row.getTileOrder()))
                .orElseGet(List::of);
    }

    /** Saves the board after a move or a resize. An empty list resets to the defaults. */
    public List<TilePlacement> saveDashboardLayout(Long learnerId, List<TilePlacement> tiles) {
        List<TilePlacement> layout = tiles == null ? List.of() : tiles.stream()
                .filter(tile -> tile != null && tile.id() != null && !tile.id().isBlank())
                .map(tile -> new TilePlacement(
                        tile.id(),
                        // Clamped rather than trusted: a tile placed outside the
                        // six-column grid, or claiming forty columns, would
                        // simply not render where the learner put it.
                        clampToGrid(tile.x(), 0, MAX_COL - 1),
                        Math.max(0, tile.y() == null ? 0 : tile.y()),
                        clampToGrid(tile.w(), 1, MAX_COL),
                        clampToGrid(tile.h(), 1, MAX_ROW)))
                .toList();

        LearnerDashboardLayout row = layoutRepository.findByLearner_LearnerId(learnerId)
                .orElseGet(() -> LearnerDashboardLayout.builder()
                        .learner(entityManager.getReference(Learner.class, learnerId))
                        .build());
        row.setTileOrder(writeLayout(layout));
        row.setUpdatedAt(OffsetDateTime.now());
        layoutRepository.save(row);
        return layout;
    }

    private static Integer clampToGrid(Integer value, int min, int max) {
        if (value == null) return min;
        return Math.min(max, Math.max(min, value));
    }

    private List<TilePlacement> readLayout(String json) {
        try {
            return mapper.readValue(json, new TypeReference<List<TilePlacement>>() {});
        } catch (Exception e) {
            // A layout that cannot be parsed is a preference, not data worth
            // failing a page load over -- fall back to the defaults. This is
            // also what makes the older id-only format degrade quietly rather
            // than 500 the analytics page.
            log.warn("Unreadable dashboard layout, using the defaults: {}", e.getMessage());
            return List.of();
        }
    }

    private String writeLayout(List<TilePlacement> layout) {
        try {
            return mapper.writeValueAsString(layout);
        } catch (Exception e) {
            throw new IllegalArgumentException("The layout could not be stored: " + e.getMessage());
        }
    }

    // ---------------------------------------------------------------- helpers

    private String requireBody(String body) {
        String text = body == null ? "" : body.trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("A note cannot be empty");
        }
        if (text.length() > MAX_NOTE_LENGTH) {
            throw new IllegalArgumentException("A note can be at most " + MAX_NOTE_LENGTH + " characters");
        }
        return text;
    }

    /** Another learner's note is reported as simply not found. */
    private LearnerNote requireOwned(Long learnerId, Long noteId) {
        LearnerNote note = noteRepository.findById(noteId)
                .orElseThrow(() -> new EntityNotFoundException("Note not found: " + noteId));
        if (!note.getLearner().getLearnerId().equals(learnerId)) {
            throw new EntityNotFoundException("Note not found: " + noteId);
        }
        return note;
    }

    private static NoteDto toDto(LearnerNote note) {
        return new NoteDto(note.getNoteId(), note.getBody(), note.isDone(), note.getCreatedAt());
    }
}
