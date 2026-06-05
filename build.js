import { build } from 'esbuild';
import { createPluginBundlerPresets } from '@paperclipai/plugin-sdk/bundlers';

const presets = createPluginBundlerPresets({
  uiEntry: 'src/ui/index.tsx',
});

// Configure worker and manifest to externalize all package dependencies and Node built-ins
presets.esbuild.worker.packages = 'external';
presets.esbuild.manifest.packages = 'external';

const nodeBuiltins = ['fs', 'path', 'module', 'stream', 'zlib', 'util', 'events', 'crypto'];
presets.esbuild.worker.external = [...(presets.esbuild.worker.external || []), ...nodeBuiltins];
presets.esbuild.manifest.external = [...(presets.esbuild.manifest.external || []), ...nodeBuiltins];

async function main() {
  console.log('Building worker...');
  await build(presets.esbuild.worker);
  
  console.log('Building manifest...');
  await build(presets.esbuild.manifest);
  
  console.log('Building UI...');
  await build(presets.esbuild.ui);
  
  console.log('Build complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
