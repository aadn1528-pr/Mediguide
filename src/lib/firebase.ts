import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_FILE_NAME_LENGTH,
  MAX_FILE_SIZE_BYTES,
  sanitizeAttachment,
  sanitizeId,
} from './validation';
import type { LabFileAttachment } from '../types/lab';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutFirebase() {
  return signOut(auth);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function uploadLabReportFile(
  userId: string,
  reportId: string,
  input: File | { data: string; mimeType: string; name: string }
): Promise<LabFileAttachment> {
  const safeReportId = sanitizeId(reportId, 'report');
  let rawName: string;
  let mimeType: string;
  let bytes: Uint8Array;

  if (input instanceof File) {
    rawName = input.name;
    mimeType = input.type;
    const buffer = await input.arrayBuffer();
    bytes = new Uint8Array(buffer);
  } else {
    rawName = input.name;
    mimeType = input.mimeType;
    bytes = base64ToUint8Array(input.data);
  }

  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]
    )
  ) {
    throw new Error('Only PNG, JPG, WEBP images and PDF lab reports can be stored.');
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Uploaded file must be between 1 byte and 12 MB.');
  }

  const safeFileName = rawName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, MAX_FILE_NAME_LENGTH) || 'lab-report';
  const storagePath = `users/${userId}/reports/${safeReportId}/${Date.now()}_${safeFileName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, bytes, { contentType: mimeType });
  const downloadUrl = await getDownloadURL(storageRef);

  return sanitizeAttachment({
    fileName: rawName.slice(0, MAX_FILE_NAME_LENGTH),
    mimeType: mimeType as LabFileAttachment['mimeType'],
    sizeBytes: bytes.byteLength,
    storagePath,
    downloadUrl,
  });
}

export async function deleteLabReportFile(storagePath?: string | null): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    console.warn('Cloud Storage cleanup skipped or failed:', error);
  }
}
