import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import banner from 'vite-plugin-banner';

export default defineConfig({
	plugins: [
		dts(), 
		banner(`/**
 * Bootstrap 5 autocomplete ${process.env.npm_package_version}
 * https://github.com/lekoala/bootstrap5-autocomplete
 * @license MIT
 */`)
	],
	build: {
		lib: {
			entry: './src/autocomplete.ts',
			name: 'autocomplete',
			fileName: 'autocomplete',
			formats: ['es', 'iife', 'umd']
		},
		rollupOptions: {
			external: ['bootstrap'],
			output: {
				globals: {
					bootstrap: 'bootstrap'
				}
			},
		},
		sourcemap: true
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: [
			'tests/**/*.test.ts'],
		forceRerunTriggers: ['./vite.config.ts']
	}
});