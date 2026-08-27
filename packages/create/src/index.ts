export type Starter = "skeleton" | "empty";
export type Existing = "fail" | "overwrite";

export type InitOptions = {
  directory?: string;
  starter?: Starter;
  theme?: string;
  yes?: boolean;
  existing?: Existing;
};

export function init(_options?: InitOptions): void {
  throw new Error("not implemented");
}
