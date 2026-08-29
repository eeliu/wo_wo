# Code Review

Review date: 2026-08-29

Scope: current working tree, including uncommitted changes. This review focused on browser-side security boundaries, Supabase Auth/RLS, Storage, deployment, and production dependencies. The 2026-08-29 follow-up revalidated fixes made after the initial review.

## Findings

### Resolved: Uploaded images are no longer publicly accessible

The original issue is resolved. [`supabase/storage.sql`](supabase/storage.sql) now creates or updates `word-images` as a private bucket, and [`src/upload.js`](src/upload.js) creates a signed URL rather than a public URL.

Signed URLs remain bearer credentials for their one-hour lifetime. Do not expose them outside a user's private word records. Rendering persisted images after their URL expires will require regenerating a signed URL from the object path instead of storing the signed URL in Markdown.

### Medium: Storage limits are enforced only by the browser

[`src/upload.js`](src/upload.js) limits uploads to 5 MB and a client-side MIME allowlist, but those checks can be bypassed by calling the Supabase Storage API directly with an authenticated user token. [`supabase/storage.sql`](supabase/storage.sql) does not configure a bucket `file_size_limit` or `allowed_mime_types`.

Set these limits in the Supabase Dashboard or include a migration that configures the bucket. Remove `image/svg+xml` unless SVG uploads are essential: SVG is active content and should not be accepted merely because it is an image format.

### Medium: Database text fields have no server-side size limits

[`supabase/schema.sql`](supabase/schema.sql) defines all user-provided text columns as unrestricted `text`. The `maxlength` attributes in [`index.html`](index.html) apply only to the normal UI and do not constrain direct PostgREST requests made with the public anon key.

Add database `CHECK` constraints matching the intended UI limits for `word`, `meaning`, `example`, and `note`. This protects database storage and query performance from oversized rows.

### Low: No Content Security Policy

[`index.html`](index.html) has no Content Security Policy. Markdown is currently sanitized by DOMPurify in [`src/markdown.js`](src/markdown.js), so no direct XSS was verified. A CSP remains important defense in depth against a future sanitizer regression, compromised third-party asset, or unsafe DOM insertion.

Add a restrictive CSP through GitHub Pages-compatible response configuration where available, or use a carefully tested meta policy. At minimum, constrain `default-src`, `script-src`, `connect-src` to the configured Supabase origin, `img-src`, and `object-src 'none'`.

### Resolved: GitHub Pages deployment path is aligned

The original mismatch is resolved. [`vite.config.js`](vite.config.js) now uses `/wo_wo/`, matching the deployment documentation.

Confirm that `wo_wo` is the GitHub repository name before deployment; GitHub Pages project URLs must use the repository name.

### Low: Secret scanning does not run on direct pushes to `main`

[`privacy-scan.yml`](.github/workflows/privacy-scan.yml) runs only for `pull_request` events. A direct push to `main`, including a manual emergency fix, bypasses the scan.

Add a `push` trigger for `main` (and optionally a scheduled trigger) so the protected branch is scanned regardless of how changes arrive.

## Verified Controls

- The `words` table has RLS enabled. Its select, insert, update, and delete policies scope access to `auth.uid() = user_id`.
- The frontend uses the Supabase anon key rather than a `service_role` key.
- Markdown rendering goes through DOMPurify before assignment to `innerHTML`; word titles are HTML-escaped.
- `.env` files are ignored by Git.

## Validation

- `npm run build`: passed during the initial review and the follow-up review.
- `npm audit --omit=dev`: passed with 0 reported production dependency vulnerabilities during both reviews.
- VS Code diagnostics: no errors reported for `src` or `index.html`.

## Review Limits

- Supabase Dashboard settings, active bucket configuration, email confirmation settings, and production HTTP headers were not available for direct inspection. The SQL files describe intended configuration but may not match the deployed project.