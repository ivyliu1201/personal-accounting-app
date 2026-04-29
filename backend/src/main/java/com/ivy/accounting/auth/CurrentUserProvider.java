package com.ivy.accounting.auth;

/**
 * Provides the current authenticated user id for user-scoped accounting data.
 */
public interface CurrentUserProvider {

    /**
     * Returns the current user id.
     *
     * @return current user id
     */
    String getCurrentUserId();
}
