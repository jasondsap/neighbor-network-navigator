import { neon } from '@neondatabase/serverless';

// ============================================================================
// Lazy-initialized Neon client (Amplify SSR compatible — env may be unavailable
// at module-load time in Lambda). Same Proxy pattern as PSS.
// ============================================================================
let _sql: ReturnType<typeof neon> | null = null;

function getConnection(): ReturnType<typeof neon> {
    if (!_sql) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        _sql = neon(process.env.DATABASE_URL);
    }
    return _sql;
}

// Works with tagged templates (sql`SELECT ...`) AND property access (sql.query, sql.transaction).
// The `get` handler forwards property access to the underlying Neon client, which is
// required for Neon driver v1+ where sql(text, params) function-call form was removed.
export const sql: ReturnType<typeof neon> = new Proxy(function () {} as any, {
    apply(_target, _thisArg, args) {
        return (getConnection() as any)(...args);
    },
    get(_target, prop) {
        const conn = getConnection() as any;
        const value = conn[prop];
        return typeof value === 'function' ? value.bind(conn) : value;
    },
}) as any;

// ============================================================================
// GENERIC QUERY HELPERS
// ============================================================================

export async function query<T>(queryString: string, params?: unknown[]): Promise<T[]> {
    try {
        // Neon serverless v1+ requires sql.query(...) for parameterized queries
        // (the old sql(text, params) function-call form was removed in v1)
        const result: any = await (sql as any).query(queryString, params ?? []);
        // Defensive: driver returns rows directly in default mode, or {rows: [...]} in full-results mode
        return (Array.isArray(result) ? result : result?.rows ?? []) as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

export async function queryOne<T>(queryString: string, params?: unknown[]): Promise<T | null> {
    const results = await query<T>(queryString, params);
    return results[0] || null;
}

export async function insert<T>(table: string, data: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const queryString = `
        INSERT INTO ${table} (${columns})
        VALUES (${placeholders})
        RETURNING *
    `;

    const result = await query<T>(queryString, values);
    return result[0];
}

export async function update<T>(
    table: string,
    data: Record<string, unknown>,
    where: Record<string, unknown>
): Promise<T[]> {
    const dataKeys  = Object.keys(data);
    const whereKeys = Object.keys(where);

    const setClause   = dataKeys.map((key, i)  => `${key} = $${i + 1}`).join(', ');
    const whereClause = whereKeys.map((key, i) => `${key} = $${dataKeys.length + i + 1}`).join(' AND ');

    const values = [...Object.values(data), ...Object.values(where)];

    const queryString = `
        UPDATE ${table}
        SET ${setClause}, updated_at = NOW()
        WHERE ${whereClause}
        RETURNING *
    `;

    return query<T>(queryString, values);
}

export async function softDelete(table: string, id: string): Promise<boolean> {
    const queryString = `
        UPDATE ${table}
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1
    `;
    await query(queryString, [id]);
    return true;
}

export async function hardDelete(table: string, id: string): Promise<boolean> {
    await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return true;
}

// ============================================================================
// USER HELPERS
// ============================================================================

export async function getOrCreateUser(cognitoSub: string, email: string, name?: string) {
    const existing = (await sql`
        SELECT * FROM users WHERE cognito_sub = ${cognitoSub}
    `) as any[];

    if (existing.length > 0) {
        await sql`
            UPDATE users SET last_login_at = NOW() WHERE cognito_sub = ${cognitoSub}
        `;
        return existing[0];
    }

    const [firstName, ...lastParts] = (name || '').split(' ');
    const lastName = lastParts.join(' ');

    const newUser = (await sql`
        INSERT INTO users (cognito_sub, email, first_name, last_name, last_login_at)
        VALUES (${cognitoSub}, ${email}, ${firstName || null}, ${lastName || null}, NOW())
        RETURNING *
    `) as any[];

    return newUser[0];
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function logAuditEvent(
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string
): Promise<void> {
    try {
        await sql`
            INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
            VALUES (
                ${userId}::uuid,
                ${action},
                ${resourceType},
                ${resourceId ? resourceId : null}::uuid,
                ${JSON.stringify(details || {})}::jsonb,
                ${ipAddress || null}
            )
        `;
    } catch (error) {
        // Never let audit failures break the app
        console.error('Audit log error:', error);
    }
}

// ============================================================================
// RESOURCE HELPERS
// ============================================================================

export async function getCategories() {
    return sql`
        SELECT id, name, slug, icon, color, description, display_order
        FROM resource_categories
        WHERE is_active = TRUE
        ORDER BY display_order, name
    `;
}

export async function getSubcategoriesWithCounts(category?: string) {
    if (category && category !== 'all') {
        return sql`
            SELECT category, subcategory, resource_count
            FROM vw_subcategories_with_counts
            WHERE category = ${category}
            ORDER BY subcategory
        `;
    }
    return sql`
        SELECT category, subcategory, resource_count
        FROM vw_subcategories_with_counts
        ORDER BY category, subcategory
    `;
}

export async function getResourceById(id: string) {
    const result = (await sql`
        SELECT * FROM resources WHERE id = ${id} AND is_active = TRUE
    `) as any[];
    return result[0] || null;
}

/**
 * Resource search. Uses Postgres full-text on the query string when present,
 * with fallback to trigram matching on the org name for tolerance to typos.
 */
export async function searchResources(opts: {
    query?: string;
    category?: string;
    subcategory?: string;
    zip?: string;
    limit?: number;
}) {
    const { query: q, category, subcategory, zip, limit = 1000 } = opts;

    // Build dynamically because Neon's tagged template chains awkwardly with
    // lots of optional predicates. Parameterized placeholders keep it safe.
    const clauses: string[] = ['is_active = TRUE'];
    const params: unknown[]  = [];
    let p = 1;

    if (q && q.trim()) {
        clauses.push(`(
            search_vector @@ plainto_tsquery('english', $${p})
            OR organization_name ILIKE '%' || $${p} || '%'
        )`);
        params.push(q.trim());
        p += 1;
    }

    if (category && category !== 'all') {
        clauses.push(`category = $${p}`);
        params.push(category);
        p += 1;
    }

    if (subcategory) {
        clauses.push(`subcategory = $${p}`);
        params.push(subcategory);
        p += 1;
    }

    if (zip) {
        clauses.push(`zip LIKE $${p}`);
        params.push(`${zip}%`);
        p += 1;
    }

    const sqlText = `
        SELECT *
        FROM resources
        WHERE ${clauses.join(' AND ')}
        ORDER BY
            CASE WHEN $${p}::text IS NOT NULL
                THEN ts_rank(search_vector, plainto_tsquery('english', $${p}::text))
                ELSE 0
            END DESC,
            organization_name ASC
        LIMIT $${p + 1}
    `;
    params.push(q || null);
    params.push(limit);

    return query(sqlText, params);
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateUUID(id: string): boolean {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return re.test(id);
}

export function sanitizeInput(input: string): string {
    return input.trim().slice(0, 10000);
}
