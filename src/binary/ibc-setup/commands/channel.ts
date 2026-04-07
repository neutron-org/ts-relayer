import os from "os";
import path from "path";

import { Order } from "cosmjs-types/ibc/core/channel/v1/channel.js";

import { Link } from "../../../lib/link.js";
import { appFile, registryFile } from "../../constants.js";
import { Logger } from "../../create-logger.js";
import { indent } from "../../utils/indent.js";
import { loadAndValidateApp } from "../../utils/load-and-validate-app.js";
import { loadAndValidateRegistry } from "../../utils/load-and-validate-registry.js";
import { resolveOption } from "../../utils/options/resolve-option.js";
import { resolveHomeOption } from "../../utils/options/shared/resolve-home-option.js";
import { resolveKeyFileOption } from "../../utils/options/shared/resolve-key-file-option.js";
import { resolveMnemonicOption } from "../../utils/options/shared/resolve-mnemonic-option.js";
import { signingClient } from "../../utils/signing-client.js";

export type Flags = {
  readonly interactive: boolean;
  readonly ordered: boolean;
  readonly mnemonic?: string;
  readonly keyFile?: string;
  readonly home?: string;
  readonly srcConnection?: string;
  readonly destConnection?: string;
  readonly srcPort?: string;
  readonly destPort?: string;
  readonly version?: string;
};

export type Options = {
  readonly home: string;
  readonly mnemonic: string;
  readonly src: string;
  readonly dest: string;
  readonly srcConnection: string;
  readonly destConnection: string;
  readonly srcPort: string;
  readonly destPort: string;
  readonly version: string;
  readonly ordered: boolean;
};

export const defaults = {
  version: "ics20-1",
};

export async function channel(flags: Flags, logger: Logger) {
  const home = resolveHomeOption({ homeFlag: flags.home });
  const app = loadAndValidateApp(home);
  if (!app) {
    throw new Error(`${appFile} not found at ${home}`);
  }

  const keyFile = resolveKeyFileOption({ keyFileFlag: flags.keyFile, app });
  const mnemonic = await resolveMnemonicOption({
    interactiveFlag: flags.interactive,
    mnemonicFlag: flags.mnemonic,
    keyFile,
    app,
  });
  const src = resolveOption("src", { required: true })(app.src);
  const dest = resolveOption("dest", { required: true })(app.dest);
  const srcConnection = resolveOption("srcConnection", { required: true })(
    flags.srcConnection,
    app.srcConnection,
    process.env.RELAYER_SRC_CONNECTION,
  );
  const destConnection = resolveOption("destConnection", { required: true })(
    flags.destConnection,
    app.destConnection,
    process.env.RELAYER_DEST_CONNECTION,
  );
  const srcPort = resolveOption("srcPort", { required: true })(
    flags.srcPort,
    process.env.RELAYER_SRC_PORT,
  );
  const destPort = resolveOption("destPort", { required: true })(
    flags.destPort,
    process.env.RELAYER_DEST_PORT,
  );
  const version =
    resolveOption("version")(flags.version, process.env.RELAYER_VERSION) ??
    defaults.version;

  const options: Options = {
    home,
    mnemonic,
    src,
    dest,
    srcConnection,
    destConnection,
    srcPort,
    destPort,
    version,
    ordered: flags.ordered,
  };

  await run(options, logger);
}

export async function run(options: Options, logger: Logger) {
  const registryFilePath = path.join(options.home, registryFile);
  const registry = loadAndValidateRegistry(registryFilePath);
  const srcChain = registry.chains[options.src];
  if (!srcChain) {
    throw new Error(`src channel "${options.src}" not found in registry`);
  }
  const destChain = registry.chains[options.dest];
  if (!destChain) {
    throw new Error(`dest channel "${options.dest}" not found in registry`);
  }

  const nodeA = await signingClient(
    srcChain,
    options.mnemonic,
    logger.child({ label: srcChain.chain_id }),
  );
  const nodeB = await signingClient(
    destChain,
    options.mnemonic,
    logger.child({ label: destChain.chain_id }),
  );

  const link = await Link.createWithExistingConnections(
    nodeA,
    nodeB,
    options.srcConnection,
    options.destConnection,
    logger,
  );

  const ordering = options.ordered
    ? Order.ORDER_ORDERED
    : Order.ORDER_UNORDERED;

  const channel = await link.createChannel(
    "A",
    options.srcPort,
    options.destPort,
    ordering,
    options.version,
  );

  const output = [
    "Created channel:",
    ...indent([
      `${srcChain.chain_id}: ${channel.src.portId}/${channel.src.channelId} (${link.endA.connectionID})`,
      `${destChain.chain_id}: ${channel.dest.portId}/${channel.dest.channelId} (${link.endB.connectionID})`,
    ]),
  ].join(os.EOL);

  console.log(output);
}
