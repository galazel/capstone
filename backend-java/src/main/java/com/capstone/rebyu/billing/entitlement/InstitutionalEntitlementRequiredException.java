package com.capstone.rebyu.billing.entitlement;

import lombok.Getter;

/**
 * Thrown when an institution action needs an institutional entitlement its
 * current license does not include. Rendered as a structured 403.
 */
@Getter
public class InstitutionalEntitlementRequiredException extends RuntimeException {

    private final String code = "INSTITUTIONAL_ENTITLEMENT_REQUIRED";
    private final String feature;

    public InstitutionalEntitlementRequiredException(String feature) {
        super("Your current institutional license does not include this feature.");
        this.feature = feature;
    }

    public InstitutionalEntitlementRequiredException(String feature, String message) {
        super(message);
        this.feature = feature;
    }
}
