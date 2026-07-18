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
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.HstsHeaderWriter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

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
