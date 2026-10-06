"use client";

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Audit history</h1>
      <p className="muted mt-1 text-sm">
        Every important action — human and AI — is recorded with actor type, resource
        and metadata.
      </p>

      <div className="panel mt-5 p-5 text-sm">
        <p className="font-medium">Not wired to the UI yet</p>
        <p className="muted mt-2 text-xs leading-relaxed">
          Audit reads currently exist only on the internal service-to-service API
          (<code>GET /api/internal/audit/:organizationId</code>), which the browser must
          never call. Viewing audit history in the dashboard needs a recruiter-facing,
          organization-scoped endpoint with an <code>audit:read</code> permission —
          tracked as the remaining Phase 8 item.
        </p>
      </div>
    </div>
  );
}
