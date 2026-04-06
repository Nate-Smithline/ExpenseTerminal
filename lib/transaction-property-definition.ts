export type TransactionPropertyDefinition = {
  id: string;
  org_id?: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  position: number;
};
