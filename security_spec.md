# MediGuide AI — Firestore Security Specification (Phase 0 & Doctor Portal Update)

## 1. Data Invariants
1. **Owner-Only Profile & No Enumeration**: `/users/{userId}` and `/doctors/{doctorId}` can only be read (`get`) or written by `request.auth.uid == owner` with `email_verified == true`. Collection `list` on `/users` and `/doctors` is strictly denied (`false`). Medical license numbers live strictly in `/doctors/{doctorId}` and are never exposed in `/doctor_directory/{doctorId}`.
2. **Atomic Doctor Registration**: Creating `/doctors/{doctorId}` requires `existsAfter(/doctor_directory/{doctorId})` and vice versa, guaranteeing synchronized clinician registration and directory presence.
3. **Master Gate Integrity**: No `/users/{userId}/reports/{reportId}` document may be created unless `/users/{userId}` exists. No `/handoffs/{handoffId}` may be created unless `/users/{patientUid}` exists and `assignedDoctorUid` is either the self-reviewing user or an existing registered doctor in `/doctors/{assignedDoctorUid}`.
4. **Handoff RBAC & Terminal Locking**:
   - `/handoffs/{handoffId}` can only be listed or read by `patientUid` or `assignedDoctorUid`.
   - Only a registered doctor (`exists(/doctors/{uid})`) who is `assignedDoctorUid` can publish a `doctorResponse` and transition `handoffStatus` to `'completed'`.
   - Once `handoffStatus == 'completed'`, non-admin updates are strictly blocked (terminal state locking).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: Create `/users/u1/reports/r1` or `/doctors/d1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email**: Create `/doctors/d1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing**: Create `/handoffs/h1` with `patientUid: "victim-uid"` -> `PERMISSION_DENIED`.
4. **Role Self-Escalation**: Create `/users/u1` with `role: "admin"` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Create `/doctors/d1` with extra `isSuperAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Create `/handoffs/bad id/1` -> `PERMISSION_DENIED`.
7. **State Shortcutting on Create**: Create `/handoffs/h1` with `handoffStatus: "completed"` and forged `doctorResponse` -> `PERMISSION_DENIED`.
8. **Unauthorized Clinician Publish**: Non-assigned or unregistered user tries to update `/handoffs/h1` to `completed` -> `PERMISSION_DENIED`.
9. **Terminal State Overwrite**: Update `/handoffs/h1` when `existing().handoffStatus == "completed"` as non-admin -> `PERMISSION_DENIED`.
10. **Non-Atomic Doctor Registration**: Create `/doctors/d1` without creating `/doctor_directory/d1` in the same batch -> `PERMISSION_DENIED`.
11. **Doctor PII Enumeration**: Attempt `list` on `/doctors` -> `PERMISSION_DENIED`.
12. **Cross-User Handoff Scraping**: List `/handoffs` with a user who is neither `patientUid` nor `assignedDoctorUid` -> `PERMISSION_DENIED`.
