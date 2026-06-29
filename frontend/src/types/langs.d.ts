declare module "langs" {
  interface LangInfo {
    name: string;
    local?: string;
    "1"?: string;
    "2"?: string;
    "2T"?: string;
    "2B"?: string;
    "3"?: string;
  }

  interface Langs {
    where(type: "1" | "2" | "2T" | "2B" | "3", code: string): LangInfo | undefined;
  }

  const langs: Langs;
  export default langs;
}
