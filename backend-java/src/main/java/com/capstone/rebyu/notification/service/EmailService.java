package com.capstone.rebyu.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String mailFrom;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public void sendInstitutionInvitation(
            String recipientEmail,
            String organizationName,
            String certificationTitle,
            String invitationToken
    ) {
        String invitationLink = buildInvitationLink(invitationToken);

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(recipientEmail);
        message.setSubject("You're invited to join " + certificationTitle + " on REBYU");

        message.setText("""
                Hello,

                %s invited you to join the %s certification review on REBYU.

                Accept your invitation here:
                %s

                This invitation link will expire in 7 days.
                Please do not share this link with anyone else.

                REBYU Team
                """.formatted(
                organizationName,
                certificationTitle,
                invitationLink
        ));

        mailSender.send(message);
    }

    private String buildInvitationLink(String invitationToken) {
        if (invitationToken == null || invitationToken.isBlank()) {
            throw new IllegalArgumentException("Invitation token must not be blank.");
        }

        String cleanFrontendUrl = frontendUrl.replaceAll("/+$", "");

        return UriComponentsBuilder
                .fromUriString(cleanFrontendUrl)
                .path("/invitations/accept")
                .queryParam("token", invitationToken)
                .build()
                .encode()
                .toUriString();
    }
}