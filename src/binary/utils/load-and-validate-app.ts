import fs from "fs";
import os from "os";
import path from "path";

import * as AjvModule from "ajv";
import type { JSONSchemaType } from "ajv";
import yaml from "js-yaml";

import { appFile } from "../constants.js";
import { AppConfig } from "../types.js";

import { isNoExistError } from "./is-no-exist-error.js";

// Handle CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvModule as any).default || AjvModule;

function readAppYaml(filepath: string) {
  try {
    return fs.readFileSync(filepath, "utf-8");
  } catch (error) {
    if (isNoExistError(error)) {
      throw error;
    }

    return null;
  }
}

export function loadAndValidateApp(home: string): AppConfig | null {
  const appContents = readAppYaml(path.join(home, appFile));

  if (!appContents) {
    return null;
  }

  const app = yaml.load(appContents) as unknown;

  const ajv = new Ajv({ allErrors: true });
  const schema: JSONSchemaType<AppConfig> = {
    type: "object",
    additionalProperties: false,
    required: [],
    properties: {
      src: { type: "string", nullable: true, default: null },
      srcConnection: { type: "string", nullable: true, default: null },
      dest: { type: "string", nullable: true },
      destConnection: { type: "string", nullable: true },
      mnemonic: { type: "string", nullable: true },
      keyFile: { type: "string", nullable: true },
      enableMetrics: { type: "boolean", nullable: true },
      metricsPort: { type: "number", nullable: true },
    },
  };
  const validate = ajv.compile(schema);

  if (!validate(app)) {
    const errors = (validate.errors ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ instancePath, message }: any) => `"${instancePath}" ${message}`,
    );
    throw new Error([`${appFile} validation failed.`, ...errors].join(os.EOL));
  }

  // After successful validation, app is guaranteed to be AppConfig
  return app as AppConfig;
}
