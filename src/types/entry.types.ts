export interface DeltaOp {
  insert: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export interface Delta {
  ops: DeltaOp[];
}

// title is NOT a separate DB column — stored inside encryptedContent
// alongside the Quill Delta, so it benefits from field-level encryption.
export interface EntryPayload {
  title: string | null;
  content: Delta;
}
