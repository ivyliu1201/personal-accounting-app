package com.ivy.accounting.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Development-only current user provider.
 */
@Component
public class DevCurrentUserProvider implements CurrentUserProvider {

    private final String devUserId;

    public DevCurrentUserProvider(@Value("${app.auth.dev-user-id}") String devUserId) {
        this.devUserId = devUserId;
    }

    @Override
    public String getCurrentUserId() {
        // TODO: Replace this temporary development user with Firebase Authentication.
        return devUserId;
    }
}
