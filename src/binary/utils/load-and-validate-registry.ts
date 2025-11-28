import fs from "fs";
import os from "os";

import * as AjvModule from "ajv";
import yaml from "js-yaml";

import { registryFile } from "../constants.js";
import { Registry } from "../types.js";

// Handle CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvModule as any).default || AjvModule;

export function loadAndValidateRegistry(filepath: string): Registry {
  const registry = yaml.load(fs.readFileSync(filepath, "utf-8")) as unknown;

  const ajv = new Ajv({ allErrors: true });
  // Note: Not using JSONSchemaType<Registry> because it doesn't support patternProperties well
  // The schema below provides runtime validation; TypeScript validates at compile time
  const schema = {
    type: "object",
    required: ["version", "chains"],
    additionalProperties: false,
    properties: {
      version: { type: "number" },
      chains: {
        type: "object",
        minProperties: 2,
        additionalProperties: false,
        patternProperties: {
          "^(.*)$": {
            type: "object",
            required: [
              "chain_id",
              "prefix",
              "gas_price",
              "rpc",
              "estimated_block_time",
              "estimated_indexer_time",
            ],
            additionalProperties: false,
            properties: {
              chain_id: { type: "string" },
              prefix: { type: "string" },
              gas_price: { type: "string" },
              faucet: { type: "string" },
              hd_path: { type: "string" },
              ics20_port: { type: "string" },
              rpc: { type: "array", items: { type: "string" }, minItems: 1 },
              estimated_block_time: { type: "number" },
              estimated_indexer_time: { type: "number" },
            },
          },
        },
      },
    },
  } as const;
  const validate = ajv.compile(schema);
  if (!validate(registry)) {
    const errors = (validate.errors ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ instancePath, message }: any) => `"${instancePath}" ${message}`,
    );
    throw new Error(
      [`${registryFile} validation failed.`, ...errors].join(os.EOL),
    );
  }

  return registry as Registry;
}
