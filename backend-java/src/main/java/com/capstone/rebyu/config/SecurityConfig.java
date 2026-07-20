package com.capstone.rebyu.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.HstsHeaderWriter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Only LearnerProfileService's change-password/delete-account flow needs
    // this (accounts are otherwise authenticated via Cognito, not a local
    // password check) -- nothing previously defined this bean at all.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .headers(headers -> headers
                        .frameOptions(frameOptions -> frameOptions.deny())
                        .contentTypeOptions(Customizer.withDefaults())
                        .addHeaderWriter(new HstsHeaderWriter())
                )
                .authorizeHttpRequests(authorize -> authorize
                        // Current-user synchronization always requires a
                        // validated Cognito access token.
                        .requestMatchers("/api/auth/**").authenticated()
                        // Accepting an invitation must identify the learner
                        // from a validated token (never from the request body),
                        // so a missing/invalid token returns 401.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/learners/accept-invitation").authenticated()
                        // Progress analytics resolves the learner strictly from
                        // the validated token — never from a client-supplied id.
                        .requestMatchers("/api/learners/me/**").authenticated()
                        // Admin partnership review, enterprise group/authority/
                        // assignee management, and invitation sending all now
                        // resolve the caller's identity/enterprise from the
                        // token — never from client-supplied enterpriseId/
                        // createdBy/assignedBy fields.
                        .requestMatchers("/api/admin/partnership-requests/**").authenticated()
                        .requestMatchers("/api/enterprise-groups/**").authenticated()
                        .requestMatchers("/api/enterprise-group-authorities/**").authenticated()
                        .requestMatchers("/api/enterprise-group-assignees/**").authenticated()
                        .requestMatchers("/api/enterprise/invitations/**").authenticated()
                        .requestMatchers("/api/enterprise/certification-access").authenticated()
                        .requestMatchers("/api/enterprise/partnership-requests/**").authenticated()
                        // Tenant-scoped enterprise portal reads: enterpriseId is resolved
                        // from the caller's JWT and every list is filtered to that tenant
                        // server-side, replacing the old browser-side filtering of global lists.
                        .requestMatchers("/api/enterprise/me/**").authenticated()
                        // License/entitlement reads: enterpriseId is JWT-derived at the
                        // controller now, but this path previously had no auth requirement
                        // here either -- any unauthenticated caller could read any
                        // enterprise's billing/entitlement data by guessing an id. Block
                        // anonymous access here too.
                        .requestMatchers("/api/enterprise/license", "/api/enterprise/license/**",
                                "/api/enterprise/entitlements").authenticated()
                        // Tenant/user-scoped portal reads (JWT-derived learnerId/userId).
                        .requestMatchers("/api/learners/me/portal").authenticated()
                        // Flat cross-tenant/cross-user lists that no scoped flow uses anymore --
                        // their controllers now require ADMIN; block anonymous access here too.
                        .requestMatchers("/api/organization-certificates/**").authenticated()
                        .requestMatchers("/api/organization-certification-learners/**").authenticated()
                        .requestMatchers("/api/activity-logs/**").authenticated()
                        // Exam-result reads are admin-only at the controller; managers/learners
                        // read their own via the scoped portal endpoints. Block anonymous here too.
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/exam-results/**").authenticated()
                        // User reads are admin-only at the controller; block anonymous here too.
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/users", "/api/users/*").authenticated()
                        // Learner-certification reads are admin-only at the controller; block anonymous here too.
                        .requestMatchers(org.springframework.http.HttpMethod.GET,
                                "/api/learner-certifications", "/api/learner-certifications/*").authenticated()
                        // These controllers had NO auth anywhere -- neither here nor at the
                        // controller -- until this pass: every learner record, every
                        // enterprise's profile/billing/verification/invoice data, and every
                        // learner's per-question exam detail row was readable and writable
                        // by any unauthenticated caller. Now admin-only at the controller;
                        // block anonymous access here too.
                        .requestMatchers("/api/learners", "/api/learners/*").authenticated()
                        .requestMatchers("/api/enterprises/**").authenticated()
                        .requestMatchers("/api/enterprise-members/**").authenticated()
                        .requestMatchers("/api/enterprise-verification-documents/**").authenticated()
                        .requestMatchers("/api/enterprise-invoices/**").authenticated()
                        .requestMatchers("/api/learner-exam-details/**").authenticated()
                        // learnerId is now JWT-derived at the controller instead of a
                        // client-supplied request param; block anonymous access here too.
                        .requestMatchers("/api/learner/analytics/**").authenticated()
                        // Generic scaffolding CRUD for partnership requests/items was
                        // previously fully public and unfiltered -- anyone could read
                        // every organization's contact info across every tenant with
                        // no auth. The real flows are the tenant-scoped transaction
                        // and admin-review endpoints above; this path is admin-only now.
                        .requestMatchers("/api/partnership-requests/**").authenticated()
                        .requestMatchers("/api/partnership-request-items/**").authenticated()
                        // BKT outbox retry/reconcile trigger real backend side effects and
                        // had no auth at all (neither here nor in the controller) -- anyone
                        // on the public internet could force-retry or reconcile mastery events.
                        .requestMatchers("/api/admin/bkt/**").authenticated()
                        .requestMatchers("/api/admin/community/reports/**").authenticated()
                        .requestMatchers("/api/admin/gamification-settings/**").authenticated()
                        // The question bank (including choices/correct answers) had no
                        // auth at all -- anyone could read, create, edit, or delete any
                        // question. Now admin- or enterprise-scoped at the controller;
                        // block anonymous access here too.
                        .requestMatchers("/api/questions/**").authenticated()
                        // Same defect on the per-type answer-key endpoints (choices,
                        // short-answer/descriptive keys, programming test cases, diagram
                        // reference answers) -- had zero auth, now admin- or
                        // enterprise-scoped at the controller; block anonymous access here too.
                        .requestMatchers("/api/choices/**").authenticated()
                        .requestMatchers("/api/text-question-configs/**").authenticated()
                        .requestMatchers("/api/programming-question-configs/**").authenticated()
                        .requestMatchers("/api/diagram-question-configs/**").authenticated()
                        // Exam WRITES had no auth at all -- anyone could create/edit/
                        // publish/delete any assessment platform-wide. Now admin-only at
                        // the controller; block anonymous writes here too. GET stays open
                        // because learners discover available assessments through it.
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/exams", "/api/exams/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.PUT, "/api/exams/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE, "/api/exams/**").authenticated()
                        // Certification/category/lesson WRITES had no auth at all -- anyone
                        // could create/edit/delete/publish any certification, category, or
                        // lesson platform-wide. Now admin-only at the controller; block
                        // anonymous writes here too. GET stays open -- the catalog is browsed
                        // from the public partnership-request page and by every signed-in role.
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/certifications", "/api/certifications/generate",
                                "/api/major-categories", "/api/middle-categories", "/api/lessons").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.PUT,
                                "/api/certifications/**", "/api/major-categories/**",
                                "/api/middle-categories/**", "/api/lessons/**").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,
                                "/api/certifications/**", "/api/major-categories/**",
                                "/api/middle-categories/**", "/api/lessons/**").authenticated()
                        // File view/download stay public (embedded directly as <img src>/
                        // download links with no Authorization header attached), but
                        // uploading (content-planting) and deleting an arbitrary file by
                        // key are both destructive/integrity-sensitive and admin-only.
                        .requestMatchers(org.springframework.http.HttpMethod.DELETE,
                                "/api/files").authenticated()
                        .requestMatchers(org.springframework.http.HttpMethod.POST,
                                "/api/files/upload", "/api/files/upload/certification").authenticated()
                        // Existing application routes keep their current
                        // public behavior; tokens are validated when present.
                        .anyRequest().permitAll()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                .build();
    }

    // Decoder bound to the Cognito User Pool: validates signature against the
    // pool JWKS, the issuer, expiry, and that the token is an access token.
    @Bean
    public JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri
    ) {
        NimbusJwtDecoder decoder = (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(issuerUri);

        OAuth2TokenValidator<Jwt> tokenUseIsAccess = jwt -> {
            Object tokenUse = jwt.getClaims().get("token_use");
            if ("access".equals(tokenUse)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Not a Cognito access token", null));
        };

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuerUri),
                tokenUseIsAccess
        ));
        return decoder;
    }
}
