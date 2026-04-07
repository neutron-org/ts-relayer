import { AppConfig } from "../../../types.js";
import { resolveOption } from "../resolve-option.js";

type Params = {
  keyFileFlag?: string;
  app: AppConfig | null;
};

export function resolveKeyFileOption({ keyFileFlag, app }: Params) {
  return resolveOption("keyFile")(
    keyFileFlag,
    process.env.KEY_FILE,
    app?.keyFile,
  );
}
