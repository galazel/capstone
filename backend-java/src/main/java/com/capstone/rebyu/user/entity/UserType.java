package com.capstone.rebyu.user.entity;


import com.capstone.rebyu.organization.entity.Institution;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_types")
@Data
@NoArgsConstructor
public class UserType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userTypeId;
    @Column(name = "user_type_text", nullable = false, length = 20)
    private String userTypeText;
}
