package com.capstone.rebyu.challenge.entity;

import jakarta.persistence.*;
import lombok.Data;

/**
 * An industry allowed into one arena.
 *
 * <p>Keyed by the arena's string id rather than by a {@code challenge_modes}
 * row. There is an older {@code challenge_mode_industries} table keyed that
 * way, but nothing populates {@code challenge_modes} and the whole admin
 * surface addresses arenas as "codestrike" / "blueprint" / "worldcup" -- so
 * using it would have meant inventing mode rows purely to hang industries off,
 * and keeping them in step with three arenas that are not data.
 *
 * <p>One row per (arena, industry). The set is replaced wholesale when an admin
 * saves, which is how the dialog behaves: it presents every industry with
 * checkboxes and submits the result, not a diff.
 */
@Data
@Entity
@Table(
    name = "challenge_arena_industries",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_arena_industry",
        columnNames = {"arena_id", "industry"}))
public class ChallengeArenaIndustry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long arenaIndustryId;

  @Column(name = "arena_id", nullable = false, length = 40)
  private String arenaId;

  @Column(nullable = false, length = 100)
  private String industry;
}
