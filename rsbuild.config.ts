import { defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginReact } from '@rsbuild/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/rspack';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [
    pluginReact(),
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions(opts) {
        opts.plugins?.unshift('babel-plugin-react-compiler');
      },
    }),
  ],
  html: {
    title: 'tools.zmeyer.dev',
    meta: {
      description:
        'Browser-based tools for bulk audio processing. Convert formats, adjust sample rates, and trim files locally without uploading data.',
      viewport: 'width=device-width, initial-scale=1.0',
      charset: 'utf-8',
      'theme-color': '#000000',
      // Open Graph tags for social sharing
      'og:title': 'tools.zmeyer.dev',
      'og:description':
        'Browser-based tools for bulk audio processing. Convert formats, adjust sample rates, and trim files locally without uploading data.',
      'og:type': 'website',
      'og:url': 'https://tools.zmeyer.dev',
      // Twitter Card tags
      'twitter:card': 'summary_large_image',
      'twitter:title': 'tools.zmeyer.dev',
      'twitter:description':
        'Browser-based tools for bulk audio processing. Convert formats, adjust sample rates, and trim files locally without uploading data.',
      'twitter:creator': '@zmeyer',
    },
    favicon: './public/favicon.ico',
  },
  tools: {
    rspack: {
      plugins: [
        tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
        }),
      ],
    },
  },
});
