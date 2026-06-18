/**
 * lib/cognito.ts
 *
 * Cognito admin wrapper — provisions and disables login accounts for app users.
 *
 * When an admin creates a `users` row (admin → Users panel), we also create the
 * matching Cognito account so the person can sign in immediately — no manual
 * minting. Settings: FORCE_CHANGE_PASSWORD, a shared temporary password, no
 * invitation email (MessageAction SUPPRESS), email pre-verified.
 *
 * IMPORTANT — ordering differs from a typical "best effort" provision:
 * this app's `users.cognito_sub` column is NOT NULL + UNIQUE, so the caller must
 * provision Cognito FIRST and insert the DB row with the returned `sub`. We never
 * end up with a DB user that can't log in.
 *
 * Pool + region come from COGNITO_ISSUER (already used by NextAuth), e.g.
 * https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxxxxxx — the region
 * MUST come from the issuer, not a generic AWS_REGION.
 *
 * Credentials: this app is deployed on Vercel, which has NO attached AWS IAM
 * role, so the SDK default provider chain finds nothing. APP_AWS_ACCESS_KEY_ID /
 * APP_AWS_SECRET_ACCESS_KEY MUST be set (Vercel env + local) — they belong to an
 * IAM user holding cognito-idp:AdminCreateUser, AdminGetUser, and AdminDisableUser
 * on this user pool. The APP_AWS_ prefix is deliberate: Vercel/Lambda reserve the
 * bare AWS_ prefix. If the keys are absent, getClient() falls back to undefined
 * creds and every call fails with "Missing credentials".
 */

import {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminDisableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Shared onboarding password. New users are forced to change it on first login.
// Override via COGNITO_DEFAULT_TEMP_PASSWORD if it ever needs rotating.
const DEFAULT_TEMP_PASSWORD = process.env.COGNITO_DEFAULT_TEMP_PASSWORD || 'Slcm!1234';

function parseIssuer(): { region: string; userPoolId: string } | null {
    const issuer = process.env.COGNITO_ISSUER;
    if (!issuer) return null;
    // https://cognito-idp.<region>.amazonaws.com/<userPoolId>
    const m = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com\/([^/?#]+)/);
    return m ? { region: m[1], userPoolId: m[2] } : null;
}

let _client: CognitoIdentityProviderClient | null = null;
function getClient(region: string): CognitoIdentityProviderClient {
    if (_client) return _client;
    const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY;
    _client = new CognitoIdentityProviderClient({
        region,
        credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
    return _client;
}

export type CognitoProvisionResult =
    | { ok: true; status: 'created' | 'already_exists'; sub: string | null }
    | { ok: false; reason: string };

/**
 * Create (idempotently) a Cognito login for `email`. NEVER throws — returns a
 * result object. On success returns the Cognito `sub` so the caller can store it
 * on users.cognito_sub. Because that column is NOT NULL, callers must treat a
 * `sub: null` result as a failure for create purposes.
 */
export async function provisionCognitoLogin(email: string): Promise<CognitoProvisionResult> {
    const cfg = parseIssuer();
    if (!cfg) return { ok: false, reason: 'COGNITO_ISSUER not configured' };

    const username = (email || '').trim().toLowerCase();
    if (!username.includes('@')) return { ok: false, reason: 'invalid email' };

    const client = getClient(cfg.region);
    try {
        const res = await client.send(new AdminCreateUserCommand({
            UserPoolId: cfg.userPoolId,
            Username: username,
            MessageAction: 'SUPPRESS',
            TemporaryPassword: DEFAULT_TEMP_PASSWORD,
            UserAttributes: [
                { Name: 'email', Value: username },
                { Name: 'email_verified', Value: 'true' },
            ],
        }));
        const sub = res.User?.Attributes?.find(a => a.Name === 'sub')?.Value ?? null;
        return { ok: true, status: 'created', sub };
    } catch (err: any) {
        // Already has a login — idempotent. Fetch the sub so the new DB row links to it.
        if (err?.name === 'UsernameExistsException') {
            try {
                const got = await client.send(new AdminGetUserCommand({ UserPoolId: cfg.userPoolId, Username: username }));
                const sub = got.UserAttributes?.find(a => a.Name === 'sub')?.Value ?? null;
                return { ok: true, status: 'already_exists', sub };
            } catch {
                return { ok: true, status: 'already_exists', sub: null };
            }
        }
        return { ok: false, reason: `${err?.name || 'Error'}: ${err?.message || 'unknown'}` };
    }
}

export type CognitoDisableResult =
    | { ok: true; status: 'disabled' | 'not_found' }
    | { ok: false; reason: string };

/**
 * Disable (not delete) the Cognito login for `email` so the person can no longer
 * sign in. NEVER throws — best-effort cleanup paired with a DB row delete. A
 * missing Cognito user counts as success (nothing left to disable).
 */
export async function disableCognitoLogin(email: string): Promise<CognitoDisableResult> {
    const cfg = parseIssuer();
    if (!cfg) return { ok: false, reason: 'COGNITO_ISSUER not configured' };

    const username = (email || '').trim().toLowerCase();
    if (!username.includes('@')) return { ok: false, reason: 'invalid email' };

    const client = getClient(cfg.region);
    try {
        await client.send(new AdminDisableUserCommand({ UserPoolId: cfg.userPoolId, Username: username }));
        return { ok: true, status: 'disabled' };
    } catch (err: any) {
        if (err?.name === 'UserNotFoundException') return { ok: true, status: 'not_found' };
        return { ok: false, reason: `${err?.name || 'Error'}: ${err?.message || 'unknown'}` };
    }
}
