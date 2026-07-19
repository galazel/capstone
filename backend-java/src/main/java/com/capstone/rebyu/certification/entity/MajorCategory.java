package com.capstone.rebyu.certification.entity;

import com.capstone.rebyu.enterprisegroup.entity.EnterpriseGroup;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "major_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString(onlyExplicitlyIncluded = true)
public class MajorCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @ToString.Include
    private Long majorCategoryId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certification_id", nullable = false)
    @ToString.Exclude
    private Certification certification;

    @ToString.Include
    @Column(nullable = false, length = 150)
    private String title;

    // NULL = official, platform-wide content (today's only case). Non-null
    // will mark this major category (and everything nested under it) as
    // Enterprise Member-authored content scoped to one group. Not yet acted
    // on by any read/write path -- see V41 migration javadoc.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_group_id")
    @ToString.Exclude
    private EnterpriseGroup ownerGroup;

    @OneToMany(mappedBy = "majorCategory", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("middleCategoryId ASC")
    @ToString.Exclude
    private List<MiddleCategory> middleCategory = new ArrayList<>();
}
