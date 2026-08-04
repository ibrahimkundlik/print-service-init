import * as path from 'path';
import * as Module from 'module';
import * as esbuild from 'esbuild';
import { Injectable, Logger } from '@nestjs/common';
import { PrintType } from '../../Printers/Schemas/printer.schema';
import { Template } from '../Config/bill-template.data';

// The transpiled async/generator code inside @urbanpiper-engineering/prime-core-js
// expects a global regeneratorRuntime (normally supplied by the consuming app's own
// bundler setup) instead of importing its own polyfill.
// eslint-disable-next-line @typescript-eslint/no-var-requires
(global as any).regeneratorRuntime = require('regenerator-runtime');

/**
 * @urbanpiper-engineering/prime-core-js ships raw ESM (import/export, extensionless
 * directory imports) with no CommonJS build. Plain require() can't parse that syntax,
 * and Node's native ESM loader can't resolve the package's own extensionless imports
 * either (throws ERR_UNSUPPORTED_DIR_IMPORT) — confirmed against real Node 22 behavior
 * during the POC; a require.extensions-based hook (esbuild-register) also fails, since
 * Node's newer require(esm) detection routes syntactically-ESM files to the native ESM
 * loader before any such hook runs. Bundling the entry point into a single real CJS
 * module in-memory with esbuild, then loading it via Node's own Module/_compile API,
 * is what actually works.
 */
function requireEsm(entryFile: string): any {
  const { outputFiles } = esbuild.buildSync({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });

  const mod = new (Module as any)(entryFile, module);
  mod.filename = entryFile;
  mod.paths = (Module as any)._nodeModulePaths(path.dirname(entryFile));
  mod._compile(outputFiles[0].text, entryFile);
  return mod.exports;
}

// Bundled from the package's top-level entry (not just the CorePrint subpath) so
// CorePrint and CoreHelpers share the same inlined i18next instance — bundling them
// separately would give each its own copy, and initializeI18n() would initialize an
// i18next instance CorePrint's translations never actually read from.
const { CorePrint, CoreHelpers } = requireEsm(
  require.resolve('@urbanpiper-engineering/prime-core-js'),
);

CoreHelpers.initializeI18n('en');

@Injectable()
export class BillHtmlService {
  private readonly logger = new Logger(BillHtmlService.name);

  /**
   * Renders an order payload to bill or KOT HTML via CorePrint (§9.3 step 1),
   * depending on the target printer's `printType`. `CoreHelpers.initializeI18n('en')`
   * has already run at module-load time above — without it, every translated string
   * in the output renders blank (i18next silently returns nothing from an
   * uninitialized instance, no error).
   */
  render(order: unknown, printType: PrintType, title: string): string {
    const options = { language: 'en', renderer: 'html', title };

    if (printType === PrintType.Kot) {
      return CorePrint.encodeOrderKot(order, Template, options);
    }
    return CorePrint.encodeOrderBill(order, Template, options);
  }
}
