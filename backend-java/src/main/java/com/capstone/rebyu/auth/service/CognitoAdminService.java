package com.capstone.rebyu.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminCreateUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminCreateUserResponse;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AttributeType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.DeliveryMediumType;
import software.amazon.awssdk.services.cognitoidentityprovider.model.AdminDeleteUserRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.ListUsersRequest;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UserNotFoundException;
import software.amazon.awssdk.services.cognitoidentityprovider.model.UsernameExistsException;

import java.util.List;

/**
 * Provisions approved institution login accounts in the Cognito user pool.
 *
 * AdminCreateUser generates a temporary password and Cognito emails the new
 * institution its username and temporary password (a forced reset on first
 * login). This is the "admin approves, institution receives credentials by
 * email" step. It requires the cognito-idp:AdminCreateUser IAM permission.
 */
@Slf4j
@Service
public class CognitoAdminService {

    private final CognitoIdentityProviderClient adminClient;
    private final String userPoolId;

    public CognitoAdminService(
            @Qualifier("cognitoAdminClient") CognitoIdentityProviderClient adminClient,
            @Value("${app.cognito.user-pool-id}") String userPoolId) {
        this.adminClient = adminClient;
        this.userPoolId = userPoolId;
    }

    /** Outcome of an institution account provisioning attempt. */
    public record ProvisionResult(boolean emailed, String cognitoSub, String note) {
    }

    /**
     * Removes the sign-in behind a Cognito subject, so a deleted account cannot
     * come back. Without this, CognitoAuthService re-provisions a User and
     * Learner for any still-valid token whose subject it does not recognise.
     *
     * <p>Best effort by design: the database rows are already gone by the time
     * this runs, and an unreachable Cognito must not undo that. A missing user
     * is the desired end state, not a failure.
     */
    public void deleteAccount(String cognitoSub) {
        try {
            String username = usernameForSubject(cognitoSub);
            if (username == null) {
                log.warn("No Cognito user for subject {}; nothing to delete", cognitoSub);
                return;
            }
            adminClient.adminDeleteUser(AdminDeleteUserRequest.builder()
                    .userPoolId(userPoolId)
                    .username(username)
                    .build());
            log.info("Deleted Cognito account for subject {}", cognitoSub);
        } catch (UserNotFoundException alreadyGone) {
            log.info("Cognito account for subject {} was already removed", cognitoSub);
        } catch (Exception ex) {
            log.error("Cognito account for subject {} could not be deleted: {}. "
                    + "The learner's data is gone, but this sign-in must be removed by hand "
                    + "or the account will be re-provisioned on next login.", cognitoSub, ex.getMessage());
        }
    }

    /** AdminDeleteUser takes a username; the token only carries the subject. */
    private String usernameForSubject(String cognitoSub) {
        return adminClient.listUsers(ListUsersRequest.builder()
                        .userPoolId(userPoolId)
                        .filter("sub = \"" + cognitoSub + "\"")
                        .limit(1)
                        .build())
                .users().stream()
                .findFirst()
                .map(user -> user.username())
                .orElse(null);
    }

    public ProvisionResult createInstitutionAccount(
            String email, String givenName, String familyName) {
        try {
            AdminCreateUserResponse response = adminClient.adminCreateUser(
                    AdminCreateUserRequest.builder()
                            .userPoolId(userPoolId)
                            .username(email)
                            .userAttributes(
                                    AttributeType.builder().name("email").value(email).build(),
                                    AttributeType.builder().name("email_verified").value("true").build(),
                                    AttributeType.builder().name("given_name")
                                            .value(givenName == null ? "" : givenName).build(),
                                    AttributeType.builder().name("family_name")
                                            .value(familyName == null ? "" : familyName).build())
                            // Cognito emails the username + temporary password.
                            .desiredDeliveryMediums(DeliveryMediumType.EMAIL)
                            .build());

            String sub = extractSub(response.user() == null ? List.of() : response.user().attributes());
            log.info("Institution Cognito account created and credentials emailed to {}", email);
            return new ProvisionResult(true, sub,
                    "Login credentials were emailed to " + email + ".");
        } catch (UsernameExistsException alreadyExists) {
            log.info("Institution Cognito account already exists for {}", email);
            return new ProvisionResult(false, null,
                    "An account already exists for " + email + "; no new email was sent.");
        } catch (Exception e) {
            // Most commonly an IAM AccessDeniedException. Approval must still
            // succeed; the admin can send credentials manually or add the
            // cognito-idp:AdminCreateUser permission and re-run provisioning.
            log.warn("Could not create institution Cognito account for {}: {}", email, e.getMessage());
            return new ProvisionResult(false, null,
                    "The organization was approved, but the login account could not be "
                            + "created automatically. Send credentials manually.");
        }
    }

    private String extractSub(List<AttributeType> attributes) {
        return attributes.stream()
                .filter(a -> "sub".equals(a.name()))
                .map(AttributeType::value)
                .findFirst()
                .orElse(null);
    }
}
